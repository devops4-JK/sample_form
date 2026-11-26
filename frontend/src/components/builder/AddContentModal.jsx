import { useMemo, useState } from "react";
import { Modal } from "react-bootstrap";
import { ELEMENTS, GROUPS, GROUP_TONE, ICON_PATHS } from "../../constants/formElements";

/** One line under each element name, so people pick without guessing. */
const DESCRIPTIONS = {
  product_choice: "Pick one product from pictures, with sizes",
  product_sets: "Pick one product from each of several sets",
  contact_info: "Name, email and phone in one block",
  email: "A single, validated email address",
  phone: "A phone number with country code",
  address: "Street, city, state, PIN and country",
  website: "A link to a site or profile",
  multiple_choice: "Pick one, or several, from a list",
  dropdown: "A compact list for many choices",
  picture_choice: "Choices shown as images",
  yes_no: "A quick yes or no",
  legal: "Accept or decline terms",
  checkbox: "Tick every option that applies",
  nps: "0 to 10 likelihood to recommend",
  opinion_scale: "A numbered scale with end labels",
  rating: "Stars, hearts or thumbs",
  ranking: "Put options in order",
  matrix: "Rate several rows on the same scale",
  long_text: "A paragraph answer",
  short_text: "A one-line answer",
  number: "A number within a range",
  date: "A calendar date",
  signature: "Sign with a mouse or finger",
  payment: "Collect a fixed amount",
  file_upload: "Accept a document or image",
  scheduler: "Book a time slot",
  statement: "Text to read, no answer needed",
  question_group: "A heading that starts a section",
  welcome_screen: "The first thing people see",
  end_screen: "A thank-you after the last question",
  redirect_url: "Send people to a link when done",
};

/** Renders any icon from ICON_PATHS. */
export function ElementIcon({ name, size = 18 }) {
  const paths = ICON_PATHS[name] || ICON_PATHS.text;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

/** The coloured tile the icon sits in, tinted by group. */
export function ElementTile({ element, size = 18 }) {
  return (
    <span className={`bx-tile ${GROUP_TONE[element.group]}`}>
      <ElementIcon name={element.icon} size={size} />
    </span>
  );
}

/**
 * The "Add content" picker. Search across everything, or narrow by category
 * on the left. Picking an element adds it to the page named in the header.
 */
export default function AddContentModal({ show, onClose, onPick, pageName }) {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("all");

  const q = query.trim().toLowerCase();

  const matches = useMemo(
    () =>
      ELEMENTS.filter(
        (e) =>
          !q ||
          e.name.toLowerCase().includes(q) ||
          (DESCRIPTIONS[e.type] || "").toLowerCase().includes(q)
      ),
    [q]
  );

  /**
   * The element Enter should add: a name that starts with the search beats a
   * name that contains it, which beats a match only in the description.
   * (Typing "date" should add Date, not Email, whose description says "validated".)
   */
  const best = useMemo(() => {
    if (!q) return null;
    const score = (e) => {
      const n = e.name.toLowerCase();
      if (n.startsWith(q)) return 0;
      if (n.split(/\W+/).some((w) => w.startsWith(q))) return 1;
      if (n.includes(q)) return 2;
      return 3;
    };
    return [...matches].sort((a, b) => score(a) - score(b))[0] || null;
  }, [matches, q]);

  const sections = useMemo(
    () =>
      GROUPS.filter((g) => group === "all" || g.id === group)
        .map((g) => ({ ...g, items: matches.filter((e) => e.group === g.id) }))
        .filter((g) => g.items.length > 0),
    [matches, group]
  );

  const counts = useMemo(() => {
    const c = { all: matches.length };
    GROUPS.forEach((g) => {
      c[g.id] = matches.filter((e) => e.group === g.id).length;
    });
    return c;
  }, [matches]);

  const reset = () => {
    setQuery("");
    setGroup("all");
  };

  const choose = (type) => {
    onPick(type);
    onClose();
  };

  return (
    <Modal
      show={show}
      onHide={onClose}
      onExited={reset}
      size="xl"
      centered
      contentClassName="ac"
      backdropClassName="cf-backdrop"
    >
      <header className="ac-head">
        <div>
          <h2 className="ac-title">Add content</h2>
          {pageName && <p className="ac-sub">Adds to {pageName}</p>}
        </div>
        <button type="button" className="fb-icon" onClick={onClose} aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </header>

      <div className="ac-search">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14M20 20l-3.5-3.5" />
        </svg>
        <input
          type="search"
          value={query}
          autoFocus
          onChange={(e) => {
            setQuery(e.target.value);
            // A search looks across every category, whichever one was open.
            if (e.target.value) setGroup("all");
          }}
          onKeyDown={(e) => {
            // Enter adds the first match, so typing "email" + Enter is enough.
            if (e.key === "Enter" && best) choose(best.type);
          }}
          placeholder="Search elements, e.g. email, rating, date"
          aria-label="Search form elements"
        />
      </div>

      <div className="ac-body">
        <nav className="ac-rail" aria-label="Categories">
          {[{ id: "all", label: "All elements" }, ...GROUPS].map((g) => (
            <button
              key={g.id}
              type="button"
              className={group === g.id ? "ac-cat is-on" : "ac-cat"}
              onClick={() => setGroup(g.id)}
              disabled={counts[g.id] === 0}
            >
              {g.id !== "all" && <span className={`ac-dot ${GROUP_TONE[g.id]}`} aria-hidden="true" />}
              <span className="ac-cat-name">{g.label}</span>
              <span className="ac-cat-count">{counts[g.id]}</span>
            </button>
          ))}
        </nav>

        <div className="ac-list">
          {sections.length === 0 ? (
            <div className="ac-empty">
              <p className="ac-empty-title">Nothing matches “{query}”</p>
              <p className="ac-empty-sub">Try a shorter word, like “text” or “choice”.</p>
            </div>
          ) : (
            sections.map((s) => (
              <section key={s.id} className="ac-sec">
                <h3 className="ac-sec-title">{s.label}</h3>
                <div className="ac-grid">
                  {s.items.map((el) => (
                    <button
                      key={el.type}
                      type="button"
                      className={best?.type === el.type ? "ac-card is-best" : "ac-card"}
                      onClick={() => choose(el.type)}
                    >
                      <ElementTile element={el} size={17} />
                      <span className="ac-card-text">
                        <span className="ac-card-name">{el.name}</span>
                        <span className="ac-card-desc">{DESCRIPTIONS[el.type]}</span>
                      </span>
                      {best?.type === el.type && <kbd className="ac-enter">Enter</kbd>}
                    </button>
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </div>
    </Modal>
  );
}