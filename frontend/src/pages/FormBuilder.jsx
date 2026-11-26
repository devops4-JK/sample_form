import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Modal, Spinner } from "react-bootstrap";
import { api } from "../services/api";
import { BY_TYPE, INPUT_TYPES, makeField, makePage } from "../constants/formElements";
import AddContentModal, { ElementTile } from "../components/builder/AddContentModal";
import FieldPreview from "../components/builder/FieldPreview";
import FieldSettings from "../components/builder/FieldSettings";
import PreviewModal from "../components/builder/PreviewModal";
import ConnectPanel from "../components/builder/ConnectPanel";
import ValidationPanel from "../components/validation/ValidationPanel";
import WorkflowPanel from "../components/workflow/WorkflowPanel";
import useWorkflow from "../components/workflow/useWorkflow";
import useConfirm from "../components/builder/useConfirm";
import DesignStudio from "../components/design/DesignStudio";
import ThemedForm from "../components/design/ThemedForm";
import MediaSettings from "../components/builder/MediaSettings";
import SettingsSection, { SectionGroup } from "../components/builder/SettingsSection";
import { pageMedia } from "../components/builder/PageMedia";

/* Validation sits between building the form and sharing it: you decide
   who may fill it in before you hand the link out. */
const TABS = ["Content", "Workflow", "Validation", "Connect", "Results"];

/**
 * Where you are in the builder lives in the address bar, not in memory:
 *
 *   ?tab=connect      which of the four sections is open
 *   ?view=preview     the full-screen preview is open
 *   ?view=design      the Design section is open
 *   ?theme=12         …and which theme is being edited in it
 *   ?page=p_abc       which page is selected on the Content tab
 *
 * A refresh reads these back, so it lands on the section you were on
 * instead of dropping you on Content every time.
 */
const tabFromUrl = (params) =>
  TABS.find((t) => t.toLowerCase() === (params.get("tab") || "").toLowerCase()) || "Content";

const I = {
  back: "m15 18-6-6 6-6",
  plus: "M12 5v14M5 12h14",
  play: "M7 5v14l11-7z",
  copy: "M8 8h11v11H8zM5 16H4V4h12v1",
  trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  grip: "M9 6h.01M9 12h.01M9 18h.01M15 6h.01M15 12h.01M15 18h.01",
  image: "M3 5h18v14H3zM5 17l5-5 3 3 3-2 5 4M9 9.5a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4",
  pencil: "M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4",
  palette: "M12 21a9 9 0 1 1 9-9c0 2-1.6 3-3.2 3H16a2 2 0 0 0-1.4 3.4A1.9 1.9 0 0 1 12 21M7.5 12.5h.01M10 8.5h.01M14.5 8h.01",
  // Side-rail sections.
  content: "M4 4h16v16H4zM8 9h8M8 13h8M8 17h5",
  workflow: "M6 3v12M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6M18 9a9 9 0 0 1-9 9",
  validation: "M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6zM9 12l2 2 4-4",
  connect: "M10 13a5 5 0 0 0 7.1 0l3-3a5 5 0 0 0-7.1-7.1l-1 1M14 11a5 5 0 0 0-7.1 0l-3 3a5 5 0 0 0 7.1 7.1l1-1",
  results: "M4 20h16M7 16v-5M12 16V7M17 16v-8",
};

/** What each section is called in the side rail, and its icon. */
const RAIL = {
  Content: { icon: "content", hint: "Pages and questions" },
  Workflow: { icon: "workflow", hint: "Logic, fields and endings" },
  Validation: { icon: "validation", hint: "Who can fill the form" },
  Connect: { icon: "connect", hint: "Link, Sheets and Excel" },
  Results: { icon: "results", hint: "Responses so far" },
};

function Glyph({ d, size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

/** A new form opens with one page holding a welcome screen. */
function starterSchema() {
  const page = makePage("Welcome");
  page.fields = [makeField("welcome_screen")];
  return { pages: [page] };
}

/**
 * Older forms were saved as a flat { fields: [] }. Wrap that into a single
 * page so nothing built before pages existed is lost.
 */
function normalise(schema) {
  if (schema?.pages?.length) return schema;
  if (schema?.fields?.length) {
    const page = makePage("Page 1");
    page.fields = schema.fields;
    return { pages: [page] };
  }
  return starterSchema();
}

const letter = (i) => String.fromCharCode(65 + (i % 26));

export default function FormBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [confirmDialog, confirm] = useConfirm();
  // The logic jumps between pages. Held here so Preview walks them too.
  const flow = useWorkflow(id);

  const [form, setForm] = useState(null);
  const [pages, setPages] = useState([]);
  const [pageId, setPageId] = useState(null);
  const [fieldId, setFieldId] = useState(null); // null means the page itself is selected
  const [answers, setAnswers] = useState({});

  /* Section, preview and design are read from the address bar, so they
     survive a refresh. `replace` keeps the Back button meaning "leave the
     builder" rather than stepping back through every tab you clicked. */
  const tab = tabFromUrl(params);
  const showPreview = params.get("view") === "preview";
  const showDesign = params.get("view") === "design";

  const patchUrl = useCallback(
    (patch) =>
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          Object.entries(patch).forEach(([key, value]) => {
            if (value === null || value === undefined || value === "") next.delete(key);
            else next.set(key, String(value));
          });
          return next;
        },
        { replace: true }
      ),
    [setParams]
  );

  const setTab = (t) => patchUrl({ tab: t === "Content" ? null : t.toLowerCase() });
  const setShowPreview = (on) => patchUrl({ view: on ? "preview" : null });
  const setShowDesign = (on) => patchUrl({ view: on ? "design" : null, theme: null });

  const [showAdd, setShowAdd] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saveState, setSaveState] = useState("saved");

  const dragFrom = useRef(null);
  const firstRender = useRef(true);

  /* The builder is a full-screen workspace: the app's top bar and footer
     step aside while it is open, and come back when you leave. */
  useEffect(() => {
    document.body.classList.add("fb-locked");
    return () => document.body.classList.remove("fb-locked");
  }, []);

  /* ---------------- load ---------------- */

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { form } = await api.getForm(id);
        if (!alive) return;
        const schema = normalise(form.schema);
        setForm(form);
        setPages(schema.pages);
        // Reopen the page that was selected before a refresh, if it still exists.
        const wanted = new URLSearchParams(window.location.search).get("page");
        const start = schema.pages.find((p) => p.id === wanted) || schema.pages[0];
        setPageId(start?.id ?? null);
        setFieldId(start?.fields[0]?.id ?? null);
      } catch (err) {
        if (alive) setError(err.message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  /* ---------------- autosave ---------------- */

  useEffect(() => {
    if (loading) return undefined;
    if (firstRender.current) {
      firstRender.current = false;
      return undefined;
    }
    setSaveState("saving");
    const t = setTimeout(async () => {
      try {
        await api.updateForm(id, { schema: { pages } });
        setSaveState("saved");
      } catch (err) {
        setSaveState("error");
        setError(err.message);
      }
    }, 700);
    return () => clearTimeout(t);
  }, [pages, id, loading]);

  /* Remember the selected page across a refresh. */
  useEffect(() => {
    if (loading || !pageId) return;
    if (params.get("page") !== pageId) patchUrl({ page: pageId });
  }, [pageId, loading, params, patchUrl]);

  /* ---------------- selection ---------------- */

  const pageIndex = pages.findIndex((p) => p.id === pageId);
  const page = pageIndex >= 0 ? pages[pageIndex] : null;
  const field = useMemo(() => page?.fields.find((f) => f.id === fieldId) || null, [page, fieldId]);

  const patchPage = useCallback(
    (targetId, patch) =>
      setPages((list) => list.map((p) => (p.id === targetId ? { ...p, ...patch } : p))),
    []
  );

  const selectPage = (p) => {
    setPageId(p.id);
    setFieldId(null);
  };

  /* ---------------- page actions ---------------- */

  const addPage = () => {
    const next = makePage(`Page ${pages.length + 1}`);
    setPages((list) => [...list, next]);
    setPageId(next.id);
    setFieldId(null);
  };

  const deletePage = async (target) => {
    if (pages.length === 1) return;
    const n = target.fields.length;
    const ok = await confirm({
      title: `Delete ${target.name || "this page"}?`,
      body:
        n > 0
          ? `The page and its ${n} item${n === 1 ? "" : "s"} are removed from the form. Answers already collected are kept.`
          : "The empty page is removed from the form.",
      action: "Delete page",
    });
    if (!ok) return;
    setPages((list) => {
      const next = list.filter((p) => p.id !== target.id);
      if (target.id === pageId) {
        setPageId(next[0].id);
        setFieldId(next[0].fields[0]?.id ?? null);
      }
      return next;
    });
  };

  /* ---------------- field actions ---------------- */

  const addField = (type) => {
    if (!page) return;
    const next = makeField(type);
    patchPage(page.id, { fields: [...page.fields, next] });
    setFieldId(next.id);
  };

  const updateField = (next) =>
    patchPage(page.id, { fields: page.fields.map((f) => (f.id === next.id ? next : f)) });

  const deleteField = async (target, owner = page) => {
    const spec = BY_TYPE[target.type];
    const ok = await confirm({
      title: `Delete this ${spec.name.toLowerCase()}?`,
      body: `“${target.label || spec.name}” is removed from ${owner.name || "the page"}. Answers already collected are kept.`,
      action: "Delete",
    });
    if (!ok) return;
    const rest = owner.fields.filter((f) => f.id !== target.id);
    patchPage(owner.id, { fields: rest });
    if (target.id === fieldId) setFieldId(rest[0]?.id ?? null);
  };

  const duplicateField = (target) => {
    const copy = { ...structuredClone(target), id: makeField(target.type).id };
    const at = page.fields.findIndex((f) => f.id === target.id);
    patchPage(page.id, {
      fields: [...page.fields.slice(0, at + 1), copy, ...page.fields.slice(at + 1)],
    });
    setFieldId(copy.id);
  };

  /** Drag to reorder fields within the selected page. */
  const onDrop = (to) => {
    const from = dragFrom.current;
    dragFrom.current = null;
    if (from === null || from === to) return;
    const next = [...page.fields];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    patchPage(page.id, { fields: next });
  };

  /* ---------------- form actions ---------------- */

  const saveName = async (name) => {
    const { form: updated } = await api.updateForm(id, { name });
    setForm((f) => ({ ...f, ...updated }));
  };

  /** Copies the design onto the live link, without touching the questions. */
  const pushDesignLive = async () => {
    try {
      await api.publishThemeToLive(id);
      setForm((f) => ({ ...f, liveTheme: f.theme, liveIsBehind: false }));
    } catch (err) {
      setError(err.message);
    }
  };

  /** Re-reads the form's theme after the Design section closes. */
  const refreshTheme = async () => {
    try {
      const { theme, liveIsBehind } = await api.formTheme(id);
      setForm((f) => ({ ...f, theme, liveIsBehind }));
    } catch {
      /* The canvas simply keeps the look it already has. */
    }
  };

  const togglePublish = async () => {
    if (form.status === "published") {
      const ok = await confirm({
        title: "Unpublish this form?",
        body: "The public link stops accepting answers until you publish again. Collected answers stay safe.",
        action: "Unpublish",
      });
      if (!ok) return;
    }
    try {
      const publishing = form.status !== "published";
      const { form: updated } = await api.updateForm(id, {
        status: publishing ? "published" : "draft",
      });
      setForm((f) => ({
        ...f,
        ...updated,
        ...(publishing ? { liveTheme: f.theme, liveIsBehind: false } : {}),
      }));
    } catch (err) {
      setError(err.message);
    }
  };

  /* ---------------- render ---------------- */

  if (loading) {
    return (
      <div className="fb-state">
        <Spinner animation="border" size="sm" />
      </div>
    );
  }

  if (!form) {
    return (
      <div className="fb-state">
        <p>{error || "That form could not be opened."}</p>
        <button type="button" className="fb-btn" onClick={() => navigate("/forms")}>
          Back to forms
        </button>
      </div>
    );
  }

  const live = form.status === "published";
  const fieldPosition = field ? `Page ${pageIndex + 1} · ${letter(page.fields.indexOf(field))}` : "";

  return (
    <div className="fb">
      {/* ================= header ================= */}
      <header className="fb-top">
        <div className="fb-top-left">
          <Link to="/forms" className="fb-icon" aria-label="Back to forms" title="Back to forms">
            <Glyph d={I.back} size={18} />
          </Link>
          <div className="fb-crumb">
            <Link to="/forms" className="fb-crumb-link">
              Forms
            </Link>
            <span className="fb-crumb-sep">/</span>
            <button type="button" className="fb-crumb-name" onClick={() => setRenaming(true)} title="Rename form">
              <span className="fb-ellipsis">{form.name}</span>
              <Glyph d={I.pencil} size={13} />
            </button>
          </div>
        </div>

        <div className="fb-top-right">
          <span className={`fb-save is-${saveState}`} aria-live="polite">
            <span className="fb-save-dot" aria-hidden="true" />
            {saveState === "saving" ? "Saving…" : saveState === "error" ? "Not saved" : "All changes saved"}
          </span>
          <button type="button" className="fb-btn" onClick={() => setShowPreview(true)}>
            <Glyph d={I.play} size={14} />
            Preview
          </button>
          {live && form.liveIsBehind && (
            <button
              type="button"
              className="fb-btn fb-btn-primary"
              onClick={pushDesignLive}
              title="Send the current design to the published link"
            >
              Update live form
            </button>
          )}
          {live ? (
            <button type="button" className="fb-btn fb-btn-live" onClick={togglePublish} title="Click to unpublish">
              <span className="fb-live-dot" aria-hidden="true" />
              Live
            </button>
          ) : (
            <button type="button" className="fb-btn fb-btn-primary" onClick={togglePublish}>
              Publish
            </button>
          )}
        </div>
      </header>

      {error && (
        <div className="fb-alert fb-alert-bar" role="status">
          <span>{error}</span>
          <button type="button" className="fb-icon" onClick={() => setError("")} aria-label="Dismiss">
            ×
          </button>
        </div>
      )}

      {/* ================= side rail + the open section ================= */}
      <div className="fb-frame">
        <nav className="fb-rail" aria-label="Form sections">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              className={t === tab ? "fb-rail-item is-on" : "fb-rail-item"}
              onClick={() => setTab(t)}
              aria-current={t === tab ? "page" : undefined}
              title={`${t} · ${RAIL[t].hint}`}
            >
              <span className="fb-rail-icon">
                <Glyph d={I[RAIL[t].icon]} size={19} />
              </span>
              <span className="fb-rail-label">{t}</span>
            </button>
          ))}

          <span className="fb-rail-sep" aria-hidden="true" />

          <button
            type="button"
            className={showDesign ? "fb-rail-item is-on" : "fb-rail-item"}
            onClick={() => setShowDesign(true)}
            title="Design · Themes, colours and type"
          >
            <span className="fb-rail-icon">
              <Glyph d={I.palette} size={19} />
            </span>
            <span className="fb-rail-label">Design</span>
          </button>
        </nav>

        <div className="fb-view">
          {/* ================= content ================= */}
          {tab === "Content" && (
            <div className="fb-body">
              {/* ---------- pages ---------- */}
              <aside className="fb-panel fb-panel-left" aria-label="Pages">
                <header className="fb-panel-head">
                  <div className="fb-panel-titles">
                    <span className="fb-panel-title">Pages</span>
                    <span className="fb-panel-sub">
                      {pages.length} page{pages.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <button type="button" className="fb-btn fb-btn-sm" onClick={addPage}>
                    <Glyph d={I.plus} size={14} />
                    Page
                  </button>
                </header>

                <div className="fb-pages">
                  {pages.map((p, pi) => {
                    const active = p.id === pageId;
                    return (
                      <section key={p.id} className={active ? "fb-pg is-on" : "fb-pg"}>
                        <div className="fb-pg-head">
                          <button type="button" className="fb-pg-select" onClick={() => selectPage(p)}>
                            <span className="fb-pg-num">{pi + 1}</span>
                            <span className="fb-pg-name fb-ellipsis">{p.name || `Page ${pi + 1}`}</span>
                            <span className="fb-pg-count">{p.fields.length}</span>
                          </button>
                          <button
                            type="button"
                            className="fb-icon fb-icon-sm fb-icon-danger fb-reveal"
                            onClick={() => deletePage(p)}
                            disabled={pages.length === 1}
                            aria-label={`Delete ${p.name}`}
                            title={pages.length === 1 ? "A form needs at least one page" : "Delete page"}
                          >
                            <Glyph d={I.trash} size={14} />
                          </button>
                        </div>

                        {p.fields.length > 0 && (
                          <ul className="fb-items">
                            {p.fields.map((f, i) => {
                              const spec = BY_TYPE[f.type];
                              const selected = active && f.id === fieldId;
                              return (
                                <li
                                  key={f.id}
                                  className={selected ? "fb-item is-on" : "fb-item"}
                                  draggable={active}
                                  onDragStart={() => {
                                    dragFrom.current = i;
                                  }}
                                  onDragOver={(e) => e.preventDefault()}
                                  onDrop={() => active && onDrop(i)}
                                >
                                  <button
                                    type="button"
                                    className="fb-item-select"
                                    onClick={() => {
                                      setPageId(p.id);
                                      setFieldId(f.id);
                                    }}
                                  >
                                    <span className="fb-item-letter">{letter(i)}</span>
                                    <ElementTile element={spec} size={13} />
                                    <span className="fb-item-text">{f.label || spec.name}</span>
                                  </button>
                                  <button
                                    type="button"
                                    className="fb-icon fb-icon-sm fb-icon-danger fb-reveal"
                                    onClick={() => deleteField(f, p)}
                                    aria-label={`Delete ${f.label || spec.name}`}
                                    title="Delete"
                                  >
                                    <Glyph d={I.trash} size={13} />
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        )}

                        {active && (
                          <button type="button" className="fb-add-inline" onClick={() => setShowAdd(true)}>
                            <Glyph d={I.plus} size={14} />
                            Add content
                          </button>
                        )}
                      </section>
                    );
                  })}
                </div>
              </aside>

              {/* ---------- canvas ---------- */}
              <main className="fb-stage">
                <div className="fb-toolbar">
                  <div className="fb-toolbar-info">
                    <span className="fb-toolbar-page">Page {pageIndex + 1} of {pages.length}</span>
                    <span className="fb-toolbar-name fb-ellipsis">{page?.name}</span>
                  </div>
                  {/* Add content lives in the pages panel; this slot is Design. */}
                  <button type="button" className="fb-btn" onClick={() => setShowDesign(true)}>
                    <Glyph d={I.palette} size={15} />
                    Design
                  </button>
                </div>

                <div className="fb-canvas-wrap">
                  {/* Fixed-size sheet with a light border. Long pages scroll
                      inside it, with no visible scrollbar. */}
                  <div className="fb-canvas">
                    {/* The form is built in the theme it wears, so what you see
                        here is what the published page will look like. */}
                    {/* The page's background, in the layout chosen for it —
                        the same full-width split the Design section uses. */}
                    <ThemedForm theme={form.theme?.config} media={pageMedia(page)}>
                    <div className={page?.fields.length === 1 ? "fb-canvas-inner is-single" : "fb-canvas-inner"}>
                      {!page || page.fields.length === 0 ? (
                        <div className="fb-empty">
                          <span className="fb-empty-icon">
                            <Glyph d={I.plus} size={22} />
                          </span>
                          <p className="fb-empty-title">This page is empty</p>
                          <p className="fb-empty-sub">Add questions, text or screens to build it up.</p>
                          <button type="button" className="fb-btn fb-btn-primary" onClick={() => setShowAdd(true)}>
                            Add content
                          </button>
                        </div>
                      ) : (
                        <>
                          {page.fields.map((f) => (
                            <div
                              key={f.id}
                              role="button"
                              tabIndex={0}
                              className={f.id === fieldId ? "fb-slot is-on" : "fb-slot"}
                              onClick={() => setFieldId(f.id)}
                              onKeyDown={(e) => e.key === "Enter" && e.target === e.currentTarget && setFieldId(f.id)}
                            >
                              <div className="fb-slot-tools" onClick={(e) => e.stopPropagation()}>
                                <button type="button" className="fb-icon fb-icon-sm" onClick={() => duplicateField(f)}
                                  aria-label="Duplicate" title="Duplicate">
                                  <Glyph d={I.copy} size={14} />
                                </button>
                                <button type="button" className="fb-icon fb-icon-sm fb-icon-danger" onClick={() => deleteField(f)}
                                  aria-label="Delete" title="Delete">
                                  <Glyph d={I.trash} size={14} />
                                </button>
                              </div>
                              <FieldPreview
                                field={f}
                                value={answers[f.id]}
                                onChange={(v) => setAnswers((a) => ({ ...a, [f.id]: v }))}
                              />
                            </div>
                          ))}

                        </>
                      )}
                    </div>
                    </ThemedForm>
                  </div>
                </div>
              </main>

              {/* ---------- settings ---------- */}
              {field ? (
                <FieldSettings
                  key={field.id}
                  field={field}
                  position={fieldPosition}
                  onChange={updateField}
                  onDelete={() => deleteField(field)}
                  onDuplicate={() => duplicateField(field)}
                  confirm={confirm}
                />
              ) : (
                <PageSettings
                  page={page}
                  index={pageIndex}
                  canDelete={pages.length > 1}
                  onChange={(patch) => patchPage(page.id, patch)}
                  onDelete={() => deletePage(page)}
                />
              )}
            </div>
          )}

          {/* ================= workflow ================= */}
          {tab === "Workflow" && (
            <div className="wf-host">
              <WorkflowPanel
                form={form}
                pages={pages}
                workflow={flow.workflow}
                setWorkflow={flow.setWorkflow}
                ready={flow.ready}
                saveState={flow.saveState}
                error={flow.error}
                confirm={confirm}
                onPreview={() => setShowPreview(true)}
                onOpenContent={() => setTab("Content")}
              />
            </div>
          )}

          {/* ================= validation ================= */}
          {tab === "Validation" && (
            <div className="fb-scroll">
              <ValidationPanel form={form} confirm={confirm} />
            </div>
          )}

          {/* ================= connect ================= */}
          {tab === "Connect" && (
            <div className="fb-scroll">
              <ConnectPanel form={form} onTogglePublish={togglePublish} confirm={confirm} />
            </div>
          )}

          {/* ================= results ================= */}
          {tab === "Results" && (
            <div className="fb-scroll">
              <ResultsPanel form={form} pages={pages} />
            </div>
          )}
        </div>
      </div>

      <AddContentModal
        show={showAdd}
        onClose={() => setShowAdd(false)}
        onPick={addField}
        pageName={page ? `page ${pageIndex + 1}${page.name ? `, ${page.name}` : ""}` : ""}
      />
      <PreviewModal
        show={showPreview}
        onClose={() => setShowPreview(false)}
        pages={pages}
        workflow={flow.workflow}
        theme={form.theme?.config}
      />
      <DesignStudio
        show={showDesign}
        onClose={() => {
          setShowDesign(false);
          refreshTheme();
        }}
        formId={form.id}
        formName={form.name}
        initialThemeId={params.get("theme")}
        onEditingChange={(themeId) => showDesign && patchUrl({ theme: themeId })}
      />
      <RenameDialog
        show={renaming}
        name={form.name}
        onClose={() => setRenaming(false)}
        onSave={saveName}
      />
      {confirmDialog}
    </div>
  );
}

/* ---------------------------- page settings ---------------------------- */

/** Shown on the right when a page is selected rather than one of its fields. */
function PageSettings({ page, index, canDelete, onChange, onDelete }) {
  if (!page) {
    return (
      <aside className="fb-panel fb-panel-right">
        <p className="fb-panel-empty">Pick a page or a question to edit it.</p>
      </aside>
    );
  }

  return (
    <aside className="fb-panel fb-panel-right" aria-label="Page settings">
      <header className="fb-panel-head">
        <span className="fb-pg-num fb-pg-num-lg">{index + 1}</span>
        <div className="fb-panel-titles">
          <span className="fb-panel-title">Page settings</span>
          <span className="fb-panel-sub">
            {page.fields.length} item{page.fields.length === 1 ? "" : "s"}
          </span>
        </div>
        <button
          type="button"
          className="fb-icon fb-icon-danger"
          onClick={onDelete}
          disabled={!canDelete}
          aria-label="Delete page"
          title={canDelete ? "Delete page" : "A form needs at least one page"}
        >
          <Glyph d={I.trash} />
        </button>
      </header>

      <div className="fb-panel-body">
        <SectionGroup key={page.id} initial="Page">
          <SettingsSection title="Page">
            <label className="fb-field">
              <span className="fb-label">Page name</span>
              <input className="fb-input" value={page.name} onChange={(e) => onChange({ name: e.target.value })} />
              <span className="fb-hint">Only you see this. It labels the page in the list.</span>
            </label>
          </SettingsSection>

          {/* The page's background and where it sits: the same controls a
              welcome screen has. */}
          <MediaSettings owner={page} onChange={onChange} kind="page" />
        </SectionGroup>
      </div>
    </aside>
  );
}

/* ---------------------------- results ---------------------------- */

function ResultsPanel({ form, pages }) {
  const [questions, setQuestions] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    api
      .formQuestions(form.id)
      .then((res) => alive && setQuestions(res.questions))
      .catch((err) => alive && setError(err.message));
    return () => {
      alive = false;
    };
  }, [form.id]);

  const questionCount = pages.reduce((n, p) => n + p.fields.filter((f) => INPUT_TYPES.has(f.type)).length, 0);
  const rate = form.responses ? Math.round((form.completed / form.responses) * 100) : 0;

  return (
    <div className="cn">
      {/* Downloading lives on the Connect tab; this page only reports. */}
      <header className="cn-head">
        <h1 className="cn-title">Results</h1>
        <p className="cn-sub">Responses so far, and every question saved for {form.name}.</p>
      </header>

      {error && (
        <div className="fb-alert" role="status">
          <span>{error}</span>
        </div>
      )}

      <div className="rs-stats">
        <div className="rs-stat">
          <span className="rs-n">{form.responses}</span>
          <span className="rs-l">Responses</span>
        </div>
        <div className="rs-stat">
          <span className="rs-n">{form.completed}</span>
          <span className="rs-l">Completed</span>
        </div>
        <div className="rs-stat">
          <span className="rs-n">{rate}%</span>
          <span className="rs-l">Completion rate</span>
        </div>
        <div className="rs-stat">
          <span className="rs-n">{questionCount}</span>
          <span className="rs-l">Questions</span>
        </div>
      </div>

      <section className="cn-card cn-card-flush">
        <div className="cn-card-head cn-card-head-pad">
          <div className="cn-card-titles">
            <h2 className="cn-card-title">Saved questions</h2>
            <p className="cn-card-sub">Stored on the server with the form name, and updated every time you edit.</p>
          </div>
        </div>
        {questions === null ? (
          <div className="cn-loading cn-card-head-pad">
            <Spinner animation="border" size="sm" /> Loading…
          </div>
        ) : questions.length === 0 ? (
          <p className="cn-note cn-card-head-pad">No questions saved yet. Add some on the Content tab.</p>
        ) : (
          <div className="rs-table-wrap">
            <table className="rs-table">
              <thead>
                <tr>
                  <th>Page</th>
                  <th>#</th>
                  <th>Question</th>
                  <th>Type</th>
                  <th>Required</th>
                </tr>
              </thead>
              <tbody>
                {questions.map((q) => (
                  <tr key={q.id}>
                    <td className="rs-muted">{q.pageNumber}</td>
                    <td className="rs-muted">{letter(q.position - 1)}</td>
                    <td>{q.label || <span className="rs-muted">Untitled</span>}</td>
                    <td className="rs-muted">{BY_TYPE[q.type]?.name || q.type}</td>
                    <td>
                      {q.collectsAnswer ? (
                        q.required ? <span className="rs-yes">Yes</span> : <span className="rs-muted">No</span>
                      ) : (
                        <span className="rs-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

/* ---------------------------- rename ---------------------------- */

function RenameDialog({ show, name, onClose, onSave }) {
  const [value, setValue] = useState(name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (show) {
      setValue(name);
      setError("");
    }
  }, [show, name]);

  const submit = async (e) => {
    e.preventDefault();
    if (!value.trim()) {
      setError("Give the form a name.");
      return;
    }
    setBusy(true);
    try {
      await onSave(value.trim());
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal show={show} onHide={onClose} centered contentClassName="cf" backdropClassName="cf-backdrop">
      <form onSubmit={submit}>
        <div className="cf-body cf-body-left">
          <h2 className="cf-title">Rename form</h2>
          <label className="fb-field">
            <span className="fb-label">Form name</span>
            <input
              className="fb-input"
              value={value}
              maxLength={160}
              autoFocus
              onChange={(e) => setValue(e.target.value)}
            />
          </label>
          {error && <p className="cf-error">{error}</p>}
        </div>
        <div className="cf-foot">
          <button type="button" className="fb-btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="fb-btn fb-btn-primary" disabled={busy}>
            {busy ? "Saving…" : "Save name"}
          </button>
        </div>
      </form>
    </Modal>
  );
}