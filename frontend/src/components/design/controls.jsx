import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { isVideo, layoutLabel } from "./themes";

/* ============================================================
   The small parts every design panel is built from. Keeping
   them here means each panel reads as a list of decisions
   rather than a pile of markup.
   ============================================================ */

/** A titled group of controls inside a panel. */
export function Group({ title, note, children }) {
  return (
    <section className="ds-group">
      <div className="ds-group-head">
        <h3 className="ds-group-title">{title}</h3>
        {note && <p className="ds-group-note">{note}</p>}
      </div>
      <div className="ds-group-body">{children}</div>
    </section>
  );
}

/** One labelled decision. `stack` puts the control under the label. */
export function Row({ label, hint, stack = false, children }) {
  return (
    <div className={stack ? "ds-row is-stacked" : "ds-row"}>
      <div className="ds-row-text">
        <span className="ds-row-label">{label}</span>
        {hint && <span className="ds-row-hint">{hint}</span>}
      </div>
      <div className="ds-row-control">{children}</div>
    </div>
  );
}

/* ---------------- shared popover plumbing ---------------- */

/**
 * Anything that drops open renders into <body>, so the scrolling settings
 * column can never clip it, and is placed from the button's own rectangle
 * rather than a popper library.
 */
function usePopover({ width, height }) {
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState({ top: 0, left: 0 });
  const button = useRef(null);
  const panel = useRef(null);

  useLayoutEffect(() => {
    if (!open || !button.current) return;
    const r = button.current.getBoundingClientRect();
    const below = window.innerHeight - r.bottom - 12;
    const top = below >= height ? r.bottom + 6 : Math.max(10, r.top - height - 6);
    setAt({
      top: Math.max(10, Math.min(top, window.innerHeight - height - 10)),
      left: Math.max(10, Math.min(r.right - width, window.innerWidth - width - 10)),
    });
  }, [open, width, height]);

  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => {
      if (!panel.current?.contains(e.target) && !button.current?.contains(e.target)) setOpen(false);
    };
    /* Captured, so Escape closes this and not the Design section behind it. */
    const key = (e) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setOpen(false);
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", key, true);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", key, true);
    };
  }, [open]);

  return { open, setOpen, at, button, panel };
}

const Chevron = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
    <path d="m6 9 6 6 6-6" />
  </svg>
);

const Tick = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m5 12 5 5 9-10" />
  </svg>
);

/* ---------------- dropdown ---------------- */

/**
 * A dropdown for lists too long to lay out flat — the ten fonts, the ten
 * animations. The list itself scrolls, so the panel never runs off screen.
 *
 * `ownFont` renders each name in the face it names.
 */
export function SelectControl({ options, value, onChange, label, ownFont = false, width = 250 }) {
  const rows = Math.min(options.length, 6);
  const pop = usePopover({ width, height: rows * 46 + 14 });
  const chosen = options.find((o) => o.id === value) || options[0];

  return (
    <>
      <button
        ref={pop.button}
        type="button"
        className={pop.open ? "ds-select is-open" : "ds-select"}
        style={{ width }}
        aria-label={label}
        aria-expanded={pop.open}
        onClick={() => pop.setOpen((v) => !v)}
      >
        <span className="ds-select-value" style={ownFont ? { fontFamily: chosen.stack } : undefined}>
          {chosen.label}
        </span>
        <Chevron />
      </button>

      {pop.open &&
        createPortal(
          <div
            ref={pop.panel}
            className="ds-select-pop"
            role="listbox"
            aria-label={label}
            style={{ top: pop.at.top, left: pop.at.left, width }}
          >
            {options.map((o) => (
              <button
                key={o.id}
                type="button"
                role="option"
                aria-selected={value === o.id}
                className={value === o.id ? "ds-select-opt is-on" : "ds-select-opt"}
                onClick={() => {
                  onChange(o.id);
                  pop.setOpen(false);
                }}
              >
                <span className="ds-select-opt-text">
                  <span
                    className="ds-select-opt-label"
                    style={ownFont ? { fontFamily: o.stack } : undefined}
                  >
                    {o.label}
                  </span>
                  {o.note && <span className="ds-select-opt-note">{o.note}</span>}
                </span>
                {value === o.id && <Tick />}
              </button>
            ))}
          </div>,
          document.body
        )}
    </>
  );
}

/* ---------------- colour ---------------- */

/**
 * A colour well that opens the operating system picker, beside a hex box
 * for people who already know the value they want.
 */
export function ColourControl({ value, onChange, label }) {
  return (
    <div className="ds-colour">
      <span className="ds-colour-well" style={{ backgroundColor: value }}>
        <input
          type="color"
          value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#000000"}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
        />
      </span>
      <input
        type="text"
        className="ds-hex"
        value={value}
        spellCheck="false"
        maxLength={7}
        onChange={(e) => onChange(e.target.value.startsWith("#") ? e.target.value : `#${e.target.value}`)}
        aria-label={`${label} hex value`}
      />
    </div>
  );
}

/* ---------------- segmented ---------------- */

/** A pill group: sizes, speeds, alignment — anything with 2–4 answers. */
export function Segmented({ options, value, onChange, label, grow = false }) {
  return (
    <div className={grow ? "ds-seg is-grow" : "ds-seg"} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          className={value === o.id ? "ds-seg-btn is-on" : "ds-seg-btn"}
          onClick={() => onChange(o.id)}
          title={o.note || o.label}
          aria-label={o.icon ? o.label : undefined}
        >
          {o.icon ? <AlignGlyph kind={o.icon} /> : o.label}
        </button>
      ))}
    </div>
  );
}

function AlignGlyph({ kind }) {
  const lines = {
    left: ["M4 6h16", "M4 11h10", "M4 16h13"],
    center: ["M4 6h16", "M7 11h10", "M6 16h12"],
    right: ["M4 6h16", "M10 11h10", "M7 16h13"],
  }[kind];
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.9" strokeLinecap="round" aria-hidden="true">
      {lines.map((d) => <path key={d} d={d} />)}
    </svg>
  );
}

/* ---------------- choice cards ---------------- */

/** For choices that need a sentence of explanation, not just a word. */
export function OptionCards({ options, value, onChange, label, columns = 2 }) {
  return (
    <div className="ds-cards" style={{ "--cols": columns }} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          className={value === o.id ? "ds-card-opt is-on" : "ds-card-opt"}
          onClick={() => onChange(o.id)}
        >
          <span className="ds-card-opt-label">{o.label}</span>
          {o.note && <span className="ds-card-opt-note">{o.note}</span>}
        </button>
      ))}
    </div>
  );
}

/* ---------------- slider ---------------- */

export function SliderControl({ value, onChange, min = 0, max = 100, step = 1, unit = "", label }) {
  return (
    <div className="ds-slider">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        style={{ "--pct": `${((value - min) / (max - min)) * 100}%` }}
      />
      <span className="ds-slider-value">
        {value}
        {unit}
      </span>
    </div>
  );
}

/* ---------------- switch ---------------- */

export function Switch({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={checked ? "ds-switch is-on" : "ds-switch"}
      onClick={() => onChange(!checked)}
    >
      <span className="ds-switch-dot" />
    </button>
  );
}

/* ---------------- layout picker ---------------- */

/**
 * A little map of each layout, drawn rather than described: the filled
 * block is the picture, the lines are the questions.
 */
export function LayoutGlyph({ id, size = 26 }) {
  const h = Math.round(size * 0.72);
  const line = (x, y, w) => (
    <rect key={`${x}-${y}`} x={x} y={y} width={w} height="2" rx="1" className="ds-lg-line" />
  );

  const shapes = {
    full: (
      <>
        <rect x="1" y="1" width="30" height="20" rx="3" className="ds-lg-fill" />
        {line(8, 8, 15)}
        {line(8, 13, 10)}
      </>
    ),
    "left-half": (
      <>
        <rect x="1" y="1" width="15" height="20" rx="3" className="ds-lg-fill" />
        {line(19, 8, 10)}
        {line(19, 13, 7)}
      </>
    ),
    "right-half": (
      <>
        <rect x="16" y="1" width="15" height="20" rx="3" className="ds-lg-fill" />
        {line(3, 8, 10)}
        {line(3, 13, 7)}
      </>
    ),
    "left-tile": (
      <>
        <rect x="1" y="1" width="9" height="20" rx="3" className="ds-lg-fill" />
        {line(13, 8, 16)}
        {line(13, 13, 11)}
      </>
    ),
    "right-tile": (
      <>
        <rect x="22" y="1" width="9" height="20" rx="3" className="ds-lg-fill" />
        {line(3, 8, 16)}
        {line(3, 13, 11)}
      </>
    ),
    banner: (
      <>
        <rect x="1" y="1" width="30" height="9" rx="3" className="ds-lg-fill" />
        {line(4, 14, 18)}
        {line(4, 18, 12)}
      </>
    ),
    bottom: (
      <>
        <rect x="1" y="12" width="30" height="9" rx="3" className="ds-lg-fill" />
        {line(4, 4, 18)}
        {line(4, 8, 12)}
      </>
    ),
    none: (
      <>
        <rect x="1" y="1" width="30" height="20" rx="3" className="ds-lg-empty" />
        {line(6, 8, 20)}
        {line(6, 13, 13)}
      </>
    ),
  };

  return (
    <svg width={size} height={h} viewBox="0 0 32 22" fill="none" aria-hidden="true" className="ds-lg">
      {shapes[id] || shapes.full}
    </svg>
  );
}

/** The current layout as a button; the alternatives open as little maps. */
export function LayoutPicker({ options, value, onChange, label, mobile = false }) {
  const cols = options.length % 3 === 0 ? 3 : 2;
  const pop = usePopover({
    width: cols * 92 + 28,
    height: Math.ceil(options.length / cols) * 82 + 46,
  });

  return (
    <>
      <button
        ref={pop.button}
        type="button"
        className={pop.open ? "ds-layout-btn is-open" : "ds-layout-btn"}
        aria-label={label}
        aria-expanded={pop.open}
        onClick={() => pop.setOpen((v) => !v)}
      >
        <LayoutGlyph id={value} size={24} />
        <span className="ds-layout-btn-text">
          {options.find((o) => o.id === value)?.label ?? layoutLabel(value, mobile)}
        </span>
        <Chevron />
      </button>

      {pop.open &&
        createPortal(
          <div
            ref={pop.panel}
            className="ds-layout-pop"
            role="radiogroup"
            aria-label={label}
            style={{ top: pop.at.top, left: pop.at.left, "--cols": cols }}
          >
            <p className="ds-layout-pop-title">{mobile ? "On a phone" : "On a wide screen"}</p>
            <div className="ds-layout-grid">
              {options.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  role="radio"
                  aria-checked={value === o.id}
                  title={o.note}
                  className={value === o.id ? "ds-layout-opt is-on" : "ds-layout-opt"}
                  onClick={() => {
                    onChange(o.id);
                    pop.setOpen(false);
                  }}
                >
                  <LayoutGlyph id={o.id} size={42} />
                  <span className="ds-layout-opt-label">{o.label}</span>
                </button>
              ))}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

/* ---------------- focal point ---------------- */

const clamp = (n) => Math.max(0, Math.min(100, n));

/**
 * Drag the ring to say which part of the picture must stay in view when
 * it is cropped. Arrow keys nudge it, so it works without a mouse too.
 */
export function FocalPicker({ src, x, y, onChange, label = "Focal point" }) {
  const box = useRef(null);
  const [dragging, setDragging] = useState(false);

  const setFrom = (e) => {
    const r = box.current?.getBoundingClientRect();
    if (!r) return;
    onChange(clamp(((e.clientX - r.left) / r.width) * 100), clamp(((e.clientY - r.top) / r.height) * 100));
  };

  const nudge = (e) => {
    const step = e.shiftKey ? 10 : 2;
    const moves = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const move = moves[e.key];
    if (!move) return;
    e.preventDefault();
    onChange(clamp(x + move[0]), clamp(y + move[1]));
  };

  if (!src) {
    return <p className="ds-focal-empty">Add a picture first and the focal point appears here.</p>;
  }

  return (
    <div
      ref={box}
      className={dragging ? "ds-focal is-dragging" : "ds-focal"}
      role="application"
      aria-label={`${label}: ${Math.round(x)}% across, ${Math.round(y)}% down`}
      tabIndex={0}
      onKeyDown={nudge}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        setDragging(true);
        setFrom(e);
      }}
      onPointerMove={(e) => dragging && setFrom(e)}
      onPointerUp={() => setDragging(false)}
      onPointerCancel={() => setDragging(false)}
    >
      {isVideo(src) ? <video src={src} muted loop autoPlay playsInline /> : <img src={src} alt="" />}
      <span className="ds-focal-grid" aria-hidden="true" />
      <span className="ds-focal-dot" style={{ left: `${x}%`, top: `${y}%` }} aria-hidden="true" />
    </div>
  );
}

/* ---------------- image ---------------- */

/** Longest edge a stored picture is allowed to have. */
const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.82;

/**
 * Turns a chosen file into a data URL small enough to live inside a form
 * or a theme.
 *
 * A photo straight off a phone is several megabytes, and every one of
 * them ends up inside a JSON column. Scaling the longest edge down to
 * 1600px and re-encoding takes a 4MB photo to a couple of hundred
 * kilobytes with no visible loss at the sizes a form shows.
 *
 * SVGs and videos are passed through untouched — one is already tiny, the
 * other cannot be redrawn here. Anything unexpected falls back to the raw
 * file, so a picture never fails to load just because resizing did.
 */
function shrink(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onerror = () => resolve("");
    reader.onload = () => {
      const raw = String(reader.result);
      const passThrough = file.type === "image/svg+xml" || file.type.startsWith("video/");
      if (passThrough) return resolve(raw);

      const img = new Image();
      img.onerror = () => resolve(raw);
      img.onload = () => {
        try {
          const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));

          // Already small and already compressed: leave it alone.
          if (scale === 1 && raw.length < 400_000) return resolve(raw);

          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, w, h);

          /* Transparency has to stay a PNG; everything else is far
             smaller as a JPEG. */
          const hasAlpha = file.type === "image/png" || file.type === "image/webp";
          const out = hasAlpha
            ? canvas.toDataURL("image/png")
            : canvas.toDataURL("image/jpeg", JPEG_QUALITY);

          resolve(out.length < raw.length ? out : raw);
        } catch {
          resolve(raw);
        }
      };
      img.src = raw;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Picks a file from the machine and hands back a data URL, so the preview
 * updates without anything being uploaded anywhere.
 */
export function ImagePicker({
  value,
  onChange,
  label,
  cta = "Choose image",
  hint,
  accept = "image/*",
}) {
  const input = useRef(null);

  const [busy, setBusy] = useState(false);

  const read = async (file) => {
    if (!file) return;
    setBusy(true);
    try {
      const url = await shrink(file);
      if (url) onChange(url);
    } finally {
      setBusy(false);
    }
  };

  /* The picker is often placed inside a <label>. Without cancelling the
     click there, the label would open the file chooser a second time. */
  const open = (e) => {
    e.preventDefault();
    e.stopPropagation();
    input.current?.click();
  };

  return (
    <div className="ds-image">
      {value ? (
        <div className="ds-image-has">
          <span className="ds-image-thumb">
            {isVideo(value) ? (
              <video src={value} muted loop autoPlay playsInline />
            ) : (
              <img src={value} alt="" />
            )}
          </span>
          <div className="ds-image-acts">
            <button type="button" className="ds-btn ds-btn-quiet" onClick={open}>
              Replace
            </button>
            <button
              type="button"
              className="ds-btn ds-btn-quiet ds-btn-danger"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onChange("");
              }}
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="ds-drop"
          onClick={open}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            read(e.dataTransfer.files?.[0]);
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 16V5M8 9l4-4 4 4M5 19h14" />
          </svg>
          <span className="ds-drop-cta">{busy ? "Preparing…" : cta}</span>
          <span className="ds-drop-hint">{hint || "PNG, JPG or SVG — or drop a file here"}</span>
        </button>
      )}
      <input
        ref={input}
        type="file"
        accept={accept}
        className="ds-file"
        tabIndex={-1}
        aria-label={label}
        onChange={(e) => {
          read(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}