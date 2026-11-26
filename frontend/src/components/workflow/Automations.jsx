import { useEffect, useMemo, useState } from "react";
import { Spinner } from "react-bootstrap";
import { api } from "../../services/api";
import { Glyph, ICONS } from "./Conditions";

/**
 * What happens when someone finishes the form:
 *
 *   Webhook       the answers, score, tags and ending POSTed as JSON to
 *                 your address, signed so the receiver can check it
 *   Team email    a summary to up to 10 addresses
 *   Confirmation  a short thank-you to the address the respondent gave
 *
 * Unlike the rest of the Workflow tab this saves with a button: an address
 * is checked by the server before it is kept, and a half-typed one must
 * not start receiving answers.
 */

const CHANNEL = { webhook: "Webhook", email: "Team email", confirm: "Confirmation" };

const when = (d) =>
  new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

function Switch({ on, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className={on ? "wf-switch is-on" : "wf-switch"} onClick={() => onChange(!on)}>
      <i />
    </button>
  );
}

export default function Automations({ form, pages, workflow }) {
  const [data, setData] = useState(null);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState("");
  const [note, setNote] = useState(null); // { ok, text }
  const [showSecret, setShowSecret] = useState(false);

  const load = (d) => {
    setData(d);
    setDraft({ ...d.automation, emailTo: (d.automation.emailTo || []).join(", ") });
  };

  useEffect(() => {
    let alive = true;
    api
      .formAutomations(form.id)
      .then((d) => alive && load(d))
      .catch((err) => alive && setNote({ ok: false, text: err.message }));
    return () => {
      alive = false;
    };
  }, [form.id]);

  const emailQuestions = useMemo(
    () => pages.flatMap((p) => (p.fields || []).filter((f) => f.type === "email")),
    [pages]
  );

  if (!draft) {
    return (
      <div className="wf-state">
        {note ? <span className="wf-warn">{note.text}</span> : <Spinner animation="border" size="sm" />}
      </div>
    );
  }

  const saved = data.automation;
  const dirty =
    JSON.stringify({ ...draft, emailTo: draft.emailTo.split(/[,;\s]+/).filter(Boolean).map((e) => e.toLowerCase()) }) !==
    JSON.stringify({ ...saved, emailTo: saved.emailTo });
  const set = (patch) => {
    setDraft((d) => ({ ...d, ...patch }));
    setNote(null);
  };

  const save = async () => {
    setSaving(true);
    setNote(null);
    try {
      load(await api.saveAutomations(form.id, { ...draft, emailTo: draft.emailTo }));
      setNote({ ok: true, text: "Saved." });
    } catch (err) {
      setNote({ ok: false, text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const test = async (channel) => {
    if (dirty) {
      setNote({ ok: false, text: "Save your changes first, then test." });
      return;
    }
    setTesting(channel);
    setNote(null);
    try {
      const d = await api.testAutomation(form.id, channel);
      setData(d);
      setNote({ ok: true, text: channel === "confirm" ? "Test confirmation sent to your own address." : "Test sent." });
    } catch (err) {
      setNote({ ok: false, text: err.message });
      api.formAutomations(form.id).then((d) => setData(d)).catch(() => {});
    } finally {
      setTesting("");
    }
  };

  const newSecret = async () => {
    try {
      const d = await api.newWebhookSecret(form.id);
      setData(d);
      setDraft((x) => ({ ...x, webhookSecret: d.automation.webhookSecret }));
      setShowSecret(true);
      setNote({ ok: true, text: "New secret made. Update your receiver — the old one stops working now." });
    } catch (err) {
      setNote({ ok: false, text: err.message });
    }
  };

  const names = ["form", "score", ...(workflow.variables || []).map((v) => v.name), ...(workflow.hidden || []).map((h) => h.key)];

  return (
    <div className="wf-col">
      <div className="wf-savebar">
        <span>
          {dirty ? <b>Unsaved changes</b> : "Everything saved"}
          {note && <span className={note.ok ? "wf-ok" : "wf-bad"}> · {note.text}</span>}
        </span>
        <button type="button" className="fb-btn fb-btn-sm fb-btn-primary" onClick={save} disabled={!dirty || saving}>
          {saving ? "Saving…" : "Save automations"}
        </button>
      </div>

      {/* ---------------- webhook ---------------- */}
      <section className={draft.webhookEnabled ? "wf-card wf-auto is-on" : "wf-card wf-auto"}>
        <header className="wf-card-head">
          <span className="wf-card-icon" aria-hidden="true">⇄</span>
          <div>
            <h3>Webhook</h3>
            <p>Send every finished response to another system — your ERP, CRM, Zapier, Make or your own server.</p>
          </div>
          <Switch on={draft.webhookEnabled} onChange={(v) => set({ webhookEnabled: v })} label="Webhook on or off" />
        </header>
        <label className="wf-field">
          <span>Send to</span>
          <input className="wf-input" value={draft.webhookUrl} maxLength={500} placeholder="https://your-system.com/hooks/forms" onChange={(e) => set({ webhookUrl: e.target.value })} />
        </label>
        <div className="wf-field">
          <span>Signing secret</span>
          <div className="wf-secret">
            <code>{showSecret ? draft.webhookSecret : "•".repeat(24)}</code>
            <button type="button" className="fb-btn fb-btn-sm" onClick={() => setShowSecret((s) => !s)}>
              {showSecret ? "Hide" : "Show"}
            </button>
            <button type="button" className="fb-btn fb-btn-sm" onClick={newSecret}>
              New secret
            </button>
          </div>
          <small className="wf-muted">
            Each delivery carries <code>X-CompanyStore-Signature: sha256=…</code>, an HMAC-SHA256 of{" "}
            <code>timestamp + "." + body</code> using this secret, and the <code>X-CompanyStore-Timestamp</code> header.
            Check both on your side and reject anything older than five minutes.
          </small>
        </div>
        <div className="wf-auto-foot">
          <small className="wf-muted">https:// only. Retried 3 times if your system is down. Redirects are not followed.</small>
          <button type="button" className="fb-btn fb-btn-sm" onClick={() => test("webhook")} disabled={!saved.webhookUrl || testing === "webhook"}>
            {testing === "webhook" ? "Sending…" : "Send a test"}
          </button>
        </div>
      </section>

      {!data.mail.configured && (
        <div className="wf-note">
          <Glyph d={ICONS.warn} />
          <span>
            <b>Email isn't set up on the server yet.</b> Add <code>SMTP_HOST</code>, <code>SMTP_PORT</code>,{" "}
            <code>SMTP_USER</code>, <code>SMTP_PASS</code> and <code>SMTP_FROM</code> to the backend <code>.env</code> and
            restart it. You can set the emails up now; nothing is sent until then.
          </span>
        </div>
      )}

      {/* ---------------- team email ---------------- */}
      <section className={draft.emailEnabled ? "wf-card wf-auto is-on" : "wf-card wf-auto"}>
        <header className="wf-card-head">
          <span className="wf-card-icon" aria-hidden="true">✉</span>
          <div>
            <h3>Email to your team</h3>
            <p>A summary of each finished response{data.mail.from ? `, sent from ${data.mail.from}` : ""}.</p>
          </div>
          <Switch on={draft.emailEnabled} onChange={(v) => set({ emailEnabled: v })} label="Team email on or off" />
        </header>
        <label className="wf-field">
          <span>Send to (up to 10, separated by commas)</span>
          <input className="wf-input" value={draft.emailTo} placeholder="orders@yourcompany.com, manager@yourcompany.com" onChange={(e) => set({ emailTo: e.target.value })} />
        </label>
        <label className="wf-field">
          <span>Subject</span>
          <input className="wf-input" value={draft.emailSubject} maxLength={200} placeholder="New response: {{form}}" onChange={(e) => set({ emailSubject: e.target.value })} />
        </label>
        <div className="wf-auto-foot">
          <small className="wf-muted">Includes every answer, the score, tags, ending and link values.</small>
          <button type="button" className="fb-btn fb-btn-sm" onClick={() => test("email")} disabled={!saved.emailTo.length || testing === "email"}>
            {testing === "email" ? "Sending…" : "Send a test"}
          </button>
        </div>
      </section>

      {/* ---------------- confirmation ---------------- */}
      <section className={draft.confirmEnabled ? "wf-card wf-auto is-on" : "wf-card wf-auto"}>
        <header className="wf-card-head">
          <span className="wf-card-icon" aria-hidden="true">✓</span>
          <div>
            <h3>Confirmation to the respondent</h3>
            <p>A short thank-you to the email address they typed in the form.</p>
          </div>
          <Switch on={draft.confirmEnabled} onChange={(v) => set({ confirmEnabled: v })} label="Confirmation on or off" />
        </header>
        {emailQuestions.length === 0 ? (
          <p className="wf-muted">Add an Email question in Content to use this.</p>
        ) : (
          <>
            <label className="wf-field">
              <span>Send to the answer of</span>
              <select className="wf-input" value={draft.confirmFieldId} onChange={(e) => set({ confirmFieldId: e.target.value })}>
                <option value="">Choose the email question…</option>
                {emailQuestions.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label || "Email"}
                  </option>
                ))}
              </select>
            </label>
            <label className="wf-field">
              <span>Subject</span>
              <input className="wf-input" value={draft.confirmSubject} maxLength={200} placeholder="Thanks — we got your answers" onChange={(e) => set({ confirmSubject: e.target.value })} />
            </label>
            <label className="wf-field">
              <span>Message</span>
              <textarea className="wf-input wf-textarea" rows={4} value={draft.confirmMessage} maxLength={2000} placeholder="Thanks for filling in {{form}}. Your score was {{score}}." onChange={(e) => set({ confirmMessage: e.target.value })} />
            </label>
          </>
        )}
        <div className="wf-auto-foot">
          <small className="wf-muted">Plain text only — no links or HTML can be slipped in through answers.</small>
          <button type="button" className="fb-btn fb-btn-sm" onClick={() => test("confirm")} disabled={testing === "confirm"}>
            {testing === "confirm" ? "Sending…" : "Send me a test"}
          </button>
        </div>
      </section>

      <p className="wf-recall">
        Subjects and messages can use: {names.map((n) => <code key={n}>{`{{${n}}}`}</code>)}
      </p>

      {/* ---------------- delivery log ---------------- */}
      <section className="wf-card">
        <header className="wf-card-head">
          <span className="wf-card-icon" aria-hidden="true">≡</span>
          <div>
            <h3>Recent deliveries</h3>
            <p>The last 20 sends. Respondents' addresses are never written here.</p>
          </div>
        </header>
        {data.logs.length === 0 ? (
          <p className="wf-muted">Nothing sent yet.</p>
        ) : (
          <div className="wf-log">
            {data.logs.map((l) => (
              <div key={l.id} className="wf-log-row">
                <span className={l.ok ? "wf-dot is-ok" : "wf-dot is-bad"} aria-label={l.ok ? "Worked" : "Failed"} />
                <span className="wf-log-when">{when(l.at)}</span>
                <span className="wf-log-what">
                  {CHANNEL[l.channel]}
                  {l.test && <em className="wf-badge">test</em>}
                </span>
                <span className="wf-log-detail">
                  {l.detail}
                  {l.attempts > 1 ? ` · ${l.attempts} tries` : ""}
                  {l.responseId ? ` · response #${l.responseId}` : ""}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}