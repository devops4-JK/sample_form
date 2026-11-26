import { useMemo, useState } from "react";
import { Modal } from "react-bootstrap";
import FieldPreview from "./FieldPreview";
import ThemedForm from "../design/ThemedForm";
import { pageMedia } from "./PageMedia";
import { useLoadingScreen } from "../design/LoadingScreen";
import useFlow from "../workflow/useFlow";
import { recall, run } from "../workflow/engine";

/**
 * What a respondent sees. Fills the whole screen, walks the pages one at a
 * time, and carries its own Desktop/Mobile switch. Desktop is the default.
 *
 * Nothing here shows a scrollbar: long pages still scroll, the bar is just
 * hidden.
 *
 * It wears the form's theme, so the preview and the published page look
 * the same, and follows the Workflow tab's logic jumps, so answering here
 * shows exactly the path a respondent would take.
 */
export default function PreviewModal({ show, onClose, pages, workflow, theme }) {
  const [device, setDevice] = useState("desktop");
  const [answers, setAnswers] = useState({});
  // Test values for the hidden fields, typed in the bar instead of the link.
  const [hidden, setHidden] = useState({});
  // The ending reached, once Finish is pressed.
  const [ending, setEnding] = useState(null);
  const flow = useFlow(pages, workflow, answers, hidden);
  const { at, last } = flow;

  const starting = useLoadingScreen(show ? theme : null);

  const keys = workflow?.hidden || [];
  const page = useMemo(() => {
    const p = pages[at];
    if (!p) return p;
    const fill = (t) => recall(t, hidden, flow.varsBefore);
    return { ...p, fields: p.fields.map((f) => ({ ...f, label: fill(f.label), description: fill(f.description) })) };
  }, [pages, at, hidden, flow.varsBefore]);

  /* Finish: the same run the server makes, so the ending, score and tags
     shown here are the ones a real respondent would get. */
  const finish = () => {
    const r = run(pages, workflow, answers, hidden);
    const o = r.outcome;
    setEnding({
      title: o ? recall(o.title, hidden, r.vars) : "",
      message: o ? recall(o.message, hidden, r.vars) : "",
      redirect: o && o.redirect ? recall(o.redirect, hidden, r.vars) : "",
      score: r.score,
      tags: r.tags,
      vars: r.vars,
    });
  };

  const mobile = device === "mobile";

  const close = () => {
    flow.reset();
    setAnswers({});
    setEnding(null);
    onClose();
  };

  return (
    <Modal show={show} onHide={close} fullscreen contentClassName="pw">
      <div className="pw-bar">
        <span className="pw-count">
          Page {pages.length ? at + 1 : 0} of {pages.length}
        </span>

        <div className="pw-devices" role="group" aria-label="Preview size">
          <button
            type="button"
            className={device === "desktop" ? "pw-dev pw-dev-on" : "pw-dev"}
            onClick={() => setDevice("desktop")}
            aria-pressed={device === "desktop"}
          >
            Desktop
          </button>
          <button
            type="button"
            className={device === "mobile" ? "pw-dev pw-dev-on" : "pw-dev"}
            onClick={() => setDevice("mobile")}
            aria-pressed={device === "mobile"}
          >
            Mobile
          </button>
        </div>

        {keys.length > 0 && (
          <div className="pw-hidden" title="Values that would come in on the form link">
            {keys.map(({ key }) => (
              <label key={key}>
                <span>?{key}=</span>
                <input
                  value={hidden[key] || ""}
                  maxLength={500}
                  onChange={(e) => setHidden((h) => ({ ...h, [key]: e.target.value }))}
                  aria-label={`Link value ${key}`}
                />
              </label>
            ))}
          </div>
        )}

        <button type="button" className="pw-close" onClick={close} aria-label="Close preview">
          ×
        </button>
      </div>

      <ThemedForm
        theme={theme}
        device={device}
        showLoading={starting}
        media={pageMedia(page, device)}
      >
        <div className={mobile ? "pw-stage pw-stage-mobile" : "pw-stage"}>
          <div className="pw-frame">
            {ending ? (
              <div className="pw-ending">
                <h2>{ending.title || "Thank you"}</h2>
                <p>{ending.message || (ending.title ? "" : "Your answers are in.")}</p>
                <dl>
                  <dt>Score</dt>
                  <dd>{ending.score}</dd>
                  {ending.tags.length > 0 && (
                    <>
                      <dt>Tags</dt>
                      <dd>{ending.tags.join(", ")}</dd>
                    </>
                  )}
                  {Object.entries(ending.vars)
                    .filter(([k]) => k !== "score")
                    .map(([k, v]) => (
                      <span key={k} style={{ display: "contents" }}>
                        <dt>{k}</dt>
                        <dd>{String(v)}</dd>
                      </span>
                    ))}
                  {ending.redirect && (
                    <>
                      <dt>Then goes to</dt>
                      <dd>{ending.redirect}</dd>
                    </>
                  )}
                </dl>
                <small>Only you see the score, tags and variables here — respondents see the title and message.</small>
              </div>
            ) : !page ? (
              <p className="text-muted mb-0">This form has no pages yet.</p>
            ) : (
              <div className="pw-fields">
                {page.fields.length === 0 ? (
                  <p className="text-muted mb-0">This page is empty.</p>
                ) : (
                  page.fields.map((f) => (
                    <FieldPreview
                      key={f.id}
                      field={f}
                      device={device}
                      value={answers[f.id]}
                      onChange={(v) => setAnswers((a) => ({ ...a, [f.id]: v }))}
                    />
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        <div className="pw-foot">
          <button
            type="button"
            className="bx-ghost"
            disabled={ending ? false : !flow.canGoBack}
            onClick={() => (ending ? setEnding(null) : flow.goBack())}
          >
            Back
          </button>
          <button
            type="button"
            className="bx-publish"
            disabled={!pages.length}
            onClick={() => (ending ? close() : last ? finish() : flow.goNext())}
          >
            {ending ? "Close" : last ? "Finish" : "Next"}
          </button>
        </div>
      </ThemedForm>
    </Modal>
  );
}