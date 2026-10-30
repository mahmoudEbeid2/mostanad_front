# Certificates V2 — screen designs (visual reference)

Static HTML mockups of every Certificates V2 screen. Open any file in a browser; links between screens work.
They show **layout, states and copy only**. Behaviour, API, permissions and data rules come from
`mostanad/CERTIFICATES_V2_PLAN.md` — if a mockup and the plan disagree, the plan wins.

Style = the existing app: white sidebar, `gray-50` page, `blue-600` primary, `rounded-xl` cards, Inter,
status pills like `components/certificates/StatusBadge.jsx`. Build with the project's Tailwind + existing
`ui/` components — do not copy these files' inline styles into the app.

| File | Screen | Route (plan §13.1) |
|---|---|---|
| `Flow.html` | The whole flow, both journeys, failure points | — |
| `A1-templates-list.html` | Templates list (system admin) | `/certificates/templates` |
| `A1-templates-list.company-account.html` | Same, logged in as a company | `/certificates/templates` |
| `A2-upload-template.html` | Wizard step 1 — upload + settings + scope (system admin) | `/certificates/templates/new` |
| `A2-upload-template.company-account.html` | Same, company account (company fixed, not a picker) | `/certificates/templates/new` |
| `A3-converting-loader.html` | Conversion progress (convert job stages) + failure example | wizard, while `converting` |
| `A4-mark-fields.html` | Wizard step 2 — mark fields, FieldPanel, "Make field" | wizard step 2 |
| `A5-prepare-test-activate.html` | Wizard step 4 — PrepareReport, test fill, activate | wizard steps 4–5 |
| `B1-upload-invoice.html` | Invoices list + upload (system admin) | `/invoices`, `/invoices/new` |
| `B1-upload-invoice.company-account.html` | Same, company account | `/invoices` |
| `B2-reading-invoice-loader.html` | Extraction + matching progress + failure example | `/invoices/:id` while `extracting` |
| `B3-review-and-match.html` | Review header + lines, product match, plan preview | `/invoices/:id` (`review`) |
| `B4-generating.html` | Batch progress + certificate cards + unassigned lines | `/invoices/:id` batches section |
| `B5-certificate-editor.html` | Certificate editor — values, sources, flags, history, finalize | `/certificates/:id` |
| `C0-catalogue-upload.html` (+ `.file-picked`, `.uploading`, `.checking`, `.ready`, `.failed`) | Catalogue upload step 1 — drop zone, details, upload %, quick PDF check (page count only) | `/catalogues` upload (or `/catalogues/new`) |
| `C1-catalogue-choose-pages.html` | Catalogue upload step 2 — the person chooses the product pages (click, range, preview, token estimate); no auto-detect | catalogue upload, after the file is uploaded |

## Rules the mockups encode

- **Catalogue pages**: a person chooses the product pages — there is no automatic page detection. Only the chosen
  pages are read and sent to the AI. The selection is saved per catalogue; the next version offers "Same pages as last version". Token/cost numbers in C1 are estimates from the cost ledger.

- **System admin / system users**: a Company picker on every certificates page; everything is created for the
  picked company (`?companyId=`). **Company account**: no picker — the company comes from the token and is shown
  read-only. Brand is optional in both and lists only that company's brands.
- **Every background job has a loader screen** (convert, extract/match, generate) with named stages, a progress
  bar, "you can leave this page", and a failure state that shows the backend's real `message` and a next action.
- **Flags** use one style everywhere: `missing` / `overflow` red, `shrunk` / `glyph` / `format` amber.
- Finalize stays disabled while blocking flags remain; the reason is shown under the button.
- Sample data (companies, brands, products, numbers) is invented. The certificate drawn inside the screens is a
  simplified stand-in — the real template HTML is shown through `DocumentFrame`.
