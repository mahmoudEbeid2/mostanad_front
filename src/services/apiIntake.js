import apiClient from "./apiClient";

// Auto-intake ("ارفع ملفاتك"): drop any files → recognised → one review card → "نفّذ الكل".
const data = (p) => p.then((r) => r.data.data);
const message = (err, fallback) => err?.response?.data?.message || err?.message || fallback;

export const createIntake = (companyId = null) => data(apiClient.post("/intake/batches", companyId ? { companyId } : {}));
export const listIntakes = () => data(apiClient.get("/intake/batches")).then((d) => d.batches);
export const getIntake = (batchId) => data(apiClient.get(`/intake/batches/${batchId}`));
export const classifyIntake = (batchId) => data(apiClient.post(`/intake/batches/${batchId}/classify`));
export const decideIntakeItem = (itemId, change) => data(apiClient.patch(`/intake/items/${itemId}`, change)).then((d) => d.item);
export const executeIntake = (batchId, revisions) => data(apiClient.post(`/intake/batches/${batchId}/execute`, { revisions }));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * One file, in chunks, resumable: a lost connection is retried from the bytes the
 * server says it has (409 RESUME_FROM). onProgress(0..1). → the item id
 */
export async function uploadIntakeFile(batchId, file, { relPath = null, chunkBytes = 4 * 1024 * 1024, onProgress, signal } = {}) {
  let item;
  try {
    item = (await data(apiClient.post(`/intake/batches/${batchId}/files`, { name: file.name, size: file.size, relPath }))).item;
  } catch (err) {
    throw new Error(message(err, `${file.name} couldn't be added`));
  }
  let offset = 0;
  let failures = 0;
  while (offset < file.size) {
    if (signal?.aborted) throw new Error("Stopped");
    const blob = file.slice(offset, offset + chunkBytes);
    try {
      const out = await data(
        apiClient.put(`/intake/items/${item.id}/chunk`, blob, {
          params: { offset },
          headers: { "Content-Type": "application/octet-stream" },
          onUploadProgress: (e) => onProgress?.(Math.min(1, (offset + (e.loaded || 0)) / file.size)),
          signal,
        })
      );
      offset = out.receivedBytes;
      failures = 0;
      onProgress?.(offset / file.size);
    } catch (err) {
      const res = err?.response?.data;
      if (err?.response?.status === 409 && typeof res?.receivedBytes === "number") {
        offset = res.receivedBytes; // the server has a different amount: continue from there
        continue;
      }
      if (++failures > 4 || err?.response?.status < 500) throw new Error(message(err, `${file.name} didn't finish uploading`));
      await sleep(800 * failures); // a dropped connection: try the same chunk again
    }
  }
  return item.id;
}

/** Files and folders dropped on a zone → [{ file, relPath }] (folders read recursively). */
export async function filesFromDrop(dataTransfer) {
  const out = [];
  const walk = (entry, prefix) =>
    new Promise((resolve) => {
      if (entry.isFile) entry.file((f) => (out.push({ file: f, relPath: prefix + f.name }), resolve()), () => resolve());
      else if (entry.isDirectory) {
        const reader = entry.createReader();
        const all = [];
        const read = () =>
          reader.readEntries(async (batch) => {
            if (!batch.length) {
              for (const e of all) await walk(e, `${prefix}${entry.name}/`);
              resolve();
            } else {
              all.push(...batch);
              read();
            }
          }, () => resolve());
        read();
      } else resolve();
    });
  const entries = [...(dataTransfer.items || [])].map((i) => i.webkitGetAsEntry?.()).filter(Boolean);
  if (entries.length) {
    for (const e of entries) await walk(e, "");
    return out;
  }
  return [...(dataTransfer.files || [])].map((f) => ({ file: f, relPath: null }));
}

// Express (urgent orders from the chat): what they made that nobody checked yet, and "checked"
/** → { count, orders: [{ batchId, createdAt, conversationId, items: [{ id, entityType, entityId, name, link }] }] } */
export const getExpressToReview = () => data(apiClient.get("/intake/express"));
export const markExpressReviewed = (ids) => data(apiClient.post("/intake/express/reviewed", { ids }));
/** "اعمل قوالب من الملفات دي": the drop's certificate files become templates, Express runs again → { made, restarted } */
export const makeExpressTemplates = (batchId) => data(apiClient.post(`/intake/batches/${batchId}/express/templates-from-files`));
