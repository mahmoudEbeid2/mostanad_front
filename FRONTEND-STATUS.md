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
