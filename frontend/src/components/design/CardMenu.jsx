import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * The "…" menu on a theme card.
 *
 * It renders into <body> so a card with `overflow: hidden` can never clip
 * it, and it is positioned from the button's own rectangle rather than a
 * popper library — which is what kept the menus in this app anchored.
 */
export default function CardMenu({ label = "Theme options", items }) {
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState({ top: 0, left: 0 });
  const button = useRef(null);
  const menu = useRef(null);

  useLayoutEffect(() => {
    if (!open || !button.current) return;
    const r = button.current.getBoundingClientRect();
    const width = 194;
    const height = items.length * 38 + 12;
    setAt({
      top: Math.min(r.bottom + 6, window.innerHeight - height - 10),
      left: Math.max(10, Math.min(r.right - width, window.innerWidth - width - 10)),
    });
  }, [open, items.length]);

  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => {
      if (!menu.current?.contains(e.target) && !button.current?.contains(e.target)) setOpen(false);
    };
    /* Captured, so Escape closes the menu without also closing the
       Design section behind it. */
    const key = (e) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setOpen(false);
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", key, true);
    window.addEventListener("resize", () => setOpen(false), { once: true });
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", key, true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={button}
        type="button"
        className={open ? "ds-dots is-on" : "ds-dots"}
        aria-label={label}
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="5" cy="12" r="1.7" />
          <circle cx="12" cy="12" r="1.7" />
          <circle cx="19" cy="12" r="1.7" />
        </svg>
      </button>

      {open &&
        createPortal(
          <div
            ref={menu}
            className="ds-menu"
            role="menu"
            style={{ top: at.top, left: at.left }}
            onClick={(e) => e.stopPropagation()}
          >
            {items.map((it) =>
              it.divider ? (
                <span key={it.key} className="ds-menu-line" />
              ) : (
                <button
                  key={it.key || it.label}
                  type="button"
                  role="menuitem"
                  className={it.danger ? "ds-menu-item is-danger" : "ds-menu-item"}
                  onClick={() => {
                    setOpen(false);
                    it.onSelect();
                  }}
                >
                  <MenuGlyph d={it.icon} />
                  {it.label}
                </button>
              )
            )}
          </div>,
          document.body
        )}
    </>
  );
}

function MenuGlyph({ d }) {
  if (!d) return null;
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}