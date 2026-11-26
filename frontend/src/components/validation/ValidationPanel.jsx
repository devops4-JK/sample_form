import { useEffect, useMemo, useRef, useState } from "react";
import { Spinner } from "react-bootstrap";
import { api } from "../../services/api";
import { MODES, STATUS_LABEL, STATUS_MEANING, modeById, stamp } from "./modes";
import "./validation.css";

/**
 * The Validation tab in the form editor: who is allowed to fill this form in.
 *
 * Three ways, and a form is always on exactly one of them —
 *
 *   list   a customer list you supply; only those addresses may open it
 *   open   no list; anyone may open it once, and the list writes itself
 *   none   no validation at all, and no list anywhere
 *
 * The customer list is kept in Excel, not typed in here: download the
 * sheet, add addresses to column A of "Validation List", and upload it
 * again. This page only shows the list — nothing on it can be edited — and
 * re-reads it every few seconds, so a customer finishing the form turns to
 * "Yes" here without a refresh.
 */

/* How many addresses the list shows at a time, and how often it is re-read. */
const PAGE_SIZE = 10;
const REFRESH_MS = 5000;

const I = {
  people: "M16 19v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 9a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 19v-2a4 4 0 0 0-3-3.9M16 1.1a4 4 0 0 1 0 7.8",
  globe: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M3.6 9h16.8M3.6 15h16.8M12 3a15 15 0 0 1 0 18A15 15 0 0 1 12 3",
  unlocked: "M7 11V7a5 5 0 0 1 9.6-2M5 11h14v10H5z",
  download: "M12 4v11M8 11l4 4 4-4M5 20h14",
  chevron: "m6 9 6 6 6-6",
  check: "m5 12 5 5 9-10",
  upload: "M12 16V4M8 8l4-4 4 4M5 20h14",
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16M21 21l-4.3-4.3",
  sheet: "M4 4h16v16H4zM4 9h16M4 14h16M10 4v16",
};

const MODE_ICON = { list: I.people, open: I.globe, none: I.unlocked };

function Glyph({ d, size = 16 }) {
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
      <path d={d} />
    </svg>
  );
}

/* ---------------------------- the three ways ---------------------------- */

function WayCard({ way, chosen, onPick, count }) {
  return (
    <button
      type="button"
      className={chosen ? "vl-way is-on" : "vl-way"}
      onClick={onPick}
      aria-pressed={chosen}
    >
      <span className="vl-way-mark" aria-hidden="true">
        {chosen && <Glyph d={I.check} size={13} />}
      </span>

      <span className="vl-way-icon" aria-hidden="true">
        <Glyph d={MODE_ICON[way.id]} size={18} />
      </span>

      <span className="vl-way-body">
        <span className="vl-way-title">{way.title}</span>
        <span className="vl-way-blurb">{way.blurb}</span>

        <span className="vl-way-points">
          {way.points.map((p) => (
            <span className="vl-way-point" key={p}>
              <i aria-hidden="true" />
              {p}
            </span>
          ))}
        </span>

        {chosen && way.id !== "none" && count > 0 && (
          <span className="vl-way-count">
            {count} address{count === 1 ? "" : "es"} on the list
          </span>
        )}
      </span>
    </button>
  );
}

/* ------------------------------ the list ------------------------------ */

function StatusPill({ status }) {
  return (
    <span className={`vl-pill vl-pill-${status}`} title={STATUS_MEANING[status]}>
      {STATUS_LABEL[status]}
    </span>
  );
}

/**
 * The list, to look at only. Ten addresses at a time, with a search box
 * that looks through the whole list and not just the ten on screen.
 */
function EntryTable({ entries, readOnly }) {
  const [find, setFind] = useState("");
  const [page, setPage] = useState(0);

  const shown = useMemo(() => {
    const needle = find.trim().toLowerCase();
    if (!needle) return entries;
    return entries.filter((e) => e.email.includes(needle));
  }, [entries, find]);

  const pages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const at = Math.min(page, pages - 1);
  const rows = shown.slice(at * PAGE_SIZE, at * PAGE_SIZE + PAGE_SIZE);

  if (!entries.length) {
    return (
      <p className="vl-empty">
        {readOnly
          ? "Nobody has opened this form yet. Addresses appear here as people sign in."
          : "No addresses yet. Upload your Excel sheet above to start."}
      </p>
    );
  }

  return (
    <>
      <div className="vl-find">
        <Glyph d={I.search} size={15} />
        <input
          className="vl-find-input"
          type="search"
          value={find}
          placeholder="Find an address"
          onChange={(e) => {
            setFind(e.target.value);
            setPage(0);
          }}
          aria-label="Find an address on the list"
        />
        <span className="vl-find-count">
          {shown.length} of {entries.length}
        </span>
      </div>

      <div className="vl-table-wrap">
        <table className="vl-table">
          <thead>
            <tr>
              <th scope="col">Validation</th>
              <th scope="col">Status of validation</th>
              <th scope="col">Date and Time</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.id}>
                <td className="vl-email">{e.email}</td>
                <td>
                  <StatusPill status={e.status} />
                </td>
                <td className="vl-when">{stamp(e.completedAt) || "—"}</td>
              </tr>
            ))}

            {!shown.length && (
              <tr>
                <td colSpan={3} className="vl-no-match">
                  No address matches “{find}”.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {shown.length > PAGE_SIZE && (
        <div className="vl-pager">
          <span className="vl-pager-count">
            {at * PAGE_SIZE + 1}–{at * PAGE_SIZE + rows.length} of {shown.length}
          </span>
          <button
            type="button"
            className="fb-btn fb-btn-sm"
            onClick={() => setPage(at - 1)}
            disabled={at === 0}
          >
            Previous
          </button>
          <button
            type="button"
            className="fb-btn fb-btn-sm"
            onClick={() => setPage(at + 1)}
            disabled={at >= pages - 1}
          >
            Next
          </button>
        </div>
      )}
    </>
  );
}

/* ------------------------------ the panel ------------------------------ */

export default function ValidationPanel({ form }) {
  const [settings, setSettings] = useState(null);
  const [entries, setEntries] = useState([]);
  const [counts, setCounts] = useState({ total: 0, done: 0, opened: 0, waiting: 0 });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  const [busy, setBusy] = useState(""); // "upload" | "download" | ""
  const [listOpen, setListOpen] = useState(true);
  const fileRef = useRef(null);

  /** Reads the settings and the list. `quiet` is the background re-read. */
  const load = async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const data = await api.formValidation(form.id);
      // A background re-read never overwrites a choice still being saved.
      if (!quiet) setSettings(data.validation);
      setEntries(data.entries);
      setCounts(data.counts);
      if (!quiet) setError("");
    } catch (err) {
      // A missed background re-read is not worth an error on screen; the
      // next one is seconds away.
      if (!quiet) setError(err.message);
    } finally {
      if (!quiet) setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.id]);

  /* The list keeps itself up to date: a customer who signs in or finishes
     shows up here within a few seconds. Paused while the tab is hidden. */
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") load(true);
    }, REFRESH_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.id]);

  /** A changed setting is saved at once; the panel never has a Save button. */
  const put = async (patch) => {
    const before = settings;
    setSettings((s) => ({ ...s, ...patch })); // answer the click immediately
    try {
      const { validation } = await api.setFormValidation(form.id, patch);
      setSettings(validation);
      setError("");
    } catch (err) {
      setSettings(before); // put it back; nothing was saved
      setError(err.message);
    }
  };

  const say = (text) => {
    setNote(text);
    setTimeout(() => setNote(""), 6000);
  };

  /** The workbook to add addresses to: Responses and Validation List. */
  const downloadSheet = async () => {
    setBusy("download");
    setError("");
    try {
      await api.downloadXlsx(form.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  };

  /** Reads the customer list out of an uploaded .xlsx. */
  const uploadSheet = async (file) => {
    if (!file) return;
    if (!/\.xlsx$/i.test(file.name)) {
      setError("Choose an Excel file ending in .xlsx.");
      return;
    }

    setBusy("upload");
    setError("");
    try {
      const data = await api.importValidationSheet(form.id, file);
      setEntries(data.entries);
      setCounts(data.counts);

      const bits = [`${data.added} added`];
      if (data.skipped) bits.push(`${data.skipped} already on the list`);
      if (data.rejected?.length) bits.push(`${data.rejected.length} could not be read`);
      say(bits.join(", ") + ".");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  };

  if (loading) {
    return (
      <div className="cn vl">
        <div className="vl-loading">
          <Spinner animation="border" size="sm" />
        </div>
      </div>
    );
  }

  const mode = settings?.mode || "none";
  const gated = mode !== "none";
  const way = modeById(mode);

  return (
    <div className="cn vl">
      <header className="cn-head">
        <div className="cn-head-row">
          <div>
            <h2 className="cn-title">Form validation</h2>
            <p className="cn-sub">Who is allowed to fill {form.name} in, and how many times.</p>
          </div>
          <span className="vl-now">
            <Glyph d={MODE_ICON[mode]} size={14} />
            {way.short}
          </span>
        </div>
      </header>

      {error && <div className="fb-alert">{error}</div>}
      {note && <div className="vl-note-bar">{note}</div>}

      {/* ---- pick one of the three ---- */}
      <div className="vl-ways">
        {MODES.map((m) => (
          <WayCard
            key={m.id}
            way={m}
            chosen={m.id === mode}
            count={counts.total}
            onPick={() => put({ mode: m.id })}
          />
        ))}
      </div>

      {/* ---- no validation: nothing more to set ---- */}
      {!gated && (
        <div className="cn-card vl-quiet">
          <span className="vl-quiet-icon" aria-hidden="true">
            <Glyph d={I.sheet} size={18} />
          </span>
          <div>
            <h3 className="vl-card-title">Nothing is being checked</h3>
            <p className="cn-note">
              The form opens straight away with no email asked for, one person may fill it in as
              many times as they like, and every answer is kept. The Excel export has the
              responses sheet only — no Validation List sheet.
            </p>
          </div>
        </div>
      )}

      {gated && (
        <>
          {/* ---- adding addresses: from an Excel sheet, customer-list way only ---- */}
          {mode === "list" && (
            <div className="cn-card">
              <h3 className="vl-card-title">Customer list from Excel</h3>
              <p className="cn-note">
                The list is kept in the Excel sheet. Download it, add the email addresses to
                column A of the <b>Validation List</b> sheet, save, and upload it here. Only new
                addresses are added; anyone already on the list keeps their status.
              </p>

              <div className="vl-add-row">
                <button
                  type="button"
                  className="fb-btn"
                  onClick={downloadSheet}
                  disabled={Boolean(busy)}
                >
                  <Glyph d={I.download} />
                  {busy === "download" ? "Preparing…" : "Download the sheet (.xlsx)"}
                </button>

                <button
                  type="button"
                  className="fb-btn fb-btn-primary"
                  onClick={() => fileRef.current?.click()}
                  disabled={Boolean(busy)}
                >
                  <Glyph d={I.upload} />
                  {busy === "upload" ? "Reading the sheet…" : "Upload the sheet (.xlsx)"}
                </button>

                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  hidden
                  tabIndex={-1}
                  onChange={(e) => {
                    uploadSheet(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </div>
            </div>
          )}

          {/* ---- the list itself: view only, folds away ---- */}
          <div className="cn-card">
            <button
              type="button"
              className={listOpen ? "vl-fold is-open" : "vl-fold"}
              onClick={() => setListOpen((v) => !v)}
              aria-expanded={listOpen}
            >
              <span className="vl-fold-words">
                <span className="vl-card-title">
                  {mode === "list" ? "The customer list" : "Who has signed in"}
                </span>
                <span className="cn-note">
                  {counts.total} on the list · {counts.done} filled in · updates on its own
                </span>
              </span>
              <span className="vl-fold-arrow" aria-hidden="true">
                <Glyph d={I.chevron} size={18} />
              </span>
            </button>

            {listOpen && (
              <>
                <div className="vl-tally">
                  <span className="vl-tally-item">
                    <b>{counts.total}</b> on the list
                  </span>
                  <span className="vl-tally-item vl-tally-done">
                    <b>{counts.done}</b> filled in
                  </span>
                  <span className="vl-tally-item vl-tally-open">
                    <b>{counts.opened}</b> opened, not finished
                  </span>
                  {mode === "list" && (
                    <span className="vl-tally-item">
                      <b>{counts.waiting}</b> not started
                    </span>
                  )}
                </div>

                <EntryTable entries={entries} readOnly={mode === "open"} />
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}