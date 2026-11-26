import { useMemo, useState } from "react";
import CardMenu from "./CardMenu";
import ThemeCanvas from "./ThemeCanvas";
import { TEMPLATES, fontStack } from "./themes";

const MI = {
  edit: "M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4",
  rename: "M5 19h14M7 15l9-9 3 3-9 9H7z",
  copy: "M8 8h11v11H8zM5 16H4V4h12v1",
  trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  check: "m5 12 5 5 9-10",
};

/**
 * The themes gallery.
 *
 * Two bands: the themes this form owns, and ten starting points. A card is
 * mostly its own preview — the quickest way to tell two themes apart is to
 * see them side by side rather than read their settings.
 */
export default function ThemeGallery({
  themes,
  appliedId,
  onApply,
  onEdit,
  onRename,
  onDuplicate,
  onDelete,
  onCreate,
  onUseTemplate,
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const mine = useMemo(
    () => themes.filter((t) => !q || t.name.toLowerCase().includes(q)),
    [themes, q]
  );
  const templates = useMemo(
    () =>
      TEMPLATES.filter(
        (t) => !q || t.name.toLowerCase().includes(q) || t.tagline.toLowerCase().includes(q)
      ),
    [q]
  );

  return (
    <div className="ds-gallery">
      <header className="ds-gal-head">
        <div className="ds-gal-intro">
          <h2 className="ds-gal-title">My themes</h2>
          <p className="ds-gal-sub">
            A theme decides how the form looks to the person filling it in — the type, the colours,
            the buttons and the way questions arrive.
          </p>
        </div>

        <div className="ds-gal-tools">
          <label className="ds-search">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="6" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              type="search"
              value={query}
              placeholder="Search themes"
              aria-label="Search themes"
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <button type="button" className="ds-btn ds-btn-primary" onClick={onCreate}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
            New theme
          </button>
        </div>
      </header>

      <div className="ds-grid">
        {mine.map((t) => {
          const applied = t.id === appliedId;
          return (
            <article
              key={t.id}
              className={applied ? "ds-tile is-applied" : "ds-tile"}
              style={{ "--ds-tile-accent": t.buttons.fill }}
              onDoubleClick={() => onEdit(t.id)}
            >
              <div className="ds-tile-art">
                <ThemeCanvas theme={t} compact />
                <div className="ds-tile-veil">
                  <button type="button" className="ds-btn ds-btn-light" onClick={() => onEdit(t.id)}>
                    Edit theme
                  </button>
                  <button
                    type="button"
                    className="ds-btn ds-btn-ghost-light"
                    onClick={() => onApply(t.id)}
                    disabled={applied}
                  >
                    {applied ? "In use" : "Use theme"}
                  </button>
                </div>
              </div>

              <footer className="ds-tile-foot">
                <span className="ds-tile-text">
                  <span className="ds-tile-name" title={t.name}>
                    {t.name}
                  </span>
                  <span className="ds-tile-meta">
                    <span className="ds-chip" style={{ backgroundColor: t.buttons.fill }} />
                    <span className="ds-chip" style={{ backgroundColor: t.background.colour }} />
                    <span className="ds-chip" style={{ backgroundColor: t.font.questionColour }} />
                    <span className="ds-tile-font" style={{ fontFamily: fontStack(t.font.family) }}>
                      Aa
                    </span>
                  </span>
                </span>

                {applied && <span className="ds-badge">In use</span>}

                <CardMenu
                  label={`Options for ${t.name}`}
                  items={[
                    { key: "rename", label: "Rename", icon: MI.rename, onSelect: () => onRename(t.id) },
                    { key: "edit", label: "Edit", icon: MI.edit, onSelect: () => onEdit(t.id) },
                    { key: "dup", label: "Duplicate", icon: MI.copy, onSelect: () => onDuplicate(t.id) },
                    ...(applied
                      ? []
                      : [{ key: "use", label: "Use on this form", icon: MI.check, onSelect: () => onApply(t.id) }]),
                    { key: "d1", divider: true },
                    {
                      key: "del",
                      label: "Delete",
                      icon: MI.trash,
                      danger: true,
                      onSelect: () => onDelete(t.id),
                    },
                  ]}
                />
              </footer>
            </article>
          );
        })}

        {!q && (
          <button type="button" className="ds-tile ds-tile-new" onClick={onCreate}>
            <span className="ds-tile-new-mark">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </span>
            <span className="ds-tile-new-title">New theme</span>
            <span className="ds-tile-new-sub">Start from a blank canvas</span>
          </button>
        )}

        {q && mine.length === 0 && (
          <p className="ds-empty">Nothing of yours matches “{query}”.</p>
        )}
      </div>

      {/* ---------------- templates ---------------- */}
      <header className="ds-gal-head ds-gal-head-sub">
        <div className="ds-gal-intro">
          <h2 className="ds-gal-title">Start from a template</h2>
          <p className="ds-gal-sub">
            Ten ready-made looks. Picking one drops a copy into your themes, yours to change.
          </p>
        </div>
        <span className="ds-count">{templates.length} of {TEMPLATES.length}</span>
      </header>

      <div className="ds-grid ds-grid-tpl">
        {templates.map((t) => (
          <article
            key={t.id}
            className="ds-tile ds-tile-tpl"
            style={{ "--ds-tile-accent": t.buttons.fill }}
          >
            <div className="ds-tile-art">
              <ThemeCanvas theme={t} compact />
              <div className="ds-tile-veil">
                <button type="button" className="ds-btn ds-btn-light" onClick={() => onUseTemplate(t)}>
                  Use this template
                </button>
              </div>
            </div>
            <footer className="ds-tile-foot">
              <span className="ds-tile-text">
                <span className="ds-tile-name">{t.name}</span>
                <span className="ds-tile-tag">{t.tagline}</span>
              </span>
              <span className="ds-tile-meta ds-tile-meta-end">
                <span className="ds-chip" style={{ backgroundColor: t.buttons.fill }} />
                <span className="ds-chip" style={{ backgroundColor: t.background.colour }} />
              </span>
            </footer>
          </article>
        ))}

        {templates.length === 0 && <p className="ds-empty">No template matches “{query}”.</p>}
      </div>
    </div>
  );
}