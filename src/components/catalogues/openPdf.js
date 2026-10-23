import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = workerUrl;

/** ArrayBuffer of the kept catalogue → a pdf.js document (load once per version). */
export const openPdf = (data) => getDocument({ data: new Uint8Array(data) }).promise;
