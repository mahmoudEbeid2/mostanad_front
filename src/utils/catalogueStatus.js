// A catalogue version whose AI extraction failed goes back to "segmented" with
// the reason in `error` (backend: the blocks are kept). Screens show that as
// its own state, so "segmented" never hides a failure.
export const catalogueVersionStatus = (v) => (v?.status === "segmented" && v.error ? "extraction_failed" : v?.status);
