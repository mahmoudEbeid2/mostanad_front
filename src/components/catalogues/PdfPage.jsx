import { useEffect, useRef, useState } from "react";
import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import Spinner from "../../ui/Spinner";

GlobalWorkerOptions.workerSrc = workerUrl;

/** ArrayBuffer of the kept catalogue → a pdf.js document (load once per version). */
export const openPdf = (data) => getDocument({ data: new Uint8Array(data) }).promise;

// One page of the catalogue, fitted to the container width, with boxes drawn over
// it. Boxes are in PDF points at scale 1 with a top-left origin (the backend's
// `highlights` / `bbox` frame), so they are just multiplied by the render scale.
//   boxes: [{ x, y, w, h, tone: "active" | "field" | "block" }]
const TONES = {
  active: "bg-amber-300/50 ring-2 ring-amber-500",
  field: "bg-sky-300/25",
  block: "ring-2 ring-blue-500/60 ring-offset-0",
};

export default function PdfPage({ pdf, page, boxes = [], scrollTo = null }) {
  const wrap = useRef(null);
  const canvas = useRef(null);
  const [scale, setScale] = useState(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([e]) => setWidth(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!pdf || !page || !width) return undefined;
    let task = null;
    let alive = true;
    pdf.getPage(page).then((p) => {
      if (!alive) return;
      const base = p.getViewport({ scale: 1 });
      const s = width / base.width;
      const vp = p.getViewport({ scale: s * (window.devicePixelRatio || 1) });
      const c = canvas.current;
      c.width = vp.width;
      c.height = vp.height;
      c.style.width = `${base.width * s}px`;
      c.style.height = `${base.height * s}px`;
      task = p.render({ canvasContext: c.getContext("2d"), viewport: vp });
      task.promise.then(() => alive && setScale(s)).catch((err) => err?.name !== "RenderingCancelledException" && console.error("[PdfPage] render failed", err));
    });
    return () => {
      alive = false;
      task?.cancel();
    };
  }, [pdf, page, width]);

  // keep the active quote in view
  useEffect(() => {
    if (!scale || !scrollTo || !wrap.current) return;
    const top = scrollTo.y * scale - 80;
    wrap.current.closest("[data-pdf-scroll]")?.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }, [scale, scrollTo]);

  return (
    <div ref={wrap} className="relative w-full">
      {!scale && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Spinner />
        </div>
      )}
      <canvas ref={canvas} className="block w-full bg-white shadow" />
      {scale &&
        boxes.map((b, i) => (
          <div
            key={i}
            className={`absolute pointer-events-none rounded-sm ${TONES[b.tone] || TONES.field}`}
            style={{ left: b.x * scale - 1, top: b.y * scale - 1, width: b.w * scale + 2, height: b.h * scale + 2 }}
          />
        ))}
    </div>
  );
}
