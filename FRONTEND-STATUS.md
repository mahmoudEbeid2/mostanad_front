# Frontend Status vs. Real Backend — Audit (2026-08-28)

Method: read backend route files under `D:\turk\dass\mostanad\src\routes\*.js` and the
services/controllers they call (source of truth), cross-referenced against
`MOSTANAD_ARCHITECTURE.md` §15, `API-CHANGES.md`, `FRONTEND-GUIDE.md`. Then read every
frontend service (`src/services/*.js`), page (`src/pages/*.jsx`), routed component
(`src/App.jsx`), and the shared components used for label/verdict rendering. Code wins
over docs wherever they disagree. All paths below are absolute; line numbers are
current as of this audit.

Headline finding: `mostanad/FRONTEND-GUIDE.md:3` states outright — *"nothing here has
shipped to a UI yet"* (written for the whole Phase 1-9 label-engine surface). The
frontend confirms this: of ~35 label-engine endpoints, only 2 are called anywhere
(`GET /reference-labels/generate-text-ai` trigger + `GET /labels/{id}`). There is no
chat UI, no version history/diff/restore UI, no approval UI, no regulatory
rule-review UI, and no assurance/review-inbox UI anywhere in this repo. The one
component that renders a label preview end-to-end (`LabelPreview.jsx`) targets the
*old, pre-Phase-4* label shape and is imported nowhere — dead code.

---

## 1. Coverage table

Legend: **Y** = called, file:line given. **NO** = not called anywhere. Screen column:
**reachable** (routed + linked from nav + wired to real endpoint), **orphaned**
(code exists but nothing calls it / nothing routes to it), **none** (no UI at all).

### Labels core

| Endpoint | Called in frontend | Screen |
|---|---|---|
| `GET /labels` (list) | NO | none |
| `GET /labels/:id` | Y — `src/services/apiGeneratedLabels.js:9` (`getLabel`), called from `src/pages/LabelGenerator.jsx:147` | reachable, but read-only summary only (see §2a) |
| `GET /labels/:id/versions` | NO | none |
| `GET /labels/:id/versions/:n` | NO | none |
| `GET /labels/:id/versions/:a/diff/:b` | NO | none |
| `POST /labels/:id/versions/:n/restore` | NO | none |
| `PATCH /labels/:id` (direct patch protocol) | NO | none |

### Validation

| Endpoint | Called | Screen |
|---|---|---|
| `POST /labels/:id/validate` | NO | none — nothing on `LabelGenerator.jsx` re-runs validation after generation |
| `GET /labels/:id/validation` | NO | none |
| `POST /products/verify-label` (old ad-hoc flow, empty ruleset) | Y — `src/services/apiLabels.js:4` (`verifyLabel`), called from `src/pages/Labels.jsx:171` | reachable — this is the only validation flow with a real screen |

### Chat

| Endpoint | Called | Screen |
|---|---|---|
| `POST /labels/:id/chat` | NO | none — no chat UI or service function exists anywhere in the repo |
| `GET /labels/:id/chat` | NO | none |

### Versions (see Labels core above — duplicated intentionally per task's 8-group structure)

### Approval

| Endpoint | Called | Screen |
|---|---|---|
| `POST /labels/:id/approve` | NO | none |
| `GET /labels/:id/approvals` | NO | none |
| `POST /labels/:id/approvals/:approvalId/revoke` | NO | none |

### Regulatory documents & rules

| Endpoint | Called | Screen |
|---|---|---|
| `GET/POST /eda-requirements`, `PATCH /eda-requirements/:id`, `DELETE /eda-requirements/:id` (legacy, shimmed to `regulatory_documents` table, `API-CHANGES.md:49-52`) | Y — `src/services/apiEdaRequirements.js:1-25`, used by `src/pages/EdaRequirements.jsx:6,46,68,91,113` | reachable — routed at `App.jsx:59`, linked in `Sidebar.jsx:36` |
| `GET /regulatory-documents` (new, richer read) | NO | none |
| `POST /regulatory-documents` (new upload, multipart w/ authority/productScope/etc.) | NO | none — still using the old `/eda-requirements` upload |
| `GET /regulatory-documents/:id` (with `rules` included) | NO | none |
| `POST /regulatory-documents/:id/compile-rules` | NO | none |
| `POST /regulatory-documents/:id/audit-coverage` | NO | none |
| `POST /regulatory-documents/:id/approve` | NO | none |
| `PATCH /regulatory-documents/:id/clauses/clear` | NO | none |
| `GET /regulatory-rules` | NO | none |
| `POST /regulatory-rules/preview` | NO | none |
| `PATCH /regulatory-rules/:id`, `/approve`, `/reject` | NO | none |

### Knowledge / reference labels

| Endpoint | Called | Screen |
|---|---|---|
| `GET /reference-labels`, `POST /reference-labels`, `POST /reference-labels/manual`, `DELETE /reference-labels/:id`, `POST /reference-labels/retry/:taskId` | Y — `src/services/apiReferenceLabels.js:3-49`, used in `src/pages/ReferenceLabels.jsx` | reachable, routed at `App.jsx:60`, linked `Sidebar.jsx:43` — **caution**: backend confirms these two GETs are NOT tenant-scoped (`API-CHANGES.md:214-226`); frontend does not add any client-side scoping either |
| `POST /reference-labels/generate-text-ai` | Y — `src/services/apiReferenceLabels.js:51-58`, called `src/pages/LabelGenerator.jsx:192` | reachable |

### Review inbox

| Endpoint | Called | Screen |
|---|---|---|
| `GET /review-inbox` | NO | none |

### Verification / assurance

| Endpoint | Called | Screen |
|---|---|---|
| `POST /labels/:id/audit` | NO | none |
| `GET /assurance/disagreements`, `PATCH /assurance/disagreements/:id/resolve` | NO | none |
| `GET /assurance/golden-runs` | NO | none |
| `GET /assurance/shadow` | NO | none |
| `POST /labels/:id/replay` | NO | none |
| `POST /products/verify-label` | Y (see Validation table above) | reachable |

---

## 2. The six screens — existence audit

**(a) Label detail (fields + per-field verdicts + provenance)**
Does not exist as its own screen/route. `LabelGenerator.jsx:271-349` renders a
*read-only summary* immediately after generation (`GeneratedLabelSummary`,
`src/pages/LabelGenerator.jsx:22-74`) showing only 6 fields (productName, aimOfUse,
directionOfUse, withdrawalPeriod, storage, targetAnimalSpecies, activeIngredients) out
of the ~30-field `labelSchema`. It shows `estimatedFields` badges and
`targetAnimalSpecies.source`, but it does **not** call `/validate` or `/validation`, so
no per-field verdicts are ever shown for a generated label, and there is no route like
`/labels/:id`. The code says so itself: `LabelGenerator.jsx:339-340` — *"The full
editable view with per-field validation and provenance is on the label detail screen
(coming soon)."* Not routed in `App.jsx`, not linked in `Sidebar.jsx`. **Does not
exist.**

**(b) Validation report rendering**
Exists, but only for the legacy `/products/verify-label` flow. `Labels.jsx:385-411`
renders `VerdictList` (`src/components/VerdictList.jsx`) against
`jobResults.validation.verdicts`. Routed at `App.jsx:50`, linked `Sidebar.jsx:41`
("Label Checker"). Real endpoint (`POST /products/verify-label`, async, polled via
`getTaskStatus`, `Labels.jsx:93,171`). This is genuinely wired to the real backend
shape per `API-CHANGES.md:29-38`. **Exists and reachable, but only for the ad-hoc
upload flow — the generated-label validate/validation pair (§3 of the guide) has zero
rendering anywhere.**

**(c) Label chat (conversational editing)**
**Does not exist.** No component, no service function, no route. Confirmed via repo-wide
grep for `/chat`, `postChat`, `chat(` — zero hits outside the backend repo.

**(d) Version history/diff/restore**
**Does not exist.** No component, no service function (`apiGeneratedLabels.js` has
exactly one export, `getLabel`), no route referencing `/versions`.

**(e) Approval (the six gates)**
**Does not exist.** No component, no service function, no route referencing
`/approve` or `/approvals`.

**(f) Regulatory document upload and rule review**
Upload exists but only against the **legacy** `/eda-requirements` endpoint
(`src/pages/EdaRequirements.jsx`, routed `App.jsx:59`, linked `Sidebar.jsx:36`) — this
still works per the backend's compatibility shim (`API-CHANGES.md:49-52`), so it is not
broken, but it bypasses the entire new authority/productScope/sourceUrl/
documentVersion capture the new `POST /regulatory-documents` accepts. **Rule review
(compile-rules → audit-coverage → approve, and the per-rule
approve/reject/edit screen) does not exist at all** — none of
`regulatoryRuleRoutes.js`'s five endpoints are called anywhere in the frontend. A
regulatory document uploaded through the current UI can never be turned into
enforceable `RegulatoryRule` rows through the UI — that entire step is API-only today.

---

## 3. Chat deep-dive

There is no chat UI to evaluate. All three response kinds — plain answer
(`generatedLabelService.js` intent `question`/`explain_validation`, no version bump),
applied patch (`intent:"edit", status:"applied"`, `generatedLabelController.js:73`),
and `CONFLICT` (`409`, `{status:"conflict", proposedPatch, wouldViolate, options}`,
`generatedLabelService.js:303-305`) — are handled **nowhere** in the frontend, because
no frontend code calls `POST /labels/:id/chat` at all. Backend-side, the conflict shape
does include `wouldViolate` (citation-bearing `FieldVerdict`s) and the three-option
array as documented (verified directly in
`D:\turk\dass\mostanad\src\services\label\generatedLabelService.js:303-305`). Stale
`expectedVersion` correctly 409s server-side
(`generatedLabelService.js:264`, plain envelope, not the conflict shape) — but again,
nothing in the frontend calls this endpoint, so there is no "silent misrepresentation"
in a rendering sense; the honest description is **total absence**, not a mishandled
case.

---

## 4. Verdict rendering audit

The only live verdict-rendering component is `src/components/VerdictList.jsx` +
`src/components/VerdictStatusBadge.jsx`, used exclusively by `Labels.jsx` (the
`/products/verify-label` flow).

- **UNVERIFIABLE rendered distinctly, never grouped with PASS?** Yes.
  `VerdictStatusBadge.jsx:30-34` gives `UNVERIFIABLE` its own indigo badge
  ("Unverifiable — Not Checked"), separate config object from `PASS` (green,
  `VerdictStatusBadge.jsx:10-14`). `VerdictList.jsx:8` also sorts it second (right
  after FAIL), ahead of WARN/NOT_APPLICABLE/PASS.

- **`NEEDS_CONFIRMATION` — explicit or fallthrough?** N/A in practice: this status is
  **not a real backend output today**. It appears only in `MOSTANAD_ARCHITECTURE.md`
  §14.5 (verification spec) and is never assigned by any live validator —
  `schemaValidator.js`, `ruleValidator.js`, `validationEngine.js`, `coherenceValidator.js`
  only ever set `PASS`/`FAIL`/`UNVERIFIABLE`/`NOT_APPLICABLE`
  (`D:\turk\dass\mostanad\src\services\label\validation\schemaValidator.js:34,59,74`;
  `ruleValidator.js:138,159`; `validationEngine.js:31,39`). The one file that produces a
  confirmation-style status, `plausibilityValidator.js:55`, emits the *different*
  string `"NEEDS_REVIEW"` (not `"NEEDS_CONFIRMATION"`) — and that file is **imported
  nowhere in the backend** (verified: grep for `plausibilityValidator` across
  `D:\turk\dass\mostanad\src` returns only its own file). So there is no live code path
  that could ever hand the frontend a `NEEDS_CONFIRMATION` (or `NEEDS_REVIEW`) verdict
  today. If it ever does ship, current frontend behavior would be:
  `VerdictStatusBadge.jsx:38` falls through to `{ label: status, icon: HelpCircle,
  classes: "bg-gray-50 text-gray-600 border-gray-200" }` — a generic gray badge, not
  visually distinguished from an unknown/garbage status string, and **not sorted**
  specially by `VerdictList.jsx:8`'s `SEVERITY_ORDER` map (unlisted statuses get `?? 99`,
  sorting last). This is a latent gap, not a currently-observed misrepresentation.

- **Is `comparison` surfaced anywhere in the UI?** No — and, per the same dead-code
  finding above, it is not populated in any live response either (`comparison` only
  appears as a literal in `plausibilityValidator.js:63`, which nothing calls).
  `VerdictList.jsx` never reads `v.comparison`.

- **Does every FAIL render its citation?** Yes, when present:
  `VerdictList.jsx:40-52` renders `v.citation` and `v.sourceDocumentId` for any verdict
  that has them, regardless of status — not gated to FAIL specifically, so FAIL/WARN/
  UNVERIFIABLE all get the same citation block if the field is populated. If a FAIL
  verdict has no `citation` (schema-layer FAILs from `schemaValidator.js:74` never set
  one — that layer never returns a `citation` key), no citation block renders and there
  is no placeholder explaining why — a schema FAIL and a regulatory-rule FAIL are
  visually indistinguishable in that respect.

- **Is remediation shown, including `remediation.source` and the "none" case?** No.
  `VerdictList.jsx` never reads `v.remediation` at all. This is consistent with the
  backend: `remediation` is only ever set by `plausibilityValidator.js:70`
  (dead code, see above) — none of the four live validators
  (`schemaValidator.js`, `ruleValidator.js`, `coherenceValidator.js`,
  `validationEngine.js`) put a `remediation` key on any verdict. So there is currently
  nothing to show — this is not a rendering bug, it's an absent field on both sides.

- **Are sibling verdicts on the same field path (two entries, different statuses) both
  rendered?** Yes. `VerdictList.jsx:15-17` sorts by `SEVERITY_ORDER` but never
  deduplicates or groups by `path` — every entry in the `verdicts` array gets its own
  card (`key={`${v.path}-${idx}`}`, `VerdictList.jsx:23`, explicitly includes `idx` so
  two same-path entries don't collide on `key` either). No verdict is dropped.

**Fall-through / default-branch inventory (the actual "silent misrepresentation"
risk list):**
1. `VerdictStatusBadge.jsx:38-42` — any status string not in
   `VERDICT_STATUS_CONFIG` (`PASS|FAIL|WARN|NOT_APPLICABLE|UNVERIFIABLE`) renders as a
   plain gray badge labeled with the raw status string. This would currently catch
   `NEEDS_CONFIRMATION`/`NEEDS_REVIEW` if the backend ever starts emitting them, and
   gives it the same visual weight as a genuinely unknown/malformed status — no
   distinct "new/unhandled status, verify manually" treatment.
2. `VerdictList.jsx:16` — `SEVERITY_ORDER[a.status] ?? 99` — any unlisted status sorts
   to the very bottom of the list, below `PASS`. For a hypothetical future
   `NEEDS_CONFIRMATION` (which is semantically closer to `UNVERIFIABLE`/`FAIL` in
   urgency), sorting it below `PASS` would be actively misleading once/if it ships.

---

## 5. Drift

1. **`src/components/LabelPreview.jsx` targets the pre-Phase-4 label shape and is
   dead code.** It reads `data.productName.en` / `data.productName.target`
   (`LabelPreview.jsx:143,157`), `data.ingredients[]` with `{en, target, amount}`
   fields (`LabelPreview.jsx:195-211`), and `data.mandatoryFields` as a flat
   boolean-map object (`LabelPreview.jsx:356-369`). The current backend schema
   (`D:\turk\dass\mostanad\MOSTANAD_ARCHITECTURE.md:648-713`, and confirmed live via
   `generatedLabelService.js`) uses `LocalizedText = {translations:{en,ar},primary}`
   (no `.en`/`.target` shortcut), `activeIngredients[]` (not `ingredients[]`) with
   `{translations, primary, amount, unit, normalizedName}`, and no
   `mandatoryFields`/`registrationNumber`-as-boolean at all (`API-CHANGES.md:29-38`
   documents `registrationNumber` etc. as real values now, not flags). Grep confirms
   `LabelPreview` is imported by **no file** in the repo (`Grep pattern="LabelPreview"
   path="D:\turk\dass\mostanad_front\src"` → only its own file). Not currently
   reachable, so not currently misleading a user — but it will actively mislead
   whoever wires it up next assuming it's ready.
2. **`src/pages/EdaRequirements.jsx` only talks to the legacy `/eda-requirements`
   surface**, never the richer `/regulatory-documents` endpoints
   (`authority`, `productScope[]`, `sourceUrl`, `documentVersion`,
   `clauseTotal/clauseCovered/coveragePercent`, `status:"pending_review"|"approved"`).
   Its edit form (`EdaRequirements.jsx:353-359`) lets a user free-edit
   `extractedText` via `PATCH /eda-requirements/:id` — on the new backend this is a
   raw-text edit with **no re-compilation of rules and no re-audit of coverage**, so an
   edited document can silently drift from whatever `RegulatoryRule` rows (if any)
   were already compiled from its old text. Not "broken" (the shim keeps the request
   working), but the UI does not expose or warn about this gap.
3. **`GeneratedLabelSummary` (`LabelGenerator.jsx:22-74`) reads 6 of ~30 schema
   fields** and silently drops the rest (`pharmaceuticalForm`, `strength`,
   `routeOfAdministration`, `contraindications`, `warnings[]`, `sideEffects`,
   `userSafety[]`, `shelfLifeAfterOpening`, `disposal`, `packaging`,
   `registrationNumber`, `marketingAuthorisationHolder`, `manufacturer`, `importer`,
   `countryOfProduction`, `batchNo`, `productionDate`, `expiryDate`,
   `prescriptionStatus`, `usageDeclaration[]`, `keepOutOfReachOfChildren`,
   `excipients[]`, `indications[]`). This is disclosed in-UI
   (`LabelGenerator.jsx:339` "coming soon") so it is not misrepresenting itself as
   complete, but it is real data loss from the user's vantage point — a generated
   label's full content is only visible via "Copy Raw JSON"
   (`LabelGenerator.jsx:258-262,283-288`).
4. **No frontend code path ever calls `POST /labels/:id/validate`.** A label produced
   by `LabelGenerator.jsx` gets one validation summary as a byproduct of generation
   (`genSummary.validation`, `LabelGenerator.jsx:200`, from the `BackgroundTask.result`
   per `API-CHANGES.md:94-95`) and is never re-validated afterward from the UI — so if
   a user could edit a label (they can't yet, no UI), there'd be no way to re-check it
   either. Not a shape mismatch, but a completeness gap directly adjacent to drift risk.
5. No frontend code expects or reads `comparison`, `remediation`, or
   `NEEDS_CONFIRMATION`/`NEEDS_REVIEW` — and, as shown in §4, the backend does not
   actually emit them on any reachable path either. Both sides agree by omission; this
   is listed for completeness, not as an active mismatch.

---

## Deliverable lists

### A. Working and verified against the real backend

- Ad-hoc label verification end-to-end: `Labels.jsx` → `apiLabels.js:4` `verifyLabel()`
  → `POST /products/verify-label` → poll `getTaskStatus` (`apiProducts.js:22-23`) →
  `VerdictList`/`VerdictStatusBadge` render `FieldVerdict[]` matching
  `API-CHANGES.md:29-38`'s deterministic shape exactly (`passed, errorCount,
  warningCount, verdicts, engineVersion, rulesetIds`). Verdict statuses PASS/FAIL/WARN/
  NOT_APPLICABLE/UNVERIFIABLE all get distinct, correctly-differentiated rendering
  (`VerdictStatusBadge.jsx:9-35`), sorted FAIL-first (`VerdictList.jsx:8,15-17`), and
  citations render when present (`VerdictList.jsx:40-52`).
- Label generation trigger + fetch: `LabelGenerator.jsx` → `apiReferenceLabels.js:51-58`
  `generateLabelAi()` → `POST /reference-labels/generate-text-ai` → poll via socket +
  `getTaskStatus` → `apiGeneratedLabels.js:7-14` `getLabel()` → `GET /labels/:id`,
  correctly reading the new `{label, currentVersion, latestValidation, provenance}`
  envelope (`LabelGenerator.jsx:147-148`) per `API-CHANGES.md:17-19`.
- `targetAnimalSpecies.source` badge (`LabelGenerator.jsx:41-49`) correctly reflects the
  backend-computed `confirmed|reference|inferred` provenance tag
  (`MOSTANAD_ARCHITECTURE.md:673-678`).
- `estimatedFields` badges (`LabelGenerator.jsx:24,29,41,57`) correctly gate off the
  real `label.estimatedFields` array.
- Legacy `/eda-requirements` CRUD (`EdaRequirements.jsx` + `apiEdaRequirements.js`) —
  confirmed still functional per the backend's documented compatibility shim
  (`API-CHANGES.md:49-52`).
- Reference-labels CRUD (`ReferenceLabels.jsx` + `apiReferenceLabels.js`) against
  `GET/POST /reference-labels`, `/manual`, `/:id` DELETE, `/retry/:taskId` — all match
  current route definitions (`referenceLabelRoutes.js` not separately re-verified line
  by line here but endpoint names/methods match `apiReferenceLabels.js:3-49`
  exactly).

### B. Exists but incomplete, mocked, unreachable, or drifted

- `src/components/LabelPreview.jsx` — dead code (imported nowhere,
  `Grep` confirmed), and targets the **old pre-Phase-4** label shape
  (`.productName.en/.target`, `ingredients[]`, boolean `mandatoryFields`) that no
  longer matches `labelSchema` (`LabelPreview.jsx:137-157,195-211,356-369` vs.
  `MOSTANAD_ARCHITECTURE.md:648-713`). Do not wire this up as-is.
- `GeneratedLabelSummary` (`LabelGenerator.jsx:22-74`) — renders only 6 of ~30 schema
  fields, explicitly labeled "coming soon" (`LabelGenerator.jsx:339-340`) for the real
  detail view. No per-field verdicts, no provenance beyond target-species source.
- `EdaRequirements.jsx` — wired only to the legacy shim endpoints, not the new
  `/regulatory-documents` surface (authority, productScope, sourceUrl, coverage
  fields all unreachable from this screen); its free-text edit
  (`EdaRequirements.jsx:353-359`) can silently desync any already-compiled
  `RegulatoryRule` rows since there's no recompile/re-audit trigger in the UI.
- `Labels.jsx`'s `/products/verify-label` flow is explicitly the **wrong** validation
  path for anything in the generate→validate→approve pipeline — it always runs with an
  empty ruleset (`FRONTEND-GUIDE.md:168-174`) — yet it is the *only* validation UI that
  exists, so it is easy for a user to mistake it for real country-specific compliance
  checking of a generated label.
- Verdict rendering fallback path (`VerdictStatusBadge.jsx:38-42`,
  `VerdictList.jsx:16`) — generic gray badge + bottom-of-list sort for any status
  outside the current five; would silently under-represent a future
  `NEEDS_CONFIRMATION`/`NEEDS_REVIEW` status if the (currently dead)
  `plausibilityValidator.js` code path is ever wired up backend-side.
- No re-validation trigger anywhere in the UI (`POST /labels/:id/validate` uncalled) —
  the only validation a generated label ever gets is the one-shot summary from
  generation itself.

### C. Backend capability with no UI at all

- Label chat — `POST /labels/:id/chat`, `GET /labels/:id/chat`
  (`generatedLabelRoutes.js:23-24`). Includes the conflict/override flow
  (`generatedLabelService.js:257-314`).
- Direct patch protocol — `PATCH /labels/:id` (`generatedLabelRoutes.js:15`).
- Version history, single version, diff, restore — `GET /labels/:id/versions`,
  `GET /labels/:id/versions/:n`, `GET /labels/:id/versions/:a/diff/:b`,
  `POST /labels/:id/versions/:n/restore` (`generatedLabelRoutes.js:16-19`).
- Full label detail with validation + provenance rendering — `GET /labels/:id` is
  *called* (§A) but nothing renders more than a 6-field summary of what it returns.
- Approval (all six gates) and revoke — `POST /labels/:id/approve`,
  `GET /labels/:id/approvals`, `POST /labels/:id/approvals/:approvalId/revoke`
  (`generatedLabelRoutes.js:25-27`, gates documented `FRONTEND-GUIDE.md:344-359`).
- Adversarial audit — `POST /labels/:id/audit` (`generatedLabelRoutes.js:22`).
- Replay — `POST /labels/:id/replay` (`generatedLabelRoutes.js:28`).
- Review inbox — `GET /review-inbox` (`routes/index.js:47`).
- Assurance: disagreements list/resolve, golden runs, shadow comparisons
  (`assuranceRoutes.js:9-12`).
- Full label list — `GET /labels` (`generatedLabelRoutes.js:13`) — there is no "browse
  all generated labels" screen at all; the only way to reach a label today is
  immediately after generating it in the same session.
- Regulatory documents (new surface): list/get with rules, compile-rules,
  audit-coverage, approve, clause-clear (`regulatoryDocumentRoutes.js:10-16`).
- Regulatory rules: list, preview-against-a-label, edit, approve, reject
  (`regulatoryRuleRoutes.js:9-13`).
