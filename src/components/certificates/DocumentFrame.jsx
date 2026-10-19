import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";
import Spinner from "../../ui/Spinner";

// The ONE way certificate/template HTML is shown in the app (plan §13.3).
//  - HTML is loaded through the authorised API client (`load()` returns the
//    string) and written into a sandboxed about:blank frame with
//    document.open/write — never srcDoc, never innerHTML in the app DOM.
//    (A blob: URL frame is treated as cross-origin by current Chrome, so the
//    parent could not read the DOM for selection — plan §20 I5.)
//  - <iframe sandbox="allow-same-origin"> without allow-scripts: the parent may
//    read the DOM (selection, highlighting); the document can execute nothing
//  - viewer-only CSS goes in an injected <style data-viewer>; the document
//    itself is never mutated for viewing
//  - zoom-to-fit is a CSS transform on the wrapper; selection still works
const VIEWER_CSS = `
html,body{margin:0!important;padding:0!important;background:#fff!important}
#sidebar,.loading-indicator{display:none!important}
#page-container{position:static!important;overflow:visible!important;background:none!important;top:auto!important;left:auto!important;bottom:auto!important;right:auto!important}
.pf{margin:0!important;box-shadow:none!important;border:0!important}
[data-page]+[data-page]{border-top:8px solid #e5e7eb!important}
::selection{background:rgba(37,99,235,.28)}`;

const STR = {
  loading: "Loading document…",
  failed: "Couldn't load the document",
  page: "Page",
  zoomIn: "Zoom in",
  zoomOut: "Zoom out",
  fit: "Fit",
};

//  - `overlay(scale)` renders above the document in the frame's coordinate
//    space (unscaled document px) — field highlights fallback, the floating
//    "Make field" button. It never touches the document.
//  - `hint`: optional instruction shown at the left of the toolbar
export default function DocumentFrame({ load, reloadKey, onReady, overlay, hint, fit = true, className = "", minHeight = 480, title = "Document preview" }) {
  const containerRef = useRef(null);
  const frameRef = useRef(null);
  const [html, setHtml] = useState(null);
  const [error, setError] = useState(null);
  const [size, setSize] = useState({ width: 0, height: 0, pages: [] });
  const [zoom, setZoom] = useState(null); // null = fit
  const [fitScale, setFitScale] = useState(1);
  const [page, setPage] = useState(1);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    let alive = true;
    setError(null);
    setHtml(null);
    Promise.resolve(loadRef.current())
      .then((text) => alive && setHtml(String(text)))
      .catch((err) => alive && setError(err.message || STR.failed));
    return () => {
      alive = false;
    };
  }, [reloadKey]); // reloadKey decides when to refetch; load() is read through a ref

  const measureFit = useCallback(() => {
    const el = containerRef.current;
    if (!el || !size.width) return;
    setFitScale(Math.min(1.5, Math.max(0.2, (el.clientWidth - 24) / size.width)));
  }, [size.width]);

  useEffect(() => {
    measureFit();
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(measureFit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measureFit]);

  const handleLoad = useCallback(() => {
    const frame = frameRef.current;
    const doc = frame?.contentDocument;
    if (!doc) return;
    const st = doc.createElement("style");
    st.setAttribute("data-viewer", "");
    st.textContent = VIEWER_CSS;
    doc.head.appendChild(st);
    const pageEls = Array.from(doc.querySelectorAll("[data-page]"));
    const pages = pageEls.map((p) => ({ page: Number(p.getAttribute("data-page")), top: p.offsetTop, width: p.offsetWidth, height: p.offsetHeight }));
    const width = pages.length ? Math.max(...pages.map((p) => p.width)) : doc.documentElement.scrollWidth;
    const height = doc.documentElement.scrollHeight;
    setSize({ width, height, pages });
    setPage(1);
    onReadyRef.current?.({ doc, frame, pages });
  }, []);

  // write the document into the sandboxed frame, then wait for its fonts/images
  // The iframe stays mounted across reloads: a newly inserted src-less frame
  // navigates to about:blank asynchronously in Chrome, and that navigation can
  // replace a document written into it right away (seen as an intermittently
  // blank frame after a save). If the written document was replaced anyway,
  // it is written once more.
  useEffect(() => {
    const frame = frameRef.current;
    if (html === null || !frame) return undefined;
    let cancelled = false;
    const write = () => {
      const doc = frame.contentDocument;
      if (!doc) return null;
      doc.open();
      doc.write(html);
      doc.close();
      doc.documentElement.setAttribute("data-viewer-written", "");
      return doc;
    };
    const settle = (doc) =>
      new Promise((resolve) => {
        if (doc.readyState === "complete") resolve();
        else frame.contentWindow?.addEventListener("load", resolve, { once: true });
        setTimeout(resolve, 4000);
      });
    (async () => {
      let doc = write();
      if (!doc) return;
      await settle(doc);
      if (cancelled) return;
      if (!frame.contentDocument?.documentElement?.hasAttribute("data-viewer-written")) {
        doc = write(); // replaced by the frame's initial about:blank navigation
        if (!doc) return;
        await settle(doc);
      }
      await doc.fonts?.ready;
      if (!cancelled) handleLoad();
    })();
    return () => {
      cancelled = true;
    };
  }, [html, handleLoad]);

  const scale = zoom ?? (fit ? fitScale : 1);

  const goTo = (n) => {
    const p = size.pages.find((x) => x.page === n);
    if (!p || !containerRef.current) return;
    setPage(n);
    containerRef.current.scrollTo({ top: p.top * scale, behavior: "smooth" });
  };

  return (
    <div className={`flex flex-col rounded-xl border border-gray-200 bg-gray-100 overflow-hidden ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-white border-b border-gray-200 text-xs text-gray-600">
        <div className="flex items-center gap-3">
          {hint}
          {size.pages.length > 1 && (
            <>
              <button type="button" className="p-1 rounded hover:bg-gray-100 disabled:opacity-40" disabled={page <= 1} onClick={() => goTo(page - 1)} aria-label="Previous page">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span>
                {STR.page} {page} / {size.pages.length}
              </span>
              <button type="button" className="p-1 rounded hover:bg-gray-100 disabled:opacity-40" disabled={page >= size.pages.length} onClick={() => goTo(page + 1)} aria-label="Next page">
                <ChevronRight className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button type="button" className="p-1 rounded hover:bg-gray-100" onClick={() => setZoom(Math.max(0.2, +(scale - 0.1).toFixed(2)))} aria-label={STR.zoomOut}>
            <Minus className="w-4 h-4" />
          </button>
          <span className="w-12 text-center tabular-nums">{Math.round(scale * 100)}%</span>
          <button type="button" className="p-1 rounded hover:bg-gray-100" onClick={() => setZoom(Math.min(3, +(scale + 0.1).toFixed(2)))} aria-label={STR.zoomIn}>
            <Plus className="w-4 h-4" />
          </button>
          <button type="button" className={`px-2 py-0.5 rounded ${zoom === null ? "bg-blue-50 text-blue-700" : "hover:bg-gray-100"}`} onClick={() => setZoom(null)}>
            {STR.fit}
          </button>
        </div>
      </div>

      <div ref={containerRef} className="relative flex-1 overflow-auto p-3" style={{ minHeight }}>
        {error && <div className="p-6 text-sm text-red-600">{STR.failed}: {error}</div>}
        {!error && html === null && (
          <div className="absolute inset-x-0 top-0 z-10 flex items-center gap-3 p-6 text-sm text-gray-500">
            <Spinner size="sm" /> {STR.loading}
          </div>
        )}
        {!error && (
          <div style={{ width: size.width * scale, height: size.height * scale, visibility: html === null && !size.width ? "hidden" : "visible", opacity: html === null ? 0.4 : 1 }} className="mx-auto">
            <div style={{ width: size.width, height: size.height, transform: `scale(${scale})`, transformOrigin: "0 0" }} className="relative bg-white shadow-md">
              <iframe
                ref={frameRef}
                title={title}
                sandbox="allow-same-origin"
                style={{ width: size.width || 800, height: size.height || 1100, border: 0, display: "block" }}
              />
              {overlay && size.width > 0 && <div className="absolute inset-0 pointer-events-none">{overlay(scale)}</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
