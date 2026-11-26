import { useEffect, useState } from "react";
import { Spinner } from "react-bootstrap";
import { api, apiUrl } from "../../services/api";

const I = {
  link: "M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1",
  sheet: "M4 4h16v16H4zM4 9h16M4 14h16M10 4v16",
  copy: "M8 8h11v11H8zM5 16H4V4h12v1",
  check: "m5 12 5 5 9-10",
  open: "M14 4h6v6M20 4 10 14M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5",
  download: "M12 4v11M8 11l4 4 4-4M5 20h14",
  refresh: "M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6",
  grid: "M3 5h18v14H3zM3 10h18M3 15h18M9 5v14M15 5v14",
  unplug: "M9 15 4 20M15 9l5-5M8 8l8 8M7 11l-2 2a4 4 0 0 0 6 6l2-2M17 13l2-2a4 4 0 0 0-6-6l-2 2",
};

function Glyph({ d, size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

const when = (d) =>
  new Date(d).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

/** A read-only URL with a copy button that confirms itself. */
function CopyField({ label, value, id }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Clipboard blocked (plain http, old browser): select it for Ctrl+C instead.
      document.getElementById(id)?.select();
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };
  return (
    <div className="cn-copy">
      <label className="fb-label" htmlFor={id}>
        {label}
      </label>
      <div className="cn-copy-row">
        <input id={id} className="fb-input cn-url" value={value} readOnly onFocus={(e) => e.target.select()} />
        <button type="button" className={copied ? "fb-btn is-done" : "fb-btn"} onClick={copy}>
          <Glyph d={copied ? I.check : I.copy} />
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

/**
 * The Connect tab: the public link, and the Excel feed.
 *
 * Three things live here:
 *
 *   Form link      the public address of the form
 *   Google Sheets  a sheet that stays in step with the form on its own:
 *                  responses and validation statuses are written into it,
 *                  and addresses typed into its customer list are read back
 *   Excel          a private URL that serves a workbook, and the two
 *                  download buttons (.xlsx and .csv)
 *
 * The Excel URL carries a secret token, so anyone holding it can read the
 * responses. Disconnecting switches that URL off for good; connecting
 * again issues a brand new one.
 */
export default function ConnectPanel({ form, onTogglePublish, confirm }) {
  const [excel, setExcel] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    api
      .integrations(form.id)
      .then((res) => alive && setExcel(res.excel))
      .catch((err) => alive && setError(err.message));
    return () => {
      alive = false;
    };
  }, [form.id]);

  const run = async (key, fn) => {
    setBusy(key);
    setError("");
    try {
      await fn();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  };

  const connect = () =>
    run("connect", async () => {
      const res = await api.enableExcel(form.id);
      setExcel(res.excel);
    });

  const disconnect = async () => {
    const ok = await confirm({
      title: "Disconnect Excel?",
      body: "The URL stops working straight away and workbooks using it will no longer refresh. Connecting again gives a new URL. Responses stay safe in the app.",
      action: "Disconnect",
    });
    if (!ok) return;
    run("disconnect", async () => {
      const res = await api.disableExcel(form.id);
      setExcel(res.excel);
    });
  };

  const download = () => run("download", () => api.downloadXlsx(form.id));
  const downloadCsv = () => run("download-csv", () => api.downloadCsv(form.id));

  /* Both download buttons, the same wherever the Excel card shows them. */
  const downloads = (
    <>
      <button type="button" className="fb-btn" onClick={download} disabled={busy === "download"}>
        <Glyph d={I.download} />
        {busy === "download" ? "Preparing…" : "Download .xlsx"}
      </button>
      <button type="button" className="fb-btn" onClick={downloadCsv} disabled={busy === "download-csv"}>
        <Glyph d={I.download} />
        {busy === "download-csv" ? "Preparing…" : "Download .csv"}
      </button>
    </>
  );

  const shareUrl = `${window.location.origin}/f/${form.publicId}`;
  const live = form.status === "published";
  const feedUrl = excel?.enabled ? apiUrl(`/integrations/excel/${excel.token}.xlsx`) : "";

  return (
    <div className="cn">
      <header className="cn-head">
        <h1 className="cn-title">Connect</h1>
        <p className="cn-sub">Share the form, and send every answer straight to Excel.</p>
      </header>

      {error && (
        <div className="fb-alert" role="status">
          <span>{error}</span>
          <button type="button" className="fb-icon" onClick={() => setError("")} aria-label="Dismiss">
            ×
          </button>
        </div>
      )}

      {/* ---------------- share link ---------------- */}
      <section className="cn-card">
        <div className="cn-card-head">
          <span className="cn-logo cn-logo-link">
            <Glyph d={I.link} size={20} />
          </span>
          <div className="cn-card-titles">
            <h2 className="cn-card-title">Form link</h2>
            <p className="cn-card-sub">Anyone with the link can fill in the form.</p>
          </div>
          <span className={live ? "cn-badge is-live" : "cn-badge"}>{live ? "Live" : "Draft"}</span>
        </div>

        <CopyField id="cn-share" label="Public link" value={shareUrl} />

        <div className="cn-actions">
          <a className="fb-btn" href={shareUrl} target="_blank" rel="noreferrer">
            <Glyph d={I.open} />
            Open form
          </a>
          {!live && (
            <button type="button" className="fb-btn fb-btn-primary" onClick={onTogglePublish}>
              Publish to go live
            </button>
          )}
        </div>
        {!live && <p className="cn-note">The link shows “not available” until the form is published.</p>}
      </section>

      {/* ---------------- google sheets ---------------- */}
      <SheetCard form={form} confirm={confirm} />

      {/* ---------------- excel ---------------- */}
      <section className="cn-card">
        <div className="cn-card-head">
          <span className="cn-logo cn-logo-excel">
            <Glyph d={I.sheet} size={20} />
          </span>
          <div className="cn-card-titles">
            <h2 className="cn-card-title">Excel</h2>
            <p className="cn-card-sub">
              A live spreadsheet of every response. Refresh in Excel to pull the latest answers.
            </p>
          </div>
          {excel?.enabled && <span className="cn-badge is-live">Connected</span>}
        </div>

        {excel === null ? (
          <div className="cn-loading">
            <Spinner animation="border" size="sm" /> Checking the connection…
          </div>
        ) : !excel.enabled ? (
          <>
            <ul className="cn-points">
              <li>One row per response, one column per question.</li>
              <li>Address and contact answers split into separate columns.</li>
              <li>The URL is private. Only people you give it to can read the data.</li>
              <li>Download as an Excel workbook (.xlsx) or as a .csv file.</li>
            </ul>
            <div className="cn-actions">
              <button type="button" className="fb-btn fb-btn-primary" onClick={connect} disabled={busy === "connect"}>
                {busy === "connect" ? "Connecting…" : "Connect Excel"}
              </button>
              {downloads}
            </div>
          </>
        ) : (
          <>
            <CopyField id="cn-feed" label="Excel connection URL" value={feedUrl} />

            <p className="cn-meta">
              {excel.lastSyncedAt
                ? `Last pulled ${when(excel.lastSyncedAt)} · ${excel.syncCount} time${excel.syncCount === 1 ? "" : "s"}`
                : "Not pulled yet."}
            </p>

            <div className="cn-actions">
              {downloads}
              <button type="button" className="fb-btn fb-btn-ghost-danger" onClick={disconnect} disabled={busy === "disconnect"}>
                <Glyph d={I.unplug} />
                Disconnect
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

/* ---------------------------- google sheets ---------------------------- */

/**
 * Links the form to a Google Sheet that keeps itself up to date.
 *
 * Once linked there is nothing to download and nothing to upload: a new
 * response or a finished customer appears in the sheet within a second or
 * two, and an email address typed into column A of its "Validation List"
 * tab is on the form's customer list the next time anyone signs in.
 *
 * The app reaches the sheet as its own Google account (a service account),
 * so the sheet only has to be shared with that one address. It is never
 * made public.
 */
function SheetCard({ form, confirm }) {
  const [sheet, setSheet] = useState(null);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    const load = () =>
      api
        .formSheet(form.id)
        .then((res) => alive && setSheet(res.sheet))
        .catch((err) => alive && setError(err.message));
    load();

    // "Last updated" and any problem with the link stay current on screen.
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 10000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [form.id]);

  const run = async (key, fn) => {
    setBusy(key);
    setError("");
    try {
      const res = await fn();
      setSheet(res.sheet);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  };

  const connect = (e) => {
    e.preventDefault();
    if (!url.trim()) return;
    run("connect", async () => {
      const res = await api.connectSheet(form.id, url.trim());
      setUrl("");
      return res;
    });
  };

  const disconnect = async () => {
    const ok = await confirm({
      title: "Unlink the Google Sheet?",
      body: "The sheet stops updating and addresses typed into it are no longer read. The sheet itself, and everything in the app, stays as it is.",
      action: "Unlink",
    });
    if (ok) run("disconnect", () => api.disconnectSheet(form.id));
  };

  return (
    <section className="cn-card">
      <div className="cn-card-head">
        <span className="cn-logo cn-logo-excel">
          <Glyph d={I.grid} size={20} />
        </span>
        <div className="cn-card-titles">
          <h2 className="cn-card-title">Google Sheets</h2>
          <p className="cn-card-sub">
            A sheet that updates on its own. Responses and validation statuses appear in it as
            they happen, and customers you type into it can open the form straight away.
          </p>
        </div>
        {sheet?.connected && (
          <span className={sheet.lastError ? "cn-badge" : "cn-badge is-live"}>
            {sheet.lastError ? "Needs attention" : "Linked"}
          </span>
        )}
      </div>

      {error && (
        <div className="fb-alert" role="status">
          <span>{error}</span>
          <button type="button" className="fb-icon" onClick={() => setError("")} aria-label="Dismiss">
            ×
          </button>
        </div>
      )}

      {sheet === null ? (
        !error && (
          <div className="cn-loading">
            <Spinner animation="border" size="sm" /> Checking the link…
          </div>
        )
      ) : !sheet.configured ? (
        <p className="cn-note">
          Google Sheets is not set up on the server yet. Whoever looks after the server needs to
          add a Google service account key once; the steps are in the README under “Google
          Sheets”. Until then, use the downloads below.
        </p>
      ) : !sheet.connected ? (
        <>
          <ol className="cn-steps">
            <li>
              Open the Google Sheet you want to use, or create a new blank one. A sheet that
              already has <b>Responses</b> and <b>Validation List</b> tabs is used as it is.
            </li>
            <li>
              Press <b>Share</b> in the sheet and add this address as an <b>Editor</b>:
            </li>
          </ol>
          <CopyField id="cn-sheet-email" label="Share the sheet with" value={sheet.serviceEmail || ""} />

          <form className="cn-copy" onSubmit={connect}>
            <label className="fb-label" htmlFor="cn-sheet-url">
              Then paste the sheet's link here
            </label>
            <div className="cn-copy-row">
              <input
                id="cn-sheet-url"
                className="fb-input cn-url"
                value={url}
                placeholder="https://docs.google.com/spreadsheets/d/…"
                onChange={(e) => setUrl(e.target.value)}
                disabled={busy === "connect"}
              />
              <button
                type="submit"
                className="fb-btn fb-btn-primary"
                disabled={busy === "connect" || !url.trim()}
              >
                {busy === "connect" ? "Linking…" : "Link sheet"}
              </button>
            </div>
          </form>
          <p className="cn-note">
            An Excel file kept in Google Drive will not link. Open it and choose File › Save as
            Google Sheets first.
          </p>
        </>
      ) : (
        <>
          <CopyField id="cn-sheet-link" label={sheet.title} value={sheet.url} />

          <p className="cn-meta">
            {sheet.lastSyncedAt ? `Last updated ${when(sheet.lastSyncedAt)}` : "Not updated yet."}
          </p>
          {sheet.lastError && <p className="cn-note cn-note-warn">{sheet.lastError}</p>}

          <ul className="cn-points">
            <li>
              Type customer email addresses in column A of the <b>Validation List</b> tab.
            </li>
            <li>The app fills in the status and the date beside each one.</li>
            <li>
              The <b>Responses</b> tab is written by the app; anything typed there is replaced.
            </li>
          </ul>

          <div className="cn-actions">
            <a className="fb-btn" href={sheet.url} target="_blank" rel="noreferrer">
              <Glyph d={I.open} />
              Open sheet
            </a>
            <button
              type="button"
              className="fb-btn"
              onClick={() => run("sync", () => api.syncSheet(form.id))}
              disabled={busy === "sync"}
            >
              <Glyph d={I.refresh} />
              {busy === "sync" ? "Updating…" : "Update now"}
            </button>
            <button
              type="button"
              className="fb-btn fb-btn-ghost-danger"
              onClick={disconnect}
              disabled={busy === "disconnect"}
            >
              <Glyph d={I.unplug} />
              Unlink
            </button>
          </div>
        </>
      )}
    </section>
  );
}