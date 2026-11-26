import { useEffect, useMemo, useState } from "react";
import { Container, Form, Spinner } from "react-bootstrap";
import { api } from "../services/api";
import "../styles/admin.css";

const TABS = [
  { id: "forms", label: "Forms" },
  { id: "workbenches", label: "Workbenches" },
  { id: "activity", label: "History" },
];

/** "24 Sept 2026, 12:38" */
const when = (d) =>
  d
    ? new Date(d).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

/** "3 hours ago", for the history feed. */
function ago(d) {
  const secs = Math.round((Date.now() - new Date(d)) / 1000);
  if (secs < 45) return "just now";
  const units = [
    [60, "minute"],
    [3600, "hour"],
    [86400, "day"],
    [604800, "week"],
    [2592000, "month"],
    [31536000, "year"],
  ];
  let divisor = 1;
  let unit = "second";
  units.forEach(([size, name]) => {
    if (secs >= size) {
      divisor = size;
      unit = name;
    }
  });
  const n = Math.round(secs / divisor);
  return `${n} ${unit}${n === 1 ? "" : "s"} ago`;
}

const ACTION_TONE = {
  created: "act-new",
  edited: "act-edit",
  renamed: "act-edit",
  moved: "act-edit",
  published: "act-live",
  unpublished: "act-warn",
  deleted: "act-gone",
};

function ActionTag({ action }) {
  return <span className={`act-tag ${ACTION_TONE[action] || "act-edit"}`}>{action}</span>;
}

/**
 * Everything the company has built, and who built it.
 *
 * Workbenches and forms are shared, so this is the one place an admin can
 * see who created each form and who touched it last.
 */
export default function AdminActivity() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("forms");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let alive = true;
    api
      .adminOverview()
      .then((res) => alive && setData(res))
      .catch((err) => alive && setError(err.message));
    return () => {
      alive = false;
    };
  }, []);

  const q = query.trim().toLowerCase();

  const forms = useMemo(
    () =>
      (data?.forms || []).filter(
        (f) =>
          !q ||
          f.name.toLowerCase().includes(q) ||
          f.createdBy.toLowerCase().includes(q) ||
          f.workbench.toLowerCase().includes(q)
      ),
    [data, q]
  );

  const workbenches = useMemo(
    () =>
      (data?.workbenches || []).filter(
        (w) => !q || w.name.toLowerCase().includes(q) || w.createdBy.toLowerCase().includes(q)
      ),
    [data, q]
  );

  const activity = useMemo(
    () =>
      (data?.activity || []).filter(
        (a) => !q || a.entityName.toLowerCase().includes(q) || a.by.toLowerCase().includes(q)
      ),
    [data, q]
  );

  if (error) {
    return (
      <Container fluid className="dash-wrap px-3 px-md-4">
        <div className="empty-state">{error}</div>
      </Container>
    );
  }

  if (!data) {
    return (
      <Container fluid className="dash-wrap px-3 px-md-4">
        <div className="route-loading">
          <Spinner animation="border" size="sm" />
        </div>
      </Container>
    );
  }

  return (
    <Container fluid className="dash-wrap px-3 px-md-4">
      <div className="dash-head">
        <div>
          <h1 className="dash-title">Forms and activity</h1>
          <p className="dash-sub">
            Every workbench and form in the company, who created it, and who changed it last.
          </p>
        </div>
      </div>

      <div className="act-stats">
        <div className="act-stat">
          <span className="act-n">{data.stats.workbenches}</span>
          <span className="act-l">Workbenches</span>
        </div>
        <div className="act-stat">
          <span className="act-n">{data.stats.forms}</span>
          <span className="act-l">Forms</span>
        </div>
        <div className="act-stat">
          <span className="act-n">{data.stats.published}</span>
          <span className="act-l">Published</span>
        </div>
        <div className="act-stat">
          <span className="act-n">{data.stats.responses}</span>
          <span className="act-l">Responses</span>
        </div>
      </div>

      <div className="act-bar">
        <div className="act-tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={tab === t.id ? "act-tab is-on" : "act-tab"}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <Form.Control
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or person"
          aria-label="Search"
          className="act-search"
        />
      </div>

      {/* ---------------- forms ---------------- */}
      {tab === "forms" && (
        <div className="table-card">
          <table className="act-table">
            <thead>
              <tr>
                <th>Form</th>
                <th>Workbench</th>
                <th>Created by</th>
                <th>Created</th>
                <th>Last change</th>
              </tr>
            </thead>
            <tbody>
              {forms.map((f) => (
                <tr key={f.id}>
                  <td>
                    <span className="act-name">
                      <span className="act-dot" style={{ backgroundColor: f.colour }} aria-hidden="true" />
                      {f.name}
                    </span>
                    <span className="act-sub">
                      {f.status} · {f.responses} response{f.responses === 1 ? "" : "s"}
                    </span>
                  </td>
                  <td className="act-muted">{f.workbench}</td>
                  <td>
                    <span className="act-person">{f.createdBy}</span>
                    {f.createdByEmail && <span className="act-sub">{f.createdByEmail}</span>}
                  </td>
                  <td className="act-muted">{when(f.createdAt)}</td>
                  <td>
                    {f.lastEvent ? (
                      <>
                        <span className="act-person">
                          <ActionTag action={f.lastEvent.action} /> {f.lastEvent.by}
                        </span>
                        <span className="act-sub">{when(f.lastEvent.at)}</span>
                      </>
                    ) : (
                      <span className="act-muted">{when(f.updatedAt)}</span>
                    )}
                  </td>
                </tr>
              ))}
              {forms.length === 0 && (
                <tr>
                  <td colSpan={5} className="act-empty">
                    No forms match “{query}”.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ---------------- workbenches ---------------- */}
      {tab === "workbenches" && (
        <div className="table-card">
          <table className="act-table">
            <thead>
              <tr>
                <th>Workbench</th>
                <th>Forms</th>
                <th>Created by</th>
                <th>Created</th>
                <th>Last change</th>
              </tr>
            </thead>
            <tbody>
              {workbenches.map((w) => (
                <tr key={w.id}>
                  <td className="act-name">{w.name}</td>
                  <td className="act-muted">{w.formCount}</td>
                  <td>
                    <span className="act-person">{w.createdBy}</span>
                    {w.createdByEmail && <span className="act-sub">{w.createdByEmail}</span>}
                  </td>
                  <td className="act-muted">{when(w.createdAt)}</td>
                  <td>
                    {w.lastEvent ? (
                      <>
                        <span className="act-person">
                          <ActionTag action={w.lastEvent.action} /> {w.lastEvent.by}
                        </span>
                        <span className="act-sub">{when(w.lastEvent.at)}</span>
                      </>
                    ) : (
                      <span className="act-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {workbenches.length === 0 && (
                <tr>
                  <td colSpan={5} className="act-empty">
                    No workbenches match “{query}”.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ---------------- history ---------------- */}
      {tab === "activity" && (
        <div className="table-card act-feed-card">
          {activity.length === 0 ? (
            <p className="act-empty">Nothing recorded yet.</p>
          ) : (
            <ol className="act-feed">
              {activity.map((a) => (
                <li key={a.id}>
                  <span className="act-feed-mark" aria-hidden="true" />
                  <div className="act-feed-body">
                    <p className="act-feed-line">
                      <b>{a.by}</b> <ActionTag action={a.action} /> the {a.entityType}{" "}
                      <b>{a.entityName}</b>
                    </p>
                    <p className="act-sub">
                      {a.detail ? `${a.detail} · ` : ""}
                      {when(a.at)} · {ago(a.at)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </Container>
  );
}