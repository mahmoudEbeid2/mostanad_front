import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus } from "lucide-react";

// Field marking on the sanitized design (plan §13.4 step 2). Runs against the
// sandboxed DocumentFrame document (read-only: nothing is written into it
// except viewer-only highlight styles):
//  - a text selection becomes one draft per line it crosses (§7.3: the engine
//    only takes single-line fields), trimmed, never overlapping a field
//  - Ctrl/⌘-select adds to a pending multi-selection → "Make fields (n)"
//  - Enter makes the field(s), Esc clears the pending selection
//  - fields are shown with the CSS Custom Highlight API; overlay boxes when
//    the browser lacks it; clicking a field's text selects it in the panel
// Offsets are character offsets in each line's textContent — the same string
// the backend validates against (§8.2). No geometry is computed or saved here (D11).

const STR = { make: "Make field", makeN: (n) => `Make fields (${n})` };
const HL_STYLE = `::highlight(cert-field){background-color:rgba(250,204,21,.45)}
::highlight(cert-field-active){background-color:rgba(37,99,235,.35)}
::highlight(cert-pending){background-color:rgba(16,185,129,.35)}`;

function textNodes(el) {
  const out = [];
  const w = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  while (w.nextNode()) out.push(w.currentNode);
  return out;
}

/** Range over [start, end) of a line's textContent (mirror of the engine's rangeFromOffsets). */
function rangeFor(doc, lineId, start, end) {
  const line = doc.querySelector(`[data-line="${CSS.escape(lineId)}"]`);
  if (!line) return null;
  const r = doc.createRange();
  let pos = 0;
  let started = false;
  for (const n of textNodes(line)) {
    const len = n.data.length;
    if (!started && start < pos + len) {
      r.setStart(n, start - pos);
      started = true;
    }
    if (started && end <= pos + len) {
      r.setEnd(n, end - pos);
      return r;
    }
    pos += len;
  }
  return null;
}

function offsetIn(doc, line, container, offset) {
  const r = doc.createRange();
  r.setStart(line, 0);
  r.setEnd(container, offset);
  return r.toString().length;
}

/** Selection range → [{ lineId, page, charStart, charEnd, sampleValue }] (one per line, trimmed). */
function segmentsOf(doc, range) {
  const out = [];
  for (const line of doc.querySelectorAll("[data-line]")) {
    if (!range.intersectsNode(line)) continue;
    const text = line.textContent;
    let s = line.contains(range.startContainer) ? offsetIn(doc, line, range.startContainer, range.startOffset) : 0;
    let e = line.contains(range.endContainer) ? offsetIn(doc, line, range.endContainer, range.endOffset) : text.length;
    while (s < e && /\s/.test(text[s])) s++;
    while (e > s && /\s/.test(text[e - 1])) e--;
    if (e <= s) continue;
    const page = Number(line.closest("[data-page]")?.getAttribute("data-page")) || 1;
    out.push({ lineId: line.getAttribute("data-line"), page, charStart: s, charEnd: e, sampleValue: text.slice(s, e) });
  }
  return out;
}

const overlaps = (a, b) => a.lineId === b.lineId && a.charStart < b.charEnd && b.charStart < a.charEnd;

export default function FieldMarker({ frameInfo, fields, activeKey, onMake, onSelect, disabled, scale }) {
  const [pending, setPending] = useState([]);
  const [anchor, setAnchor] = useState(null); // { x, y } in document px
  const [boxes, setBoxes] = useState([]); // fallback highlight rects
  const fieldsRef = useRef(fields);
  fieldsRef.current = fields;
  const pendingRef = useRef(pending);
  pendingRef.current = pending;
  const doc = frameInfo?.doc;
  const win = doc?.defaultView;
  const hasHighlights = !!(win && win.CSS && win.CSS.highlights && win.Highlight);

  const make = useCallback(() => {
    if (!pendingRef.current.length) return;
    onMake(pendingRef.current);
    setPending([]);
    setAnchor(null);
    doc?.getSelection()?.removeAllRanges();
  }, [onMake, doc]);

  // selection handling inside the frame
  useEffect(() => {
    if (!doc || disabled) return undefined;
    const onUp = (e) => {
      const sel = doc.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) {
        // a plain click on a field's text selects it in the panel
        const caret = doc.caretRangeFromPoint?.(e.clientX, e.clientY);
        const line = caret?.startContainer?.parentElement?.closest?.("[data-line]");
        if (line && e.type === "mouseup") {
          const off = offsetIn(doc, line, caret.startContainer, caret.startOffset);
          const hit = fieldsRef.current.find((f) => f.lineId === line.getAttribute("data-line") && f.charStart <= off && off <= f.charEnd);
          if (hit) onSelect?.(hit.key);
        }
        if (!(e.ctrlKey || e.metaKey)) {
          setPending([]);
          setAnchor(null);
        }
        return;
      }
      const range = sel.getRangeAt(0);
      const segs = segmentsOf(doc, range).filter((s) => !fieldsRef.current.some((f) => overlaps(f, s)));
      const additive = e.ctrlKey || e.metaKey;
      const next = additive ? [...pendingRef.current.filter((p) => !segs.some((s) => overlaps(p, s))), ...segs] : segs;
      setPending(next);
      const r = range.getBoundingClientRect();
      setAnchor(next.length ? { x: r.right + doc.defaultView.scrollX, y: r.bottom + doc.defaultView.scrollY } : null);
    };
    const onKey = (e) => {
      if (e.key === "Enter" && pendingRef.current.length) {
        e.preventDefault();
        make();
      } else if (e.key === "Escape") {
        setPending([]);
        setAnchor(null);
        doc.getSelection()?.removeAllRanges();
      }
    };
    doc.addEventListener("mouseup", onUp);
    doc.addEventListener("keyup", onUp);
    doc.addEventListener("keydown", onKey);
    return () => {
      doc.removeEventListener("mouseup", onUp);
      doc.removeEventListener("keyup", onUp);
      doc.removeEventListener("keydown", onKey);
    };
  }, [doc, disabled, make, onSelect]);

  // highlights
  const ranges = useMemo(() => {
    if (!doc) return { fields: [], active: [], pending: [] };
    const build = (list) => list.map((f) => rangeFor(doc, f.lineId, f.charStart, f.charEnd)).filter(Boolean);
    return {
      fields: build(fields.filter((f) => f.key !== activeKey)),
      active: build(fields.filter((f) => f.key === activeKey)),
      pending: build(pending),
    };
  }, [doc, fields, activeKey, pending]);

  useEffect(() => {
    if (!doc) return undefined;
    if (hasHighlights) {
      if (!doc.querySelector("style[data-viewer='marker']")) {
        const st = doc.createElement("style");
        st.setAttribute("data-viewer", "marker");
        st.textContent = HL_STYLE;
        doc.head.appendChild(st);
      }
      const reg = win.CSS.highlights;
      reg.set("cert-field", new win.Highlight(...ranges.fields));
      reg.set("cert-field-active", new win.Highlight(...ranges.active));
      reg.set("cert-pending", new win.Highlight(...ranges.pending));
      return () => {
        reg.delete("cert-field");
        reg.delete("cert-field-active");
        reg.delete("cert-pending");
      };
    }
    // fallback: overlay boxes from the ranges' client rects (document px)
    const sx = win?.scrollX || 0;
    const sy = win?.scrollY || 0;
    const toBoxes = (list, tone) => list.flatMap((r) => Array.from(r.getClientRects()).map((b) => ({ x: b.left + sx, y: b.top + sy, w: b.width, h: b.height, tone })));
    setBoxes([...toBoxes(ranges.fields, "field"), ...toBoxes(ranges.active, "active"), ...toBoxes(ranges.pending, "pending")]);
    return undefined;
  }, [doc, win, hasHighlights, ranges]);

  const inv = scale ? 1 / scale : 1;
  return (
    <>
      {!hasHighlights &&
        boxes.map((b, i) => (
          <div
            key={i}
            className={b.tone === "active" ? "bg-blue-500/35" : b.tone === "pending" ? "bg-emerald-500/35" : "bg-yellow-300/45"}
            style={{ position: "absolute", left: b.x, top: b.y, width: b.w, height: b.h }}
          />
        ))}
      {anchor && pending.length > 0 && !disabled && (
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={make}
          data-testid="make-field"
          className="pointer-events-auto absolute flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white shadow-lg hover:bg-blue-700"
          style={{ left: anchor.x + 4, top: anchor.y + 4, transform: `scale(${inv})`, transformOrigin: "0 0", whiteSpace: "nowrap" }}
        >
          <Plus className="w-3.5 h-3.5" />
          {pending.length > 1 ? STR.makeN(pending.length) : STR.make}
        </button>
      )}
    </>
  );
}
