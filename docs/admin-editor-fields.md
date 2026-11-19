# Admin editor fields: what follows the design and what waits

The record editors use the design system's field components (`design-system/components/<Name>/README.md`):

| Component | File | Used in |
| --- | --- | --- |
| FormField | `app/components/admin/FormField.vue` | Every field of the record editors (`*Fields.vue`, `Intangible*.vue`, `KeyedListFields.vue`, `ImageField.vue`) |
| RichTextField | `app/components/admin/RichTextField.vue` | The long texts: descriptions, told texts |
| LookupField | `app/components/admin/LookupField.vue` | Single relations: settlement and Person of a narrator, occasion and custom of a story or custom |
| ImageField | `app/components/admin/ImageField.vue` | The photos of a heritage item |

Each one reads and writes the same values as the field it replaced. Upload paths and the stored data are unchanged.

## Not done here, because it needs a data, upload or storage change

- **RichTextField toolbar** (headings, emphasis, lists, links, dialect word, narrator quotation; `UEditor`). The texts are
  stored and shown as plain text. A toolbar needs a decision on the stored format (Markdown, HTML or Tiptap JSON) and on
  how the public pages render it. Until then the field is a multi-line text with the counter.
- **LookupField inline create** (*Stvori novi …*) and **tokens for many relations** (sources, themes). Creating a row from
  inside another record's form needs a create endpoint that returns the new row to the form. The multi-relation fields
  keep their `USelectMenu` until then.
- **ImageField *Odaberi iz Slika*** (choosing a photo already in the library). There is no library of photos shared
  between records: each photo belongs to one heritage item.
- **ImageField 10 MB limit** from the design copy. Photos are resized in the browser before upload, so no limit on the
  original file is enforced. The rejected-file message names the formats only.
