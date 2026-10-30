// A catalogue version whose AI extraction failed goes back to "segmented" (or to
// "pages_ready" when nothing was read yet) with the reason in `error`. Screens show
// that as its own state, so a status never hides a failure.
export const catalogueVersionStatus = (v) => (["segmented", "pages_ready"].includes(v?.status) && v.error ? "extraction_failed" : v?.status);
