import { createHash, randomBytes } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import type { ChallengeContent, ChallengeLeaderboard, ChallengeState } from '../shared/utils/challenge'
import { validateChallengeContent } from '../server/challenges/content'
import { contentUuid } from './helpers/contentUuid'
import sample from './fixtures/heritage/challenge.json'
import { integrationDb } from './support/integrationDb'

// Run with `node scripts/test-challenges.mjs`. It provisions and removes ONLY its own
// containers, applies every migration and exercises the production HTTP + RPC paths.
// What a new fixed challenge stores: the seeded current template, with its revision and id.
// challengeTemplates.integration.test.ts switches the current template only to an identical copy.
const currentChallengeContent = validateChallengeContent({ ...sample, version: 1, templateId: contentUuid('challenge_template:sample') })
const db = await integrationDb({ server: { NUXT_CHALLENGE_RATE_LIMIT_CREATE: '3', NUXT_CHALLENGE_RATE_LIMIT_JOIN: '3' } })
const { sql, fetch } = db

let ipIndex = 0
function client() {
  const ip = `198.51.100.${++ipIndex}`
  let cookie = ''
  const cookies = new Map<string, string>()
  return {
    get cookie() { return cookie },
    async request(path: string, body?: unknown) {
      const scopedCookie = cookies.get(`heritage_${path.split('/')[3]}`) ?? ''
      const response = await fetch(path, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { 'x-forwarded-for': ip, ...(scopedCookie ? { cookie: scopedCookie } : {}), ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
        body: body === undefined ? undefined : JSON.stringify(body)
      })
      if (response.headers.has('set-cookie')) {
        cookie = response.headers.get('set-cookie')!.split(';')[0]!
        cookies.set(cookie.split('=')[0]!, cookie)
      }
      return response
    }
  }
}
type Player = ReturnType<typeof client>
async function state(response: Response, status = 200) {
  expect(response.status, await response.clone().text()).toBe(status)
  expect(response.headers.get('cache-control')).toBe('no-store')
  return await response.json() as ChallengeState
}
async function create(player = client()) {
  const response = await player.request('/api/challenges', { nickname: 'Željko' })
  const game = await state(response, 201)
  expect(response.headers.get('set-cookie')).toContain('HttpOnly')
  expect(response.headers.get('set-cookie')).toContain('SameSite=Lax')
  return { player, game }
}
const path = (game: ChallengeState, action = '') => `/api/challenges/${game.code}${action ? `/${action}` : ''}`
const literal = (value: unknown) => `'${JSON.stringify(value).replaceAll('\'', '\'\'')}'::jsonb`
async function aged(age: number, closesIn: number, content: ChallengeContent = currentChallengeContent) {
  const code = randomBytes(12).toString('base64url')
  sql(`insert into heritage_challenges(code, content, created_at, closes_at, max_closes_at) values ('${code}', ${literal(content)}, now() - interval '${age} days', now() + interval '${closesIn} days', now() + interval '${30 - age} days');`)
  const player = client()
  const game = await state(await player.request(`/api/challenges/${code}/join`, { nickname: 'Iva' }))
  return { game, player }
}
async function complete(player: Player, game: ChallengeState, skip = true) {
  while (game.participant?.phase !== 'finished') {
    const phase = game.participant!.phase
    if (phase === 'ready') game = await state(await player.request(path(game, 'reveal'), {}))
    else if (phase === 'question') game = await state(await player.request(path(game, 'answer'), { questionId: game.question!.id, selected: skip ? null : 0 }))
    else game = await state(await player.request(path(game, 'continue'), { phase, index: game.participant!.index }))
  }
  return game
}

describe.skipIf(!db.enabled)('real challenge HTTP and Postgres behavior', () => {
  it('returns global counts and the cookie participant result independently of every scoreboard page', async () => {
    const { game, player } = await create()
    sql(`insert into heritage_challenge_participants (challenge_code, nickname, token_hash, phase, question_index, completed_at, total_score)
      select '${game.code}', 'Igrač ' || n, lpad(n::text, 64, '0'),
        case when n <= 60 then 'finished' else 'ready' end,
        case when n <= 60 then 15 else 0 end,
        case when n <= 60 then now() else null end,
        case when n <= 50 then 1000 else 0 end
      from generate_series(1, 69) n;`)
    for (const [offset, rows] of [[0, 50], [50, 20], [100, 0]]) {
      const response = await client().request(`${path(game, 'leaderboard')}?offset=${offset}`)
      expect(response.status).toBe(200)
      const board = await response.json() as ChallengeLeaderboard
      expect(board).toMatchObject({ count: 70, completedCount: 60 })
      expect(board.me).toBeNull()
      expect(board.rows).toHaveLength(rows!)
      const ownResponse = await player.request(`${path(game, 'leaderboard')}?offset=${offset}`)
      expect(ownResponse.status).toBe(200)
      const own = await ownResponse.json() as ChallengeLeaderboard
      expect(own.me).toEqual({ nickname: 'Željko', total: 0, rank: 51, rounds: [0, 0, 0], completedAt: null, sharedRank: true })
      expect(own.rows).toHaveLength(rows!)
      expect(JSON.stringify(own)).not.toContain('token_hash')
      expect(JSON.stringify(own)).not.toContain(player.cookie.split('=')[1]!)
      expect(own.me).not.toHaveProperty('id')
      expect(own.rows.every(row => !('id' in row))).toBe(true)
    }
    const stranger = await fetch(path(game, 'leaderboard'), { headers: { cookie: `heritage_${game.code}=${'z'.repeat(43)}`, 'x-forwarded-for': '192.0.2.200' } })
    expect(stranger.status).toBe(200)
    expect((await stranger.json() as ChallengeLeaderboard).me).toBeNull()
  })

  it('creates a challenge from the played quiz round and records the creator score immediately', async () => {
    const player = client()
    // Seeded words have UUID ids; take three active ones with distinct meanings from the database.
    const words = sql('select id || \'|\' || (entry->>\'headword\') || \'|\' || (entry->\'meaning\'->>\'hr\') || \'|\' || coalesce(entry->\'meaning\'->>\'en\', \'\') from heritage_words where active order by id limit 3')
      .split('\n').map((line) => {
        const [id, headword, hr, en] = line.split('|') as [string, string, string, string]
        return { id, headword, hr, en }
      })
    const [a, b, c] = words as [typeof words[0], typeof words[0], typeof words[0]]
    const response = await player.request('/api/challenges', {
      nickname: 'Ana',
      quiz: {
        questions: [
          { id: a.id, optionIds: [c.id, a.id, b.id] },
          { id: b.id, optionIds: [b.id, a.id, c.id] }
        ],
        results: [true, false]
      }
    })
    const game = await state(response, 201)
    expect(game).toMatchObject({
      title: { hr: 'Kaj to znači? — izazov', en: 'Kaj to znači? — challenge' },
      questionCount: 2,
      maxScore: 200,
      targetScore: 100,
      participant: { nickname: 'Ana', phase: 'finished', total: 100, completedAt: expect.any(String) }
    })
    expect(game.participant!.rounds).toEqual([{ topic: { hr: 'Riječi', en: 'Words' }, count: 2, answered: 2, score: 100 }])

    const guest = client()
    const landing = await state(await guest.request(path(game)))
    expect(landing).toMatchObject({ participant: null, targetScore: 100, questionCount: 2 })
    const joined = await state(await guest.request(path(game, 'join'), { nickname: 'Iva' }))
    const revealed = await state(await guest.request(path(joined, 'reveal'), {}))
    expect(revealed.question).toMatchObject({
      id: `quiz-${a.id}`,
      options: [c, a, b].map(w => ({ hr: w.hr, en: w.en || w.hr }))
    })
  })

  it('records a finished Quiz-result challenge in one call, matching a Participant who played the same answers', async () => {
    const question = (id: string, correct: number) => ({
      id, mechanic: 'multiple-choice' as const, prompt: { hr: id, en: id },
      options: [{ hr: 'A', en: 'A' }, { hr: 'B', en: 'B' }, { hr: 'C', en: 'C' }], correct, explanation: { hr: 'X', en: 'X' }
    })
    const content = validateChallengeContent({
      version: 1, sample: false, title: { hr: 'Kviz', en: 'Quiz' },
      rounds: [
        { id: 'a', topic: { hr: 'Prvi', en: 'First' }, questions: [question('q1', 0), question('q2', 2)] },
        { id: 'b', topic: { hr: 'Drugi', en: 'Second' }, questions: [question('q3', 1)] }
      ]
    })
    const results = [true, false, true]

    // The Participant way: reveal, answer and continue through every question.
    const { player, game } = await aged(0, 7, content)
    let played = game
    while (played.participant?.phase !== 'finished') {
      const phase = played.participant!.phase
      if (phase === 'ready') played = await state(await player.request(path(played, 'reveal'), {}))
      else if (phase === 'question') {
        const index = played.participant!.index
        const correct = content.rounds.flatMap(r => r.questions)[index]!.correct
        played = await state(await player.request(path(played, 'answer'), { questionId: played.question!.id, selected: results[index] ? correct : (correct + 1) % 3 }))
      } else played = await state(await player.request(path(played, 'continue'), { phase, index: played.participant!.index }))
    }

    const service = db.service
    const code = randomBytes(12).toString('base64url')
    const hash = createHash('sha256').update(randomBytes(32)).digest('hex')
    const recorded = await service.rpc('heritage_challenge_action', { p_action: 'create_completed', p_code: code, p_hash: hash, p_input: { nickname: 'Iva', content, results } })
    expect(recorded.error).toBeNull()
    const completed = recorded.data as ChallengeState

    const comparable = ({ code: _code, createdAt: _created, closesAt: _closes, participant, ...rest }: ChallengeState) =>
      ({ ...rest, participant: participant && { ...participant, completedAt: typeof participant.completedAt } })
    expect(comparable(completed)).toEqual(comparable(played))
    expect(completed.participant).toMatchObject({ phase: 'finished', total: 200, index: 3 })
    expect(completed.participant!.rounds.map(r => [r.answered, r.score])).toEqual([[2, 100], [1, 100]])
    expect(new Date(completed.closesAt).getTime() - new Date(completed.createdAt).getTime()).toBe(7 * 86400000)
    const perQuestion = (challenge: string) => sql(`select string_agg(a.question_index || ':' || a.correct || ':' || a.points, ',' order by a.question_index) from heritage_challenge_answers a join heritage_challenge_participants p on p.id = a.participant_id where p.challenge_code = '${challenge}' and a.answered_at is not null`)
    expect(perQuestion(code)).toBe(perQuestion(game.code))
    expect(perQuestion(code)).toBe('0:true:100,1:false:0,2:true:100')

    const mismatched = await service.rpc('heritage_challenge_action', { p_action: 'create_completed', p_code: randomBytes(12).toString('base64url'), p_hash: hash, p_input: { nickname: 'Iva', content, results: [true] } })
    expect(mismatched.error?.code).toBe('PT400')
  })

  it('creates a random challenge from the card pool and plays through to the leaderboard', async () => {
    const player = client()
    const response = await player.request('/api/challenges', {
      nickname: 'Marko',
      generate: { topics: ['rijeci', 'mjesta', 'bastina'], game: 'mjesovito', difficulty: 'srednje', length: 10 }
    })
    const game = await state(response, 201)
    expect(game.sample).toBe(false)
    expect(game.questionCount).toBe(10)
    expect(game.maxScore).toBe(1000)
    expect((await player.request(path(game, 'cards'))).status).toBe(409)
    const landing = await state(await player.request(path(game)))
    expect(landing.meta).toMatchObject({ source: 'random', difficulty: 'srednje', game: 'mjesovito' })
    const finished = await complete(player, game)
    expect(finished.participant?.phase).toBe('finished')
    const cards = await (await player.request(path(game, 'cards'))).json() as { cards: string[] }
    expect(cards.cards.length).toBeGreaterThan(0)
    expect(new Set(cards.cards).size).toBe(cards.cards.length)
    const board = await (await client().request(path(game, 'leaderboard'))).json() as ChallengeLeaderboard
    expect(board.count).toBeGreaterThanOrEqual(1)
  })

  it('lets any browser start separate challenges and share their independent links before play', async () => {
    const player = client()
    const first = (await create(player)).game
    const second = (await create(player)).game
    expect(first.code).not.toBe(second.code)
    for (const game of [first, second]) {
      const own = await state(await player.request(path(game)))
      expect(own.participant).toMatchObject({ nickname: 'Željko', phase: 'ready', total: 0 })
      const guest = client()
      const landing = await state(await guest.request(path(game)))
      expect(landing.participant).toBeNull()
      expect(landing.closesAt).toBe(game.closesAt)
      expect((await state(await guest.request(path(game, 'join'), { nickname: 'Ana' }))).participant!.phase).toBe('ready')
    }
  })

  it('shows every participant, live per-round scores and shared ranks before anyone finishes', async () => {
    const { player, game } = await create()
    const guest = client()
    await state(await guest.request(path(game, 'join'), { nickname: 'Ana' }))
    const board = async () => {
      const response = await client().request(path(game, 'leaderboard'))
      expect(response.status).toBe(200)
      return await response.json() as ChallengeLeaderboard
    }
    const initial = await board()
    expect(initial.count).toBe(2)
    expect(initial.rows.map(r => [r.rank, r.total, r.rounds, r.completedAt])).toEqual([[1, 0, [0, 0, 0], null], [1, 0, [0, 0, 0], null]])
    const question = await state(await player.request(path(game, 'reveal'), {}))
    await state(await player.request(path(game, 'answer'), { questionId: question.question!.id, selected: 0 }))
    const live = await board()
    expect(live.rows[0]).toMatchObject({ nickname: 'Željko', rank: 1, total: 100, rounds: [100, 0, 0], completedAt: null })
    expect(live.rows[1]).toMatchObject({ nickname: 'Ana', rank: 2, total: 0 })
    expect(JSON.stringify(live)).not.toContain('correct')
    expect(JSON.stringify(live)).not.toContain('token')
  })

  it('creates a fixed snapshot with seven-day expiry and never leaks future questions or answers', async () => {
    const { player, game } = await create()
    expect(game).toMatchObject({ question: null, feedback: null, sample: true, questionCount: 15, maxScore: 1500, participant: { phase: 'ready', total: 0 } })
    expect(new Date(game.closesAt).getTime() - new Date(game.createdAt).getTime()).toBe(7 * 86400000)
    const serialized = JSON.stringify(game)
    expect(serialized).not.toContain('correct')
    expect(serialized).not.toContain('explanation')
    const revealed = await state(await player.request(path(game, 'reveal'), {}))
    expect(revealed.question?.options).toHaveLength(4)
    expect(revealed.feedback).toBeNull()
    expect(JSON.stringify(revealed)).not.toContain('correct')
    expect(JSON.stringify(revealed)).not.toContain('explanation')
    const rows = await db.client().from('heritage_challenge_participants').select('*').eq('challenge_code', game.code)
    expect(rows.error).toBeNull()
    const token = player.cookie.split('=')[1]!
    expect(rows.data![0]!.token_hash).toBe(createHash('sha256').update(token).digest('hex'))
    expect(JSON.stringify(rows.data)).not.toContain(token)
    expect(sql(`select max_closes_at - created_at from heritage_challenges where code='${game.code}'`)).toBe('30 days')
  })

  it('reconnects to the same question; cannot preview later questions, restart, change an answer or skip feedback', async () => {
    const { player, game } = await create()
    const q = await state(await player.request(path(game, 'reveal'), {}))
    expect((await state(await player.request(path(game)))).question).toEqual(q.question)
    expect((await state(await player.request(path(game, 'reveal'), {}))).question).toEqual(q.question)
    expect((await player.request(path(game, 'answer'), { questionId: 'word-2', selected: 0 })).status).toBe(409)
    expect((await player.request(path(game, 'continue'), { phase: 'question', index: 0 })).status).toBe(400)
    const answers = await Promise.all([0, 1].map(selected => player.request(path(game, 'answer'), { questionId: q.question!.id, selected })))
    expect(answers.map(r => r.status).sort()).toEqual([200, 409])
    const saved = await state(await player.request(path(game)))
    expect(saved.feedback).toMatchObject({ correct: 0, explanation: expect.any(Object) })
    expect(saved.participant!.total).toBe(saved.feedback!.points)
    expect((await player.request(path(game, 'reveal'), {})).status).toBe(409)
    expect((await player.request(path(game, 'answer'), { questionId: q.question!.id, selected: null })).status).toBe(409)
    expect(() => sql(`update heritage_challenge_answers set points = 0 where participant_id=(select id from heritage_challenge_participants where challenge_code='${game.code}');`)).toThrow()
    const advance = { phase: 'feedback', index: 0 }
    const next = await state(await player.request(path(game, 'continue'), advance))
    expect(next.participant!.index).toBe(1)
    expect(next.question).toBeNull()
    expect((await player.request(path(game, 'continue'), advance)).status).toBe(409)
    expect((await state(await player.request(path(game, 'reveal'), {}))).question!.id).toBe('word-2')
  })

  it('allows one attempt per token; nickname alone cannot claim it and explicit skip scores zero', async () => {
    const { player, game } = await create()
    const again = await state(await player.request(path(game, 'join'), { nickname: 'Other name' }))
    expect(again.participant?.nickname).toBe('Željko')
    const stranger = client()
    expect((await stranger.request(path(game, 'join'), { nickname: 'želJKo' })).status).toBe(409)
    expect((await state(await stranger.request(path(game)))).participant).toBeNull()
    expect((await stranger.request(path(game, 'reveal'), {})).status).toBe(401)
    const q = await state(await player.request(path(game, 'reveal'), {}))
    const skipped = await state(await player.request(path(game, 'answer'), { questionId: q.question!.id, selected: null }))
    expect(skipped.feedback).toMatchObject({ selected: null, points: 0 })
    expect(skipped.participant!.total).toBe(0)
    const finished = await complete(player, skipped)
    expect(finished.participant).toMatchObject({ total: 0, phase: 'finished', completedAt: expect.any(String) })
    expect(finished.participant!.rounds.map(r => [r.answered, r.score])).toEqual([[5, 0], [5, 0], [5, 0]])
    expect((await player.request(path(game, 'reveal'), {})).status).toBe(409)
    expect((await state(await player.request(path(game, 'join'), { nickname: 'New attempt' }))).participant).toEqual(finished.participant)
    const other = client()
    const joined = await state(await other.request(path(game, 'join'), { nickname: 'Ana' }))
    await complete(other, joined)
    const board = await (await other.request(path(game, 'leaderboard'))).json() as ChallengeLeaderboard
    expect(board.count).toBe(2)
    expect(board.rows.map(r => r.rank)).toEqual([1, 1])
    expect(board.rows.every(r => r.rounds.join(',') === '0,0,0')).toBe(true)
    expect(JSON.stringify(board)).not.toContain('token')
  })

  it('extends only on newly completed attempts, by three days as needed, capped at day thirty', async () => {
    const tiny = structuredClone(currentChallengeContent)
    tiny.rounds = [{ ...tiny.rounds[0]!, questions: [tiny.rounds[0]!.questions[0]!] }]
    const { player, game } = await aged(6, 1, tiny)
    const q = await state(await player.request(path(game, 'reveal'), {}))
    expect(q.closesAt).toBe(game.closesAt)
    expect((await state(await player.request(path(game)))).closesAt).toBe(game.closesAt)
    const done = await complete(player, q)
    expect(new Date(done.closesAt).getTime() - new Date(done.participant!.completedAt!).getTime()).toBe(3 * 86400000)
    expect((await state(await player.request(path(game)))).closesAt).toBe(done.closesAt)
    const capped = await aged(29, 0.1, tiny)
    const capDone = await complete(capped.player, capped.game)
    expect(sql(`select closes_at = max_closes_at from heritage_challenges where code='${capDone.code}'`)).toBe('t')
    const early = await create()
    const earlyDone = await complete(early.player, early.game)
    expect(earlyDone.closesAt).toBe(early.game.closesAt)
  })

  it('refuses joins and answers after close while completed results and leaderboard remain visible', async () => {
    const { player, game } = await aged(8, 1)
    const q = await state(await player.request(path(game, 'reveal'), {}))
    sql(`update heritage_challenges set closes_at=now()-interval '1 minute' where code='${game.code}';`)
    expect((await player.request(path(game, 'answer'), { questionId: q.question!.id, selected: 0 })).status).toBe(410)
    expect((await client().request(path(game, 'join'), { nickname: 'New guest' })).status).toBe(410)
    expect((await player.request(path(game, 'reveal'), {})).status).toBe(410)
    expect((await state(await player.request(path(game)))).closed).toBe(true)
    expect((await player.request(path(game, 'leaderboard'))).status).toBe(200)
    const finished = await aged(8, 1)
    await complete(finished.player, finished.game)
    sql(`update heritage_challenges set closes_at=now()-interval '1 minute' where code='${finished.game.code}';`)
    expect((await state(await finished.player.request(path(finished.game)))).participant!.phase).toBe('finished')
    const board = await (await client().request(path(finished.game, 'leaderboard'))).json() as ChallengeLeaderboard
    expect(board.rows).toHaveLength(1)
  })

  it('keeps snapshots isolated and denies public database and RPC access', async () => {
    const { player, game } = await create()
    expect(() => sql(`update heritage_challenges set content = jsonb_set(content, '{version}', '99') where code='${game.code}';`)).toThrow()
    const changed = structuredClone(currentChallengeContent)
    changed.title.hr = 'Nova datoteka'
    const next = await aged(0, 7, changed)
    expect(next.game.title.hr).toBe('Nova datoteka')
    expect((await state(await player.request(path(game)))).title).toEqual(game.title)
    const anon = db.client('anon')
    for (const table of ['heritage_challenges', 'heritage_challenge_participants', 'heritage_challenge_answers']) expect((await anon.from(table).select('*')).error).not.toBeNull()
    expect((await anon.rpc('heritage_challenge_action', { p_action: 'state', p_code: game.code })).error).not.toBeNull()
    expect((await anon.rpc('heritage_challenge_scoreboard', { p_code: game.code })).error).not.toBeNull()
  })

  it('passes optional map display through heritage_challenge_state', async () => {
    const content = validateChallengeContent({
      version: 1,
      sample: false,
      title: { hr: 'Karta', en: 'Map' },
      rounds: [{
        id: 'map',
        topic: { hr: 'Mjesta', en: 'Places' },
        questions: [{
          id: 'map-target-1',
          mechanic: 'multiple-choice',
          prompt: { hr: 'Koje je ovo selo?', en: 'Which village?' },
          options: [{ hr: 'A', en: 'A' }, { hr: 'B', en: 'B' }],
          correct: 0,
          explanation: { hr: 'A', en: 'A' },
          display: { type: 'map-target', point: { lat: 46.05, lng: 16.5 } }
        }]
      }]
    })
    const { player, game } = await aged(0, 7, content)
    await state(await player.request(path(game, 'reveal'), {}))
    const live = await state(await player.request(path(game)))
    expect(live.question?.display).toEqual({ type: 'map-target', point: { lat: 46.05, lng: 16.5 } })
  })

  it('bounds payloads and options, validates nicknames, rejects cross-origin writes and rate limits creation and joins', async () => {
    const creator = client()
    for (let i = 0; i < 3; i++) expect((await creator.request('/api/challenges', { nickname: 'Ana' })).status).toBe(201)
    expect((await creator.request('/api/challenges', { nickname: 'Ana' })).status).toBe(429)
    const { game, player } = await create()
    const joiner = client()
    for (let i = 0; i < 3; i++) expect((await joiner.request(path(game, 'join'), { nickname: '<x>' })).status).toBe(400)
    expect((await joiner.request(path(game, 'join'), { nickname: 'Ana' })).status).toBe(429)
    expect((await client().request('/api/challenges', { nickname: 'a'.repeat(9000) })).status).toBe(413)
    const q = await state(await player.request(path(game, 'reveal'), {}))
    expect((await player.request(path(game, 'answer'), { questionId: q.question!.id, selected: 4 })).status).toBe(400)
    expect((await fetch(path(game, 'answer'), { method: 'POST', headers: { 'origin': 'https://other.example', 'content-type': 'application/json', 'cookie': player.cookie }, body: JSON.stringify({ questionId: q.question!.id, selected: 0 }) })).status).toBe(403)
  })
})
