import { forwardRef, useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Dropdown, Form, Modal, Spinner } from "react-bootstrap";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";
import ProfileMenu from "../components/ProfileMenu";

/** Mirrors FORM_LIMIT in backend/controllers/workbenchAccess.js. */
const FORM_LIMIT = 20;

const SORTS = {
  created: { label: "Date created", compare: (a, b) => new Date(b.created) - new Date(a.created) },
  updated: { label: "Last updated", compare: (a, b) => new Date(b.updated) - new Date(a.updated) },
};

/** How many rows each sidebar section shows before "Show all". */
const SHOW_WORKBENCHES = 3;
const SHOW_FORMS = 5;

/* Status is shown as an icon with a tooltip, not as words. */
const STATUS = {
  published: { label: "Published", icon: "globe", tone: "is-live" },
  draft: { label: "Draft", icon: "pencil", tone: "is-draft" },
  closed: { label: "Closed", icon: "lock", tone: "is-closed" },
};

/* ---------------------------- icons ---------------------------- */

const PATHS = {
  plus: ["M12 5v14M5 12h14"],
  search: ["M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14", "m20 20-3.5-3.5"],
  grid: ["M4 4h6v6H4z", "M14 4h6v6h-6z", "M4 14h6v6H4z", "M14 14h6v6h-6z"],
  list: ["M9 6h11M9 12h11M9 18h11", "M4 6h.01M4 12h.01M4 18h.01"],
  file: ["M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z", "M14 3v5h5"],
  folder: ["M3 7.5A2.5 2.5 0 0 1 5.5 5H9l2 2h7.5A2.5 2.5 0 0 1 21 9.5v7a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 16.5z"],
  chevron: ["m6 9 6 6 6-6"],
  globe: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18", "M3.2 9h17.6M3.2 15h17.6", "M12 3c2.5 2.6 3.8 5.6 3.8 9S14.5 18.4 12 21C9.5 18.4 8.2 15.4 8.2 12S9.5 5.6 12 3"],
  pencil: ["M4 20h4L19 9l-4-4L4 16z", "m13.5 6.5 4 4"],
  lock: ["M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4"],
  check: ["m5 12 5 5 9-10"],
  back: ["m15 18-6-6 6-6"],
  sort: ["M4 7h16M7 12h10M10 17h4"],
  sun: ["M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8", "M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"],
  moon: ["M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"],
  home: ["M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"],
  logout: ["M15 17v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v2", "M10 12h11", "m18 9 3 3-3 3"],
  open: ["M14 4h6v6", "M20 4 10 14", "M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"],
  move: ["M5 12h14", "m13 6 6 6-6 6"],
  trash: ["M4 7h16", "M10 11v6M14 11v6", "M6 7l1 13h10l1-13", "M9 7V4h6v3"],
};

function Icon({ name, size = 16 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name].map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

const Dots = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <circle cx="5" cy="12" r="1.6" />
    <circle cx="12" cy="12" r="1.6" />
    <circle cx="19" cy="12" r="1.6" />
  </svg>
);

/**
 * Dropdown trigger. Bootstrap passes its own className (which draws a caret);
 * it is dropped here on purpose so every trigger stays clean.
 */
const Trigger = forwardRef(function Trigger(
  // eslint-disable-next-line no-unused-vars
  { onClick, look = "fx-icon-btn", label, children, className, ...rest },
  ref
) {
  return (
    <button
      type="button"
      ref={ref}
      className={look}
      aria-label={label}
      title={label}
      aria-expanded={rest["aria-expanded"]}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick(e);
      }}
    >
      {children}
    </button>
  );
});

/**
 * Menus render into <body>, so no scrolling list or rounded card can clip
 * them. React context still flows through the portal, so the menu stays
 * wired to its Dropdown.
 */
function Menu(props) {
  return createPortal(<Dropdown.Menu {...props} />, document.body);
}

/* ---------------------------- helpers ---------------------------- */

const shortDate = (d) =>
  d
    ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    : "—";

const initialOf = (name) => (name || "?").trim().charAt(0).toUpperCase() || "?";

/* ---------------------------- dialog ---------------------------- */

/**
 * One dialog for every change on this page: creating, renaming, inviting,
 * and confirming. Each input gets a visible label.
 *
 * fields: [{ name, label, type, placeholder, hint, defaultValue, options, maxLength }]
 * A dialog with no fields is a confirmation.
 */


function Dialog({ open, config, busy, error, onSubmit, onClose, onExited }) {
  const [values, setValues] = useState({});

  // Reset the inputs every time a new dialog opens.
  useEffect(() => {
    if (!open || !config) return;
    setValues(
      Object.fromEntries((config.fields || []).map((f) => [f.name, f.defaultValue ?? ""]))
    );
  }, [open, config]);

  if (!config) return null;
  const fields = config.fields || [];

  return (
    <Modal
      show={open}
      onHide={onClose}
      onExited={onExited}
      centered
      contentClassName="fx-dialog"
      backdropClassName="fx-backdrop"
    >
      <Form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(values);
        }}
      >
        <div className="fx-dialog-head">
          <h2 className="fx-dialog-title">{config.title}</h2>
          <button type="button" className="fx-icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="fx-dialog-body">
          {config.description && <p className="fx-dialog-desc">{config.description}</p>}

          {fields.map((f, i) => (
            <Form.Group key={f.name} className="fx-field" controlId={`fx-${f.name}`}>
              <Form.Label className="fx-label">{f.label}</Form.Label>
              {f.type === "select" ? (
                <Form.Select
                  className="fx-input"
                  value={values[f.name] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                  required
                >
                  {f.options.map((o) => (
                    <option key={o.value} value={o.value} disabled={o.disabled}>
                      {o.label}
                    </option>
                  ))}
                </Form.Select>
              ) : (
                <Form.Control
                  className="fx-input"
                  type={f.type || "text"}
                  autoFocus={i === 0}
                  placeholder={f.placeholder}
                  maxLength={f.maxLength}
                  value={values[f.name] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                  required
                />
              )}
              {f.hint && <Form.Text className="fx-hint">{f.hint}</Form.Text>}
            </Form.Group>
          ))}

          {error && <div className="fx-dialog-error">{error}</div>}
        </div>

        <div className="fx-dialog-foot">
          <button type="button" className="fx-btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="submit"
            className={config.danger ? "fx-btn fx-btn-danger" : "fx-btn fx-btn-primary"}
            disabled={busy}
          >
            {busy ? "Working…" : config.confirmLabel}
          </button>
        </div>
      </Form>
    </Modal>
  );
}

/* ---------------------------- page ---------------------------- */

export default function Forms() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [workbenches, setWorkbenches] = useState([]);
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [activeWb, setActiveWb] = useState("all"); // "all" shows every form
  const [focusedForm, setFocusedForm] = useState(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("created");
  const [view, setView] = useState("grid"); // the page opens on the cards
  const [showAllWb, setShowAllWb] = useState(false);
  const [showAllForms, setShowAllForms] = useState(false);

  const [dialog, setDialog] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogBusy, setDialogBusy] = useState(false);
  const [dialogError, setDialogError] = useState("");

  /* Locks the shell to the viewport and hides the shared TopNav, so only
     the form list scrolls. Undone on unmount. */
  useEffect(() => {
    document.body.classList.add("fh-locked");
    return () => document.body.classList.remove("fh-locked");
  }, []);

  // Success messages fade on their own.
  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(""), 3000);
    return () => clearTimeout(t);
  }, [notice]);

  /** The server owns the counts, so always re-read both lists. */
  const refresh = useCallback(async () => {
    const [wbRes, formRes] = await Promise.all([api.listWorkbenches(), api.listForms()]);
    setWorkbenches(wbRes.workbenches);
    setForms(formRes.forms);
    return wbRes.workbenches;
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const list = await refresh();
        if (alive && list.length) setActiveWb(list[0].id);
      } catch (err) {
        if (alive) setError(err.message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [refresh]);

  /* ---------------- derived ---------------- */

  const countIn = (wbId) => forms.filter((f) => f.workbenchId === wbId).length;
  const wbName = (wbId) => workbenches.find((w) => w.id === wbId)?.name ?? "—";

  const activeWorkbench = workbenches.find((w) => w.id === activeWb) || null;
  const activeName = activeWb === "all" ? "All forms" : activeWorkbench?.name ?? "Workbench";
  const activeCount = activeWorkbench ? countIn(activeWorkbench.id) : 0;
  const activeFull = Boolean(activeWorkbench) && activeCount >= FORM_LIMIT;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return forms
      .filter((f) => activeWb === "all" || f.workbenchId === activeWb)
      .filter((f) => !q || f.name.toLowerCase().includes(q))
      .sort(SORTS[sort].compare);
  }, [forms, activeWb, query, sort]);

  const shownWorkbenches = showAllWb ? workbenches : workbenches.slice(0, SHOW_WORKBENCHES);
  const shownForms = showAllForms ? forms : forms.slice(0, SHOW_FORMS);

  const openWorkbench = (id) => {
    setActiveWb(id);
    setFocusedForm(null);
  };

  const focusForm = (form) => {
    setActiveWb(form.workbenchId);
    setFocusedForm(form.id);
  };

  /** Only "Edit form" opens the builder. Clicking a row just selects it. */
  const openBuilder = (form) => navigate(`/forms/${form.id}/edit`);

  /* ---------------- dialog plumbing ---------------- */

  const ask = (config) => {
    setDialog(config);
    setDialogError("");
    setDialogOpen(true);
  };

  const closeDialog = () => {
    if (!dialogBusy) setDialogOpen(false);
  };

  /** Runs the dialog's action. A string it returns becomes the success notice. */
  const submitDialog = async (values) => {
    setDialogBusy(true);
    setDialogError("");
    try {
      const message = await dialog.onConfirm(values);
      setDialogOpen(false);
      if (typeof message === "string") setNotice(message);
    } catch (err) {
      setDialogError(err.message);
    } finally {
      setDialogBusy(false);
    }
  };

  /** For actions that need no input (moving a form). */
  const run = async (fn, successMessage) => {
    setError("");
    try {
      await fn();
      if (successMessage) setNotice(successMessage);
    } catch (err) {
      setError(err.message);
    }
  };

  /* ---------------- workbench actions ---------------- */

  const addWorkbench = () =>
    ask({
      title: "New workbench",
      description: `A workbench groups related forms. Each one holds up to ${FORM_LIMIT}.`,
      confirmLabel: "Create workbench",
      fields: [
        {
          name: "name",
          label: "Workbench name",
          placeholder: "e.g. Festive gifting",
          maxLength: 120,
        },
      ],
      onConfirm: async ({ name }) => {
        const { workbench } = await api.createWorkbench(name.trim());
        await refresh();
        openWorkbench(workbench.id);
        return "Workbench created.";
      },
    });

  const renameWorkbench = () =>
    ask({
      title: "Rename workbench",
      confirmLabel: "Save name",
      fields: [
        {
          name: "name",
          label: "Workbench name",
          defaultValue: activeWorkbench.name,
          maxLength: 120,
        },
      ],
      onConfirm: async ({ name }) => {
        await api.renameWorkbench(activeWorkbench.id, name.trim());
        await refresh();
        return "Workbench renamed.";
      },
    });

  const deleteWorkbench = () => {
    const n = activeCount;
    ask({
      title: `Delete ${activeWorkbench.name}?`,
      description: `This deletes the workbench and its ${n} form${n === 1 ? "" : "s"}, with every response. It cannot be undone.`,
      confirmLabel: "Delete workbench",
      danger: true,
      onConfirm: async () => {
        await api.deleteWorkbench(activeWorkbench.id);
        await refresh();
        openWorkbench("all");
        return "Workbench deleted.";
      },
    });
  };

  /* ---------------- form actions ---------------- */

  const createForm = () => {
    if (!workbenches.length) {
      setError("Create a workbench first. Forms live inside one.");
      return;
    }
    if (activeFull) {
      setError(`${activeWorkbench.name} already holds ${FORM_LIMIT} forms. Delete one or pick another workbench.`);
      return;
    }

    // In "All forms" the dialog asks where the form should go.
    const pick = !activeWorkbench;
    const firstOpen = workbenches.find((w) => countIn(w.id) < FORM_LIMIT);

    ask({
      title: "Create a form",
      description: "Give it a name. You can change it at any time.",
      confirmLabel: "Create form",
      fields: [
        {
          name: "name",
          label: "Form name",
          placeholder: "e.g. Diwali hamper request",
          maxLength: 160,
        },
        ...(pick
          ? [
              {
                name: "workbenchId",
                type: "select",
                label: "Workbench",
                defaultValue: firstOpen ? String(firstOpen.id) : "",
                options: workbenches.map((w) => {
                  const full = countIn(w.id) >= FORM_LIMIT;
                  return {
                    value: String(w.id),
                    label: `${w.name} (${countIn(w.id)}/${FORM_LIMIT})${full ? " — full" : ""}`,
                    disabled: full,
                  };
                }),
              },
            ]
          : []),
      ],
      onConfirm: async ({ name, workbenchId }) => {
        const target = pick ? Number(workbenchId) : activeWorkbench.id;
        const { form } = await api.createForm(target, name.trim());
        navigate(`/forms/${form.id}/edit`);
      },
    });
  };

  const renameForm = (form) =>
    ask({
      title: "Rename form",
      confirmLabel: "Save name",
      fields: [{ name: "name", label: "Form name", defaultValue: form.name, maxLength: 160 }],
      onConfirm: async ({ name }) => {
        await api.updateForm(form.id, { name: name.trim() });
        await refresh();
        return "Form renamed.";
      },
    });

  const deleteForm = (form) =>
    ask({
      title: `Delete ${form.name}?`,
      description: "The form and all of its responses are removed. This cannot be undone.",
      confirmLabel: "Delete form",
      danger: true,
      onConfirm: async () => {
        await api.deleteForm(form.id);
        await refresh();
        return "Form deleted.";
      },
    });

  const moveForm = (form, workbenchId) =>
    run(async () => {
      await api.moveForm(form.id, workbenchId);
      await refresh();
    }, `Moved to ${wbName(workbenchId)}.`);

  const usedPct = Math.min(100, Math.round((activeCount / FORM_LIMIT) * 100));


  return (
    <div className="fx">
      {/* ================= top bar ================= */}
      <header className="fx-topbar">
        <Link to="/forms" className="brand">
          companystore<span className="brand-dot">.io</span>
        </Link>

        <ProfileMenu homeTo="/" />
      </header>

      <div className="fx-body">
        {/* ================= sidebar ================= */}
        <aside className="fx-side">
          <div className="fx-side-top">
            <button type="button" className="fx-btn fx-btn-primary fx-btn-block" onClick={createForm}>
              <Icon name="plus" />
              Create form
            </button>

            <label className="fx-search">
              <Icon name="search" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search forms"
                aria-label="Search forms"
              />
            </label>
          </div>

          <nav className="fx-side-scroll" aria-label="Workbenches and forms">
            <div className="fx-side-section">
              <div className="fx-side-label">
                <span>Workbenches</span>
                <button
                  type="button"
                  className="fx-icon-btn fx-icon-sm"
                  onClick={addWorkbench}
                  aria-label="New workbench"
                  title="New workbench"
                >
                  <Icon name="plus" size={15} />
                </button>
              </div>

              <ul className="fx-nav">
                {shownWorkbenches.map((wb) => {
                  const n = countIn(wb.id);
                  return (
                    <li key={wb.id}>
                      <button
                        type="button"
                        className={wb.id === activeWb ? "fx-nav-item is-on" : "fx-nav-item"}
                        onClick={() => openWorkbench(wb.id)}
                      >
                        <Icon name="folder" />
                        <span className="fx-nav-text">{wb.name}</span>
                        <span className={n >= FORM_LIMIT ? "fx-count is-full" : "fx-count"}>
                          {n}/{FORM_LIMIT}
                        </span>
                      </button>
                    </li>
                  );
                })}
                {!loading && !workbenches.length && (
                  <li className="fx-side-empty">No workbenches yet.</li>
                )}
                {workbenches.length > SHOW_WORKBENCHES && (
                  <li>
                    <MoreToggle
                      open={showAllWb}
                      hidden={workbenches.length - SHOW_WORKBENCHES}
                      noun="workbenches"
                      onClick={() => setShowAllWb((v) => !v)}
                    />
                  </li>
                )}
              </ul>
            </div>

            <div className="fx-side-section">
              <div className="fx-side-label">
                <span>Forms</span>
                <span className="fx-count">{forms.length}</span>
              </div>

              <ul className="fx-nav">
                <li>
                  <button
                    type="button"
                    className={activeWb === "all" ? "fx-nav-item is-on" : "fx-nav-item"}
                    onClick={() => openWorkbench("all")}
                  >
                    <Icon name="file" />
                    <span className="fx-nav-text">All forms</span>
                  </button>
                </li>
                {shownForms.map((f) => (
                  <li key={f.id}>
                    <button
                      type="button"
                      className={focusedForm === f.id ? "fx-nav-item fx-nav-sub is-on" : "fx-nav-item fx-nav-sub"}
                      onClick={() => focusForm(f)}
                    >
                      <span className="fx-dot" style={{ backgroundColor: f.colour }} aria-hidden="true" />
                      <span className="fx-nav-text">{f.name}</span>
                    </button>
                  </li>
                ))}
                {forms.length > SHOW_FORMS && (
                  <li>
                    <MoreToggle
                      open={showAllForms}
                      hidden={forms.length - SHOW_FORMS}
                      noun="forms"
                      onClick={() => setShowAllForms((v) => !v)}
                    />
                  </li>
                )}
              </ul>
            </div>
          </nav>
        </aside>

        {/* ================= main ================= */}
        <main className="fx-main">
          <header className="fx-head">
            <div className="fx-head-main">
              <div className="fx-title-row">
                <h1 className="fx-title">{activeName}</h1>

                {activeWorkbench && (
                  <div className="fx-title-actions">

                    <Dropdown align="start">
                      <Dropdown.Toggle as={Trigger} label="Workbench options">
                        <Dots />
                      </Dropdown.Toggle>
                      <Menu className="fx-menu">
                        <Dropdown.Item onClick={renameWorkbench}>
                          <Icon name="pencil" />
                          Rename
                        </Dropdown.Item>
                        <Dropdown.Divider />
                        <Dropdown.Item className="fx-danger" onClick={deleteWorkbench}>
                          <Icon name="trash" />
                          Delete
                        </Dropdown.Item>
                      </Menu>
                    </Dropdown>
                  </div>
                )}
              </div>

              {activeWorkbench ? (
                <div className="fx-usage">
                  <span className="fx-usage-bar" aria-hidden="true">
                    <span
                      className={activeFull ? "fx-usage-fill is-full" : "fx-usage-fill"}
                      style={{ width: `${usedPct}%` }}
                    />
                  </span>
                  <span className={activeFull ? "fx-usage-text is-full" : "fx-usage-text"}>
                    {activeCount} of {FORM_LIMIT} forms used
                  </span>
                  {activeWorkbench.createdBy && (
                    <span className="fx-usage-text">· Created by {activeWorkbench.createdBy.name}</span>
                  )}
                </div>
              ) : (
                <p className="fx-sub">
                  {forms.length} form{forms.length === 1 ? "" : "s"} across {workbenches.length}{" "}
                  workbench{workbenches.length === 1 ? "" : "es"}
                </p>
              )}
            </div>

            <div className="fx-head-tools">
              <Dropdown align="end">
                <Dropdown.Toggle as={Trigger} look="fx-select" label="Sort forms">
                  <Icon name="sort" />
                  {SORTS[sort].label}
                  <Icon name="chevron" size={14} />
                </Dropdown.Toggle>
                <Menu className="fx-menu">
                  {Object.entries(SORTS).map(([key, s]) => (
                    <Dropdown.Item key={key} active={sort === key} onClick={() => setSort(key)}>
                      {s.label}
                    </Dropdown.Item>
                  ))}
                </Menu>
              </Dropdown>

              <div className="fx-segment" role="group" aria-label="View">
                <button
                  type="button"
                  className={view === "list" ? "is-on" : ""}
                  onClick={() => setView("list")}
                  aria-pressed={view === "list"}
                  aria-label="List view"
                  title="List view"
                >
                  <Icon name="list" />
                </button>
                <button
                  type="button"
                  className={view === "grid" ? "is-on" : ""}
                  onClick={() => setView("grid")}
                  aria-pressed={view === "grid"}
                  aria-label="Grid view"
                  title="Grid view"
                >
                  <Icon name="grid" />
                </button>
              </div>
            </div>
          </header>

          {(error || notice) && (
            <div className={error ? "fx-alert is-bad" : "fx-alert"} role="status">
              <span>{error || notice}</span>
              <button
                type="button"
                className="fx-icon-btn fx-icon-sm"
                onClick={() => {
                  setError("");
                  setNotice("");
                }}
                aria-label="Dismiss"
              >
                ×
              </button>
            </div>
          )}

          {/* ---------- content: the only scrolling region ---------- */}
          {loading ? (
            <div className="fx-state">
              <Spinner animation="border" size="sm" />
              <span>Loading forms…</span>
            </div>
          ) : visible.length === 0 ? (
            <div className="fx-state fx-empty">
              <span className="fx-empty-icon">
                <Icon name="file" size={22} />
              </span>
              <p className="fx-empty-title">
                {query ? `No forms match “${query}”` : "No forms here yet"}
              </p>
              <p className="fx-empty-sub">
                {query ? "Try a shorter search." : "Create a form to start collecting responses."}
              </p>
              {!query && (
                <button type="button" className="fx-btn fx-btn-primary" onClick={createForm}>
                  <Icon name="plus" />
                  Create form
                </button>
              )}
            </div>
          ) : view === "list" ? (
            <div className={activeWb === "all" ? "fx-table fx-table-all" : "fx-table"} role="table">
              <div className="fx-tr fx-thead" role="row">
                <span role="columnheader">Name</span>
                {activeWb === "all" && <span role="columnheader">Workbench</span>}
                <span role="columnheader" className="fx-col-status">Status</span>
                <span role="columnheader">Updated</span>
                <span role="columnheader" aria-label="Actions" />
              </div>

              <div className="fx-tbody">
                {visible.map((f) => (
                  <div
                    key={f.id}
                    role="row"
                    tabIndex={0}
                    className={focusedForm === f.id ? "fx-tr fx-row is-focused" : "fx-tr fx-row"}
                    onClick={() => setFocusedForm(f.id)}
                    onKeyDown={(e) => e.key === "Enter" && setFocusedForm(f.id)}
                  >
                    <span className="fx-name-cell" role="cell">
                      <span className="fx-tile" style={{ backgroundColor: f.colour }} aria-hidden="true">
                        {initialOf(f.name)}
                      </span>
                      <span className="fx-name-text">
                        <span className="fx-name">{f.name}</span>
                        <span className="fx-meta">Created {shortDate(f.created)}</span>
                      </span>
                    </span>
                    {activeWb === "all" && (
                      <span className="fx-muted fx-ellipsis" role="cell">
                        {wbName(f.workbenchId)}
                      </span>
                    )}
                    <span role="cell">
                      <StatusIcon status={f.status} />
                    </span>
                    <span className="fx-muted" role="cell">
                      {shortDate(f.updated)}
                    </span>
                    <span className="fx-cell-menu" role="cell">
                      <RowMenu
                        form={f}
                        workbenches={workbenches}
                        countIn={countIn}
                        onOpen={openBuilder}
                        onRename={renameForm}
                        onMove={moveForm}
                        onDelete={deleteForm}
                      />
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Same fixed box as the list: the cards scroll inside it, so a
               long list never squeezes a card out of shape. */
            <div className="fx-panel">
              <div className="fx-grid">
                {visible.map((f) => (
                  <article
                    key={f.id}
                    tabIndex={0}
                    className={focusedForm === f.id ? "fx-card is-focused" : "fx-card"}
                    onClick={() => setFocusedForm(f.id)}
                    onKeyDown={(e) => e.key === "Enter" && setFocusedForm(f.id)}
                  >
                    <span className="fx-card-stripe" style={{ backgroundColor: f.colour }} aria-hidden="true" />

                    <div className="fx-card-head">
                      <span className="fx-tile fx-card-tile" style={{ backgroundColor: f.colour }} aria-hidden="true">
                        {initialOf(f.name)}
                      </span>
                      <StatusIcon status={f.status} />
                      <RowMenu
                        form={f}
                        workbenches={workbenches}
                        countIn={countIn}
                        onOpen={openBuilder}
                        onRename={renameForm}
                        onMove={moveForm}
                        onDelete={deleteForm}
                      />
                    </div>

                    <h2 className="fx-card-name">{f.name}</h2>

                    <dl className="fx-card-facts">
                      <div>
                        <dt>Updated</dt>
                        <dd>{shortDate(f.updated)}</dd>
                      </div>
                      <div>
                        <dt>Workbench</dt>
                        <dd className="fx-ellipsis">{wbName(f.workbenchId)}</dd>
                      </div>
                    </dl>

                    <button type="button" className="fx-card-open" onClick={() => openBuilder(f)}>
                      Edit form
                      <Icon name="open" size={14} />
                    </button>
                  </article>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>

      <Dialog
        open={dialogOpen}
        config={dialog}
        busy={dialogBusy}
        error={dialogError}
        onSubmit={submitDialog}
        onClose={closeDialog}
        onExited={() => setDialog(null)}
      />
    </div>
  );
}

/* ---------------------------- pieces ---------------------------- */

/**
 * "Show all" / "Show less" for a sidebar section. It sits under the last
 * visible row, with the arrow in the right corner.
 */
function MoreToggle({ open, hidden, noun, onClick }) {
  return (
    <button type="button" className="fx-more" onClick={onClick} aria-expanded={open}>
      <span>{open ? "Show less" : `Show all ${noun}`}</span>
      {!open && <span className="fx-more-count">+{hidden}</span>}
      <span className={open ? "fx-more-arrow is-open" : "fx-more-arrow"}>
        <Icon name="chevron" size={15} />
      </span>
    </button>
  );
}

/** Status as a single icon. The label stays available to screen readers. */
function StatusIcon({ status }) {
  const s = STATUS[status] || STATUS.draft;
  return (
    <span className={`fx-status ${s.tone}`} title={s.label}>
      <Icon name={s.icon} size={15} />
      <span className="fx-sr">{s.label}</span>
    </span>
  );
}

// 
/** Two panes: the actions, and the "Move to" workbench picker. */
function RowMenu({ form, workbenches, countIn, onOpen, onRename, onMove, onDelete }) {
  const [pane, setPane] = useState("main");

  return (
    <Dropdown
      align="end"
      autoClose="outside"
      onToggle={(open) => !open && setPane("main")}
      onClick={(e) => e.stopPropagation()}
    >
      <Dropdown.Toggle as={Trigger} label={`Options for ${form.name}`}>
        <Dots />
      </Dropdown.Toggle>

      <Menu className="fx-menu">
        {pane === "main" ? (
          <>
            <Dropdown.Item onClick={() => onOpen(form)}>
              <Icon name="open" />
              Edit form
            </Dropdown.Item>
            <Dropdown.Item onClick={() => onRename(form)}>
              <Icon name="pencil" />
              Rename
            </Dropdown.Item>
            <button type="button" className="dropdown-item fx-menu-more" onClick={() => setPane("move")}>
              <Icon name="move" />
              Move to
              <span className="fx-menu-chev">
                <Icon name="chevron" size={14} />
              </span>
            </button>
            <Dropdown.Divider />
            <Dropdown.Item className="fx-danger" onClick={() => onDelete(form)}>
              <Icon name="trash" />
              Delete
            </Dropdown.Item>
          </>
        ) : (
          <>
            <button type="button" className="dropdown-item fx-menu-back" onClick={() => setPane("main")}>
              <Icon name="back" size={14} />
              Move to
            </button>
            <Dropdown.Divider />
            {workbenches.map((wb) => {
              const n = countIn(wb.id);
              const full = n >= FORM_LIMIT;
              const here = wb.id === form.workbenchId;
              return (
                <Dropdown.Item
                  key={wb.id}
                  disabled={here || full}
                  onClick={() => onMove(form, wb.id)}
                  className="fx-move"
                >
                  <span className="fx-ellipsis">{wb.name}</span>
                  <span className="fx-move-count">
                    {here ? "Current" : full ? "Full" : `${n}/${FORM_LIMIT}`}
                  </span>
                </Dropdown.Item>
              );
            })}
          </>
        )}
      </Menu>
    </Dropdown>
  );
}