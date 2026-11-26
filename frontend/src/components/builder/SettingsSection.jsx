import { createContext, useContext, useId, useState } from "react";

/*
 * Open-and-close sections for the settings panel.
 *
 * Wrap a panel's sections in <SectionGroup>. Only one section in a group is
 * open at a time: clicking a section's header opens it and closes the one
 * that was open; clicking the open one closes it. The group starts with the
 * section named in `initial` open (the first section of the panel).
 *
 * A <SettingsSection> outside any group simply opens and closes on its own.
 */

const GroupContext = createContext(null);

export function SectionGroup({ initial, children }) {
  const [open, setOpen] = useState(initial ?? null);
  const toggle = (title) => setOpen((now) => (now === title ? null : title));
  return (
    <GroupContext.Provider value={{ open, toggle }}>{children}</GroupContext.Provider>
  );
}

export default function SettingsSection({ title, children }) {
  const group = useContext(GroupContext);
  const [ownOpen, setOwnOpen] = useState(true);
  const bodyId = useId();

  const isOpen = group ? group.open === title : ownOpen;
  const onToggle = () => (group ? group.toggle(title) : setOwnOpen((v) => !v));

  return (
    <section className={isOpen ? "fb-sec fb-sec-fold is-open" : "fb-sec fb-sec-fold"}>
      <h3 className="fb-sec-title">
        <button
          type="button"
          className="fb-sec-toggle"
          onClick={onToggle}
          aria-expanded={isOpen}
          aria-controls={bodyId}
        >
          <span className="fb-sec-name">{title}</span>
          <svg className="fb-sec-chev" width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            aria-hidden="true">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </h3>
      {isOpen && (
        <div className="fb-sec-body" id={bodyId}>
          {children}
        </div>
      )}
    </section>
  );
}