import { useCallback, useEffect, useState } from "react";
import { Modal, Spinner } from "react-bootstrap";
import ThemeGallery from "./ThemeGallery";
import ThemeEditor from "./ThemeEditor";
import NameDialog from "./NameDialog";
import useConfirm from "../builder/useConfirm";
import { api } from "../../services/api";
import { TEMPLATES, copyName, fillTheme, newTheme, uniqueName } from "./themes";
import "./design.css";

/**
 * The Design section of the form builder.
 *
 * It opens over the builder and holds two views: the gallery of themes and
 * the editor for one of them. Themes are saved on the server and shared,
 * the same way workbenches and forms are.
 *
 * Choosing one dresses the form you are building; the live link keeps the
 * look it was published with until the form is published again, so a
 * half-finished design never reaches the people filling it in.
 *
 * Edits are kept locally while you work and written back a moment after
 * you stop, so dragging a slider does not fire a request per pixel.
 */

/** A server row → the shape the panels work with. */
const fromRow = (row) => ({
  ...fillTheme(row.config || {}),
  id: row.id,
  name: row.name,
  tagline: row.tagline || null,
  uses: row.uses || 0,
});

/** The panels' shape → what the server stores. */
const toConfig = (theme) => {
  const { id, name, tagline, uses, template, ...config } = theme;
  return config;
};

const SAVE_DELAY = 700;

export default function DesignStudio({
  show,
  onClose,
  formId,
  formName = "this form",
  initialThemeId = null,
  onEditingChange,
}) {
  const [confirmDialog, confirm] = useConfirm();

  const [themes, setThemes] = useState([]);
  const [appliedId, setAppliedId] = useState(null);
  /* The builder keeps the open theme in the address bar and hands it back
     here after a refresh, so the editor reopens on the same theme. */
  const [editingId, setEditingId] = useState(() => {
    const n = Number(initialThemeId);
    return Number.isInteger(n) && n > 0 ? n : null;
  });

  useEffect(() => {
    onEditingChange?.(editingId);
    // Only the id matters; the callback is a fresh function every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId]);
  const [naming, setNaming] = useState(null); // { id, value, title, action }

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(null); // the theme waiting to be written

  /* ---------------- load ---------------- */

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      /* The list comes first and on its own: a problem reading which theme
         this form wears must never make the shelf look empty. */
      const { themes: rows } = await api.listThemes();
      let list = rows.map(fromRow);

      /* An empty shelf gets the first template, so there is always
         something to open. */
      if (list.length === 0) {
        const seed = newTheme("Form default", TEMPLATES[0]);
        const { theme } = await api.createTheme({
          name: seed.name,
          tagline: "Where every new form starts",
          config: toConfig(seed),
        });
        list = [fromRow(theme)];
      }

      setThemes(list);

      try {
        const applied = formId ? await api.formTheme(formId) : { themeId: null };
        setAppliedId(applied.themeId ?? null);
      } catch (err) {
        setError(`Your themes loaded, but this form's choice did not: ${err.message}`);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [formId]);

  useEffect(() => {
    if (show) load();
  }, [show, load]);

  /* ---------------- save, a moment after the last change ---------------- */

  useEffect(() => {
    if (!dirty) return undefined;

    /* Hold on to the exact version this timer is for. A change that
       arrives while the request is in flight must not be cleared by the
       answer to the older one. */
    const pending = dirty;

    const timer = setTimeout(async () => {
      setSaving(true);
      try {
        await api.updateTheme(pending.id, { config: toConfig(pending) });
        setDirty((current) => (current === pending ? null : current));
        setError("");
      } catch (err) {
        setError(`That change was not saved: ${err.message}`);
      } finally {
        setSaving(false);
      }
    }, SAVE_DELAY);

    return () => clearTimeout(timer);
  }, [dirty]);

  /**
   * Writes anything still pending. Called before the section closes and
   * before leaving the editor, so an edit is never left behind by a
   * click that happens inside the debounce window.
   */
  const flush = async () => {
    if (!dirty) return;
    const pending = dirty;
    setSaving(true);
    try {
      await api.updateTheme(pending.id, { config: toConfig(pending) });
      setDirty((current) => (current === pending ? null : current));
    } catch (err) {
      setError(`That change was not saved: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const editing = themes.find((t) => t.id === editingId) || null;

  const change = (next) => {
    setThemes((list) => list.map((t) => (t.id === next.id ? next : t)));
    setDirty(next);
  };

  /* ---------------- card actions ---------------- */

  const add = async (theme, { open = true, tagline = null } = {}) => {
    try {
      const { theme: row } = await api.createTheme({
        name: theme.name,
        tagline,
        config: toConfig(theme),
      });
      const saved = fromRow(row);
      setThemes((list) => [...list, saved]);
      if (open) setEditingId(saved.id);
      return saved;
    } catch (err) {
      setError(err.message);
      return null;
    }
  };

  const create = () => add(newTheme(uniqueName("Untitled theme", themes), TEMPLATES[0]));

  const useTemplate = (tpl) =>
    add(newTheme(uniqueName(tpl.name, themes), tpl), { open: false, tagline: tpl.tagline });

  const duplicate = (id) => {
    const source = themes.find((t) => t.id === id);
    if (source) add(newTheme(copyName(source.name, themes), source), { open: false });
  };

  const apply = async (id) => {
    const was = appliedId;
    setAppliedId(id); // answer the click straight away
    try {
      await api.applyTheme(formId, id);
    } catch (err) {
      setAppliedId(was);
      setError(err.message);
    }
  };

  const remove = async (id) => {
    const theme = themes.find((t) => t.id === id);
    if (!theme) return;

    if (themes.length === 1) {
      await confirm({
        title: "Keep at least one theme",
        body: "This is the only theme saved. Add another before deleting this one.",
        action: "Got it",
      });
      return;
    }

    const onForms = theme.uses || 0;
    const ok = await confirm({
      title: `Delete “${theme.name}”?`,
      body:
        onForms > 0
          ? `This theme is on ${onForms} form${onForms === 1 ? "" : "s"}. They go back to the plain look, and their questions and answers are untouched.`
          : "The theme and its settings are removed for everyone. Nothing about your questions changes.",
      action: "Delete theme",
    });
    if (!ok) return;

    try {
      await api.deleteTheme(id);
      setThemes((list) => list.filter((t) => t.id !== id));
      if (id === appliedId) setAppliedId(null);
      if (editingId === id) setEditingId(null);
      if (dirty?.id === id) setDirty(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const askRename = (id) => {
    const theme = themes.find((t) => t.id === id);
    if (theme) setNaming({ id, value: theme.name, title: "Rename theme", action: "Save name" });
  };

  const saveName = async (name) => {
    const id = naming.id;
    setNaming(null);
    setThemes((list) => list.map((t) => (t.id === id ? { ...t, name } : t)));
    try {
      await api.updateTheme(id, { name });
    } catch (err) {
      setError(err.message);
      load();
    }
  };

  const close = async () => {
    await flush();
    setEditingId(null);
    onClose();
  };

  /* ---------------- render ---------------- */

  return (
    <>
      <Modal show={show} onHide={close} fullscreen contentClassName="ds" backdropClassName="ds-backdrop">
        <header className="ds-top">
          <div className="ds-top-left">
            <button type="button" className="ds-back" onClick={close} aria-label="Close design">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m15 18-6-6 6-6" />
              </svg>
            </button>
            <span className="ds-crumbs">
              <span className="ds-crumb-form">{formName}</span>
              <span className="ds-crumb-sep">/</span>
              <button
                type="button"
                className={editing ? "ds-crumb-link" : "ds-crumb-now"}
                onClick={() => setEditingId(null)}
                disabled={!editing}
              >
                Design
              </button>
              {editing && (
                <>
                  <span className="ds-crumb-sep">/</span>
                  <span className="ds-crumb-now">{editing.name}</span>
                </>
              )}
            </span>
          </div>

          <span className="ds-top-tag">
            Publish the form to send this design to the live link
          </span>

          <span className={saving || dirty ? "ds-save is-busy" : "ds-save"}>
            {saving || dirty ? "Saving…" : "All changes saved"}
          </span>

          <div className="ds-top-acts">
            {editing && (
              <button
                type="button"
                className={
                  editing.id === appliedId ? "ds-btn ds-btn-primary is-done" : "ds-btn ds-btn-primary"
                }
                onClick={() => apply(editing.id)}
                disabled={editing.id === appliedId}
                title="Puts this theme on the form you are building"
              >
                {editing.id === appliedId ? "On this form" : "Use on this form"}
              </button>
            )}
            <button type="button" className="ds-btn ds-btn-quiet" onClick={close}>
              Done
            </button>
          </div>
        </header>

        {error && (
          <p className="ds-error" role="status">
            {error}
            <button type="button" className="ds-btn ds-btn-quiet" onClick={load}>
              Try again
            </button>
          </p>
        )}

        <div className="ds-body">
          {loading ? (
            <div className="ds-loading">
              <Spinner animation="border" size="sm" />
              <span>Loading themes…</span>
            </div>
          ) : editing ? (
            <ThemeEditor
              key={editing.id}
              theme={editing}
              onChange={change}
              onBack={async () => {
                await flush();
                setEditingId(null);
              }}
              onRename={() => askRename(editing.id)}
            />
          ) : (
            <ThemeGallery
              themes={themes}
              appliedId={appliedId}
              onApply={apply}
              onEdit={setEditingId}
              onRename={askRename}
              onDuplicate={duplicate}
              onDelete={remove}
              onCreate={create}
              onUseTemplate={useTemplate}
            />
          )}
        </div>
      </Modal>

      <NameDialog
        show={Boolean(naming)}
        title={naming?.title}
        value={naming?.value || ""}
        action={naming?.action}
        onClose={() => setNaming(null)}
        onSave={saveName}
      />
      {confirmDialog}
    </>
  );
}