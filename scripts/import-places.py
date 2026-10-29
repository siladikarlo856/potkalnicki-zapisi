#!/usr/bin/env python3
"""Explicit offline import. Normal build/test never downloads or runs this script.

Requires scripts/places-requirements.txt in a separate import virtualenv.
Inputs are the three archives pinned by data/places/sources.json.
"""
import argparse
from collections import Counter, defaultdict
from hashlib import sha256
import json
from pathlib import Path
import re
import unicodedata
from xml.etree import ElementTree as ET
from zipfile import ZipFile

from pyproj import Transformer
from shapely.geometry import MultiPolygon, Point, Polygon

ROOT = Path(__file__).resolve().parents[1]
NS = {
    'au': 'http://inspire.ec.europa.eu/schemas/au/4.0',
    'gn': 'http://inspire.ec.europa.eu/schemas/gn/4.0',
    'gmd': 'http://www.isotc211.org/2005/gmd',
    'base': 'http://inspire.ec.europa.eu/schemas/base/3.3',
    'gml': 'http://www.opengis.net/gml/3.2',
}
XLINK = '{http://www.w3.org/1999/xlink}'
GML = '{http://www.opengis.net/gml/3.2}'
# PPLL and PPLX require the SAME official settlement match as every other code.
# A GeoNames section may be misclassified: only a verified standalone DGU naselje qualifies.
ACTIVE_CODES = {'PPL', 'PPLA', 'PPLA2', 'PPLA3', 'PPLA4', 'PPLA5', 'PPLC', 'PPLCD', 'PPLF', 'PPLG', 'PPLR', 'PPLL', 'PPLX'}


def fold(value):
    text = ''.join(c for c in unicodedata.normalize('NFD', value.lower().replace('đ', 'd')) if unicodedata.category(c) != 'Mn')
    return re.sub(r'\s*-\s*', '-', re.sub(r'\s+', ' ', text)).strip()


def source_names(row):
    return {fold(s) for s in [row[1], row[2], *row[3].split(',')]} if row else set()


def dump(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    # One record per line keeps generated data diffs reviewable without enormous files.
    if isinstance(value, list):
        text = '[\n' + ',\n'.join(json.dumps(row, ensure_ascii=False, separators=(',', ':')) for row in value) + '\n]\n'
    else:
        text = '{"version":' + json.dumps(value['version']) + ',"places":[\n' + ',\n'.join(json.dumps(row, ensure_ascii=False, separators=(',', ':')) for row in value['places']) + '\n]}\n'
    path.write_text(text)


def official_reference(path):
    records, polygons = {}, {}
    for _, element in ET.iterparse(ZipFile(path).open('AdministrativeUnit.gml'), events=['end']):
        if element.tag != '{' + NS['au'] + '}AdministrativeUnit':
            continue
        parent = element.find('au:upperLevelUnit', NS)
        record = {
            'id': element.get(GML + 'id'),
            'code': element.findtext('au:nationalCode', None, NS),
            'localId': element.findtext('au:inspireId/base:Identifier/base:localId', None, NS),
            'level': element.findtext('au:nationalLevelName/gmd:LocalisedCharacterString', None, NS),
            'name': element.findtext('au:name/gn:GeographicalName/gn:spelling/gn:SpellingOfName/gn:text', '', NS).strip(),
            'parentId': parent.get(XLINK + 'href', '').lstrip('#') if parent is not None else None,
        }
        records[record['id']] = record
        if record['level'] == 'Naselje':
            def ring(node):
                coordinates = list(map(float, node.text.split()))
                # EPSG:3035 in GML uses northing/easting axis order.
                return [(coordinates[i + 1], coordinates[i]) for i in range(0, len(coordinates), 2)]
            parts = []
            for polygon in element.findall('.//gml:Polygon', NS):
                exterior = ring(polygon.find('gml:exterior/gml:LinearRing/gml:posList', NS))
                holes = [ring(h) for h in polygon.findall('gml:interior/gml:LinearRing/gml:posList', NS)]
                parts.append(Polygon(exterior, holes))
            polygons[record['code']] = MultiPolygon(parts)
        element.clear()
    settlements = []
    for record in records.values():
        if record['level'] != 'Naselje':
            continue
        municipality = records[record['parentId']]
        county = records[municipality['parentId']]
        settlements.append({
            'code': record['code'], 'localId': record['localId'], 'name': record['name'],
            'municipality': municipality['name'], 'municipalityCode': municipality['code'],
            'county': county['name'], 'countyCode': county['code'],
        })
    if len(settlements) != 6759:
        raise ValueError('Pinned reference count changed; review sources/version before updating')
    return settlements, polygons


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--hr', required=True, type=Path)
    parser.add_argument('--aliases', required=True, type=Path)
    parser.add_argument('--dgu', required=True, type=Path)
    parser.add_argument('--output', type=Path, default=ROOT)
    args = parser.parse_args()
    manifest = json.loads((ROOT / 'data/places/sources.json').read_text())
    for name, path in [('geonames', args.hr), ('aliases', args.aliases), ('dgu', args.dgu)]:
        if sha256(path.read_bytes()).hexdigest() != manifest['sources'][name]['sha256']:
            raise ValueError(f'{name} checksum mismatch: do not replace a reviewed snapshot silently')
    official, polygons = official_reference(args.dgu)
    by_name = defaultdict(list)
    for record in official:
        for name in {record['name'], *[s.strip() for s in record['name'].split(' - ')]}:
            by_name[fold(name)].append(record)
    rows = [r.split('\t') for r in ZipFile(args.hr).read('HR.txt').decode().splitlines()]
    admin1 = {r[10]: r for r in rows if r[7] == 'ADM1'}
    admin2 = {r[11]: r for r in rows if r[7] == 'ADM2'}
    aliases = defaultdict(set)
    for line in ZipFile(args.aliases).read('HR.txt').decode().splitlines():
        values = line.split('\t')
        # Retain nonhistoric Croatian, untagged and Italian bilingual variants;
        # never web links, postal codes, airport codes or ended/historical names.
        if len(values) >= 8 and values[2] in {'hr', 'it', ''} and values[7] != '1' and (len(values) < 10 or not values[9]):
            aliases[values[1]].add(values[3])
    transform = Transformer.from_crs(4326, 3035, always_xy=True)
    audit, matched = [], defaultdict(list)
    overrides = json.loads((ROOT / 'data/places/overrides.json').read_text())
    for row in rows:
        if row[6] != 'P':
            continue
        entry = {'id': f'geonames:{row[0]}', 'name': row[1], 'featureCode': row[7], 'evidence': manifest['sources']['dgu']['url']}
        if row[8] != 'HR' or row[7] not in ACTIVE_CODES:
            audit.append({**entry, 'action': 'exclude', 'reason': 'not_active_singular_settlement_code', 'evidence': 'https://www.geonames.org/export/codes.html'})
            continue
        candidates = {candidate['code']: candidate for name in source_names(row) for candidate in by_name.get(name, [])}
        point = Point(transform.transform(float(row[5]), float(row[4])))
        spatial = [c for c in candidates.values() if polygons[c['code']].covers(point)]
        parent = [c for c in candidates.values() if fold(c['municipality']) in source_names(admin2.get(row[11])) and fold(c['county']) in source_names(admin1.get(row[10]))]
        target = None
        method = ''
        if row[0] in overrides:
            correction = overrides[row[0]]
            target = next(c for c in official if c['code'] == correction['officialCode'])
            method = correction['reason']
            entry['overrideEvidence'] = correction['evidence']
        elif len(spatial) == 1:
            target, method = spatial[0], 'exact_name_or_alias_and_official_boundary'
        elif not spatial and len(parent) == 1:
            target, method = parent[0], 'exact_name_or_alias_and_municipality_and_county'
        if target is None:
            audit.append({**entry, 'action': 'exclude', 'reason': 'no_official_name_match' if not candidates else 'unresolved_settlement_identity', 'candidateOfficialCodes': sorted(candidates)})
            continue
        matched[target['code']].append((row, target, method, entry, not polygons[target['code']].covers(point)))
    catalog = []
    for code, group in sorted(matched.items()):
        def preference(item):
            row, target, _, _, _ = item
            correct_parent = fold(target['municipality']) in source_names(admin2.get(row[11]))
            return (not correct_parent, row[7] in {'PPLL', 'PPLX'}, -int(row[14] or 0), -int(row[0]))
        group.sort(key=preference)
        kept_id = f'geonames:{group[0][0][0]}'
        for i, (row, target, method, entry, outside) in enumerate(group):
            changes = {}
            for field, before, after in [('name', row[1], target['name']), ('municipality', admin2.get(row[11], ['',''])[1] if row[11] in admin2 else None, target['municipality']), ('county', admin1.get(row[10], ['',''])[1] if row[10] in admin1 else None, target['county'])]:
                if before != after:
                    changes[field] = {'before': before, 'after': after}
            action = 'keep' if i == 0 else 'merge_duplicate'
            audit.append({**entry, 'action': action, 'officialCode': code, 'method': method, 'changes': changes, 'centroidOutsideOfficialBoundary': outside, **({'keptId': kept_id, 'reason': 'same_official_settlement; prefer_matching_parent_then_standalone_code_then_population_then_id'} if i else {})})
            catalog.append({
                'id': entry['id'], 'sourceId': row[0], 'source': 'GeoNames', 'name': target['name'],
                'aliases': sorted(({row[1], row[2]} | aliases[row[0]]) - {target['name']}),
                'countryCode': 'HR', 'kind': 'settlement', 'featureCode': row[7],
                'municipality': target['municipality'], 'county': target['county'],
                'officialCode': code, 'active': i == 0,
                'latitude': float(row[4]), 'longitude': float(row[5]),
                'sourceModifiedAt': row[18], 'centroidOutsideOfficialBoundary': outside,
                **({'duplicateOf': kept_id} if i else {}),
            })
    # Future updates preserve accepted IDs as retired records for historical references.
    previous = ROOT / 'server/data/places/hr.json'
    if previous.exists():
        present = {p['id'] for p in catalog}
        for old in json.loads(previous.read_text())['places']:
            if old['id'] not in present:
                catalog.append({**old, 'active': False})
    catalog.sort(key=lambda p: int(p['sourceId']))
    if any(len(f"{p['name']} ({p['id']})") > 120 for p in catalog):
        raise ValueError('Snapshot would violate existing place length limit; do not truncate')
    dump(args.output / 'server/data/places/hr.json', {'version': manifest['version'], 'places': catalog})
    dump(args.output / 'data/places/dgu-settlements.json', sorted(official, key=lambda p: p['code']))
    dump(args.output / 'data/places/curation.json', sorted(audit, key=lambda p: int(p['id'].split(':')[1])))
    represented = set(matched)
    dump(args.output / 'data/places/unrepresented-official.json', [s for s in official if s['code'] not in represented])
    print(json.dumps({'populationFeaturesBefore': len(audit), 'activeSettlementsAfter': sum(p['active'] for p in catalog), 'decisions': dict(Counter(d['action'] for d in audit)), 'exclusionReasons': dict(Counter(d['reason'] for d in audit if d['action'] == 'exclude')), 'officialSettlementsUnrepresented': len(official) - len(represented)}, indent=2))


if __name__ == '__main__':
    main()
