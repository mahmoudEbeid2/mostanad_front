import { useRef, useState } from "react";

// The repeating group on the design (plan §7.8, §13.4): the detected band is
// tinted, and the footer line — everything below it stays where it is — is a
// dashed line the user drags. Positions come from the server's detection
// (page-relative CSS px); this only adds the page's offset in the frame.

const STR = { footer: "Footer line — drag to move", group: (l) => `Group · ${l}` };
const round1 = (n) => Math.round(n * 10) / 10;

function FooterLine({ y, pageTop, minY, maxY, width, left, scale, disabled, onCommit }) {
  const [drag, setDrag] = useState(null); // current y while dragging
  const start = useRef(null);
  const shown = drag ?? y;
  const inv = scale ? 1 / scale : 1;
  return (
    <div
      role="slider"
      aria-label={STR.footer}
      aria-valuemin={Math.round(minY)}
      aria-valuemax={Math.round(maxY)}
      aria-valuenow={Math.round(shown)}
      tabIndex={disabled ? -1 : 0}
      data-testid="footer-handle"
      className={`absolute ${disabled ? "" : "pointer-events-auto cursor-ns-resize"}`}
      style={{ left, width, top: pageTop + shown - 6, height: 12 }}
      onKeyDown={(e) => {
        if (disabled || !["ArrowUp", "ArrowDown"].includes(e.key)) return;
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        onCommit(round1(Math.min(maxY, Math.max(minY, y + (e.key === "ArrowUp" ? -step : step)))));
      }}
      onPointerDown={(e) => {
        if (disabled) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        start.current = { clientY: e.clientY, y };
        setDrag(y);
      }}
      onPointerMove={(e) => {
        if (!start.current) return;
        setDrag(Math.min(maxY, Math.max(minY, start.current.y + (e.clientY - start.current.clientY) * inv)));
      }}
      onPointerUp={() => {
        if (!start.current) return;
        start.current = null;
        const next = round1(drag ?? y);
        setDrag(null);
        if (next !== y) onCommit(next);
      }}
    >
      <div className="absolute inset-x-0 top-[5px] border-t-2 border-dashed border-rose-500" />
      <span className="absolute right-1 -top-4 rounded bg-rose-500 px-1.5 py-0.5 text-[10px] font-semibold text-white whitespace-nowrap" style={{ transform: `scale(${inv})`, transformOrigin: "100% 100%" }}>
        {STR.footer}
      </span>
    </div>
  );
}

export default function GroupOverlay({ frameInfo, groups, detection = {}, onFooter, disabled, scale }) {
  if (!frameInfo?.pages?.length) return null;
  return (
    <>
      {groups.map((g) => {
        const d = detection[g.key];
        if (!d?.ok || !d.band) return null;
        const page = frameInfo.pages.find((p) => p.page === d.page) || frameInfo.pages[0];
        const left = d.frame ? d.frame.x0 : 0;
        const width = d.frame ? d.frame.x1 - d.frame.x0 : page.width;
        const footer = g.footerY ?? d.footerProposal;
        return (
          <div key={g.key}>
            <div
              className="absolute bg-violet-500/10 outline-2 outline-dashed outline-violet-500/70"
              style={{ left, width, top: page.top + d.band.y0, height: d.band.y1 - d.band.y0 }}
              title={STR.group(g.label)}
              data-testid="group-band"
            />
            {g.mode !== "fixed_rows" && (
              <FooterLine
                y={footer}
                pageTop={page.top}
                minY={d.band.y1 + 8}
                maxY={page.height}
                width={page.width}
                left={0}
                scale={scale}
                disabled={disabled}
                onCommit={(y) => onFooter(g.key, y)}
              />
            )}
          </div>
        );
      })}
    </>
  );
}
