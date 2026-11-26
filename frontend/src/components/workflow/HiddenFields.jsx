import { useState } from "react";
import { NAME_RE, SCORE } from "./engine";
import { Glyph, ICONS } from "./Conditions";

/**
 * Hidden fields: values that ride in on the form's link, like
 * …/f/abc123?source=newsletter&employee_id=E1042
 *
 * The respondent never sees or types them. They are stored with the
 * answers, can be shown in a question with {{name}}, and can be checked
 * by logic, calculations, tags and endings. Only names listed here are
 * read — anything else on the link is ignored, here and on the server.
 */
export default function HiddenFields({ workflow, setWorkflow, form }) {
  const [draft, setDraft] = useState("");
  const [problem, setProblem] = useState("");
  const [copied, setCopied] = useState(false);

  const hidden = workflow.hidden || [];
  const taken = new Set([SCORE, ...hidden.map((h) => h.key), ...(workflow.variables || []).map((v) => v.name)]);

  const add = () => {
    const key = draft.trim().toLowerCase();
    if (!NAME_RE.test(key)) {
      setProblem("Start with a letter; use only a–z, 0–9 and _ (up to 32 characters).");
      return;
    }
    if (taken.has(key)) {
      setProblem(`“${key}” is already used by a hidden field or variable.`);
      return;
    }
    if (hidden.length >= 20) {
      setProblem("A form can have up to 20 hidden fields.");
      return;
    }
    setWorkflow((w) => ({ ...w, hidden: [...(w.hidden || []), { key }] }));
    setDraft("");
    setProblem("");
  };

  const remove = (key) => setWorkflow((w) => ({ ...w, hidden: (w.hidden || []).filter((h) => h.key !== key) }));

  const base = `${window.location.origin}/f/${form.publicId}`;
  const example = hidden.length ? `${base}?${hidden.map((h) => `${h.key}=xxxxx`).join("&")}` : base;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(example);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (_) {
      /* the address is on screen to copy by hand */
    }
  };

  return (
    <div className="wf-col">
      <section className="wf-card">
        <header className="wf-card-head">
          <span className="wf-card-icon" aria-hidden="true">🔗</span>
          <div>
            <h3>Hidden fields</h3>
            <p>
              Pass information in through the form link — where someone came from, an employee ID, a campaign. People
              filling in the form never see these.
            </p>
          </div>
        </header>

        <div className="wf-keys">
          {hidden.length === 0 && <span className="wf-muted">No hidden fields yet.</span>}
          {hidden.map((h) => (
            <span key={h.key} className="wf-key">
              <code>{h.key}</code>
              <button type="button" onClick={() => remove(h.key)} aria-label={`Remove ${h.key}`} title="Remove">
                <Glyph d={ICONS.x} size={12} />
              </button>
            </span>
          ))}
        </div>

        <form
          className="wf-inline-add"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <input
            className="wf-input"
            value={draft}
            maxLength={32}
            placeholder="e.g. source, employee_id, campaign"
            onChange={(e) => {
              setDraft(e.target.value);
              setProblem("");
            }}
            aria-label="New hidden field name"
          />
          <button type="submit" className="fb-btn fb-btn-sm" disabled={!draft.trim()}>
            <Glyph d={ICONS.plus} size={13} /> Add
          </button>
        </form>
        {problem && <p className="wf-warn">{problem}</p>}
      </section>

      <section className="wf-card">
        <header className="wf-card-head">
          <span className="wf-card-icon" aria-hidden="true">📋</span>
          <div>
            <h3>Your link</h3>
            <p>Replace each xxxxx with the value to pass in. Values are cut to 500 characters and stored as plain text.</p>
          </div>
        </header>
        <div className="wf-linkbox">
          <code>{example}</code>
          <button type="button" className="fb-btn fb-btn-sm" onClick={copy}>
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </section>

      <section className="wf-card wf-card-soft">
        <h4 className="wf-mini-title">Where you can use them</h4>
        <ul className="wf-uses">
          <li>
            <b>In a question:</b> type <code>{"{{" + (hidden[0]?.key || "source") + "}}"}</code> in a title — “Hi{" "}
            {"{{name}}"}, which gift would you like?”
          </li>
          <li>
            <b>In Logic, Calculations, Tags and Endings:</b> pick it under <em>From the link</em> when choosing what to
            check.
          </li>
          <li>
            <b>In results:</b> each one gets its own column in Excel, CSV and the Google Sheet, and is sent with the
            webhook.
          </li>
        </ul>
      </section>
    </div>
  );
}