# Frontend Status vs. Real Backend — Audit & Progress Report (Updated)

Method: read backend route files under `D:\turk\dass\mostanad\src\routes\*.js` and the
services/controllers they call (source of truth), cross-referenced against
`MOSTANAD_ARCHITECTURE.md` §15, `API-CHANGES.md`, `FRONTEND-GUIDE.md`.

---

## 1. Current Coverage Table

| Endpoint | Status | Screen / Component | Notes |
|---|---|---|---|
| `GET /labels` (list) | **Y** | `src/pages/LabelsList.jsx` (`/labels/browse`) | Reachable via Sidebar "Generated Labels" |
| `GET /labels/:id` | **Y** | `src/pages/LabelDetail.jsx` (`/labels/detail/:id`) | Full ~30 fields with verdicts & provenance |
| `POST /labels/:id/validate` | **Y** | `src/pages/LabelDetail.jsx` | Re-run validation button |
| `GET /labels/:id/validation` | **Y** | `src/services/apiGeneratedLabels.js` | Loaded via label envelope |
| `GET /labels/:id/versions` | **Y** | `src/components/label-detail/VersionsTab.jsx` | Reachable in Versions tab |
| `GET /labels/:id/versions/:n` | **Y** | `src/services/apiGeneratedLabels.js` | Version detail lookup |
| `GET /labels/:id/versions/:a/diff/:b` | **Y** | `src/components/label-detail/DiffView.jsx` | Interactive side-by-side diff |
| `POST /labels/:id/versions/:n/restore` | **Y** | `src/components/label-detail/VersionsTab.jsx` | Forward-only restore with confirmation |
| `PATCH /labels/:id` (direct patch protocol) | **Y** | `src/components/label-detail/EditFieldModal.jsx` | Direct field edit with 409 conflict handling |
| `POST /labels/:id/chat` | **Y** | `src/components/label-detail/ChatTab.jsx` | Answers, applied patches, and 409 conflicts |
| `GET /labels/:id/chat` | **Y** | `src/components/label-detail/ChatTab.jsx` | Chat message history |
| `POST /labels/:id/approve` | **Y** | `src/components/label-detail/ApprovalTab.jsx` | Evaluates all 6 gates; per-field signatures |
| `GET /labels/:id/approvals` | **Y** | `src/components/label-detail/ApprovalTab.jsx` | History of approvals & promoted references |
| `POST /labels/:id/approvals/:id/revoke` | **Y** | `src/components/label-detail/ApprovalTab.jsx` | Revocation modal with reason & affected count |
| `GET /labels/:id/extraction` | **Y** | `src/components/label-detail/ExtractionTab.jsx` | §14.5 OCR confidence, visual snippets |
| `POST /labels/:id/confirm-field` | **Y** | `src/components/label-detail/ExtractionTab.jsx` | Fact confirmation (sets 100% confidence) |
| `GET /regulatory-documents` | **Y** | `src/pages/RegulatoryDocuments.jsx` | List regulations with coverage progress |
| `POST /regulatory-documents` | **Y** | `src/pages/RegulatoryDocuments.jsx` | Multipart PDF upload with authority metadata |
| `GET /regulatory-documents/:id` | **Y** | `src/pages/RegulatoryDocuments.jsx` | Document detail with compiled rules & clauses |
| `POST /regulatory-documents/:id/compile-rules` | **Y** | `src/pages/RegulatoryDocuments.jsx` | AI rule compiler from document text |
| `POST /regulatory-documents/:id/audit-coverage` | **Y** | `src/pages/RegulatoryDocuments.jsx` | Clause coverage auditor |
| `PATCH /regulatory-documents/:id/clauses/clear` | **Y** | `src/pages/RegulatoryDocuments.jsx` | Clear individual uncovered clauses |
| `POST /regulatory-documents/:id/approve` | **Y** | `src/pages/RegulatoryDocuments.jsx` | Hard gate: blocked if coverage < 95% |
| `GET /regulatory-rules` | **Y** | `src/pages/RegulatoryDocuments.jsx` | Listed with quoted verbatim citations |
| `PATCH /regulatory-rules/:id/approve` | **Y** | `src/pages/RegulatoryDocuments.jsx` | Approve individual rule |
| `PATCH /regulatory-rules/:id/reject` | **Y** | `src/pages/RegulatoryDocuments.jsx` | Reject individual rule |
| `POST /reference-labels/generate-text-ai` | **Y** | `src/pages/LabelGenerator.jsx` | Triggers AI generation pipeline |
| `GET /reference-labels`, `POST /reference-labels` | **Y** | `src/pages/ReferenceLabels.jsx` | Reference labels management |

---

## 2. Honest Remaining List (Unbuilt Backend Surfaces)

The following backend endpoints exist in `mostanad` backend routes but do not yet have dedicated UI screens in `mostanad_front`:

1. **Review Inbox (`GET /review-inbox`)**:
   - Backend has the risk-ranked single queue (`GET /review-inbox`) for labels requiring review (`batch_review`, `mandatory_review`, `dual_review`).
2. **Assurance & Adversarial Disagreements (`GET/PATCH /assurance/disagreements`, `GET /assurance/golden-runs`, `GET /assurance/shadow`)**:
   - Backend has endpoints to inspect model disagreements, golden benchmark runs, and shadow comparison records.
3. **Adversarial Audit Trigger (`POST /labels/:id/audit`) & Replay (`POST /labels/:id/replay`)**:
   - Backend supports on-demand adversarial auditing and determinism replays.

---

## Certificates V2 — manual QA script (CERTIFICATES_V2_PLAN.md §16.3)

Automated equivalent: `node tests/certificates-v2/ui-smoke.mjs --user <qa> --password-file <file>` in the backend repo (phases 1–5 and 7 with `--phase 7`, 146 checks incl. 17 accessibility audits and a company-account pass). Run against a fresh `npm run dev:test` (writes `.test-bypass-secret`) + `npx vite`. The login is a throwaway local Admin — create it for the run, delete it after. Every step: no console errors; every failure shows the backend's message.

Run every screen twice: as a **system admin** (indigo "System admin" banner, company picker) and as a **company account** (green "Company account · <name>" banner, the company's name read-only where the picker would be, Certificates in the sidebar, no 403/redirect on any certificates page).

**Accessibility, every screen:** Tab reaches every control with a visible focus ring; every input/select has a label (a placeholder alone doesn't count); icon-only buttons announce a name; progress bars read their value (convert, invoice reading, prepare, generation); stage lists say done / in progress / not started; flags are words (code pill + sentence), never colour alone.

| Screen | Route | Check |
|---|---|---|
| Types | `/certificates/types` | Empty state → "New type" → create COA; edit; deactivate; delete an unused type; deleting a used one is refused with the reason. |
| Templates list | `/certificates/templates` | Empty states (no types → link to Types; no templates → upload); filter card (Company · Type · Brand) + status pills; cards show thumbnail, type/brand/country/scope pills, status hint, version line, status-specific action; an active card reads "N fields · round-trip x %" (a ready one shows it under "Passed the gate"); dashed "Upload a design" tile; archive. |
| Wizard · upload | `/certificates/templates/new` | Upload ADDVET `.ai` → named conversion stages → sanitized preview (pixel-identical); a non-PDF `.ai` → "Create PDF Compatible File" hint; outlined text → "converted to outlines" hint; same slot twice → "Open it" link. |
| Wizard · fields | `…/versions/:id?step=fields` | Select a value → floating "Make field"; Ctrl-select two → "Make fields (2)"; a 2-line selection → 2 fields; highlights never alter the document; label → key slug; source picker; date format only for date sources; autosave "All changes saved". |
| Wizard · settings / prepare | `?step=settings`, `?step=prepare` | Slot warning names the template to be superseded; Prepare → gate report (pass/fail per check, per-field Δ, diff image); test fill from a product, an optional **Invoice item** (confirmed invoices' lines, grouped by invoice, ignored lines left out — its values render; clearing it falls back to the product / typed values) and ad-hoc values, flags inline. |
| Wizard · activate | `?step=activate` | Lists what is superseded; unconfirmed fields block it; after: "Generate certificates from an invoice". |
| Invoices | `/invoices` | Upload panel (Company as the first field — read-only name for a company account —, brand hint, destination country) + recent invoices; search by number/customer; action per status (View progress / Review / Open / See error). |
| Invoice reading | `/invoices/:id` (extracting) | Original beside the 3 named stages, progress bar and the review-screen skeleton; failure card quotes the real reason, "No certificates were created", Try again. |
| Invoice review | `/invoices/:id` (review/ready) | Original beside details; "edited" chips; amber ambiguous dates; needs-match banner; cells edit in place (Enter saves, Esc reverts); ✓ code / name / you chips; candidates with scores + catalogue search; ignore / use again; add / delete line; Confirm & continue disabled until every line is matched or ignored; plan preview + gaps with "Create template". |
| Generation | `/invoices/:id?batch=` | "Generate N certificates" → progress "x of N", ready / needs attention / rendering / failed counts, cards with thumbnails, gaps banner, Download all (ZIP), Generate again (new run, run selector). |
| Generated certificates | `/certificates` | Filters (search, type, status, only with issues), paging, cards link to the editor. |
| Editor | `/certificates/:id` | Server render in the frame; typing updates it instantly, saved after 1 s ("Saved hh:mm", vN+1); Esc reverts; Ctrl+S; edit from another session → conflict dialog (Reload / Overwrite with mine); reset to source; Versions drawer (view old = read-only banner; restore = new version); Export PDF downloads `{type}-{product}-{batch}.pdf`; Finalize disabled with "N issues left"; final = read-only + Download PDF + Duplicate as draft. |
| Repeating groups · marking | `…/versions/:id?step=fields` | On a PNG version the "Repeating groups" card explains why a new version is needed → "Enable repeating groups" opens v N+1 converting, then its fields step. Mark ONE row's cells (e.g. "Vitamin E", "120000 mg") as fields → "Add group" → Rows come from (a list on the product for per-product templates, the invoice lines for per-invoice, typed) → in each cell's editor "Row of group" + a row path → "Detected: a list inside one table cell · 3 sample rows · up to N rows fit"; the band is tinted and a dashed **footer line** is drawn: drag it (or focus it and use ↑/↓, Shift = 10 px) → "Yours at … px", fewer rows fit; "Use the proposal" resets it. A design whose rules can't be told apart shows the reason in red with "Use fixed rows instead". When empty: dash / hide. |
| Repeating groups · editor | `/certificates/:id` | The group is a rows table (cells as columns), not single fields; Add row / move up / move down / delete / type → saved as a new version each time, the frame re-renders from the server (rows, moved content); reset puts back the list's rows; too many rows → red "Only N rows fit…" and Finalize disabled; a character missing from the design font → "Character not in the design font: B". |
