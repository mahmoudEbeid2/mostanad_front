// Upload size limits, in ONE place (UI plan, Phase G: one size limit everywhere). The target is UPLOAD_LIMIT_MB
// for every upload; until the server accepts it on every route (BACKEND_API_TODO.md §8), a route that still
// refuses less keeps its own cap here — and every screen says the same sentence with the right number.
import { fmtNum, t } from "../i18n";

export const UPLOAD_LIMIT_MB = 60;
const SERVER_CAP_MB = { invoice: 15, labelResize: 40 };

export const limitMb = (kind) => SERVER_CAP_MB[kind] ?? UPLOAD_LIMIT_MB;
export const limitBytes = (kind) => limitMb(kind) * 1024 * 1024;

/** → null, or "This file is 72 MB — the limit is 60 MB." */
export function tooBig(file, kind) {
  if (!file || file.size <= limitBytes(kind)) return null;
  return t("uploadLimit.tooBig", { mb: fmtNum(Math.round((file.size / 1024 / 1024) * 10) / 10), limit: limitMb(kind) });
}
