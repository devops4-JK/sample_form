import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Spinner } from "react-bootstrap";
import { api } from "../services/api";
import FieldPreview from "../components/builder/FieldPreview";
import { pageMedia, useDevice } from "../components/builder/PageMedia";
import ThemedForm from "../components/design/ThemedForm";
import { useLoadingScreen } from "../components/design/LoadingScreen";
import EmailGate, { GateRefused } from "../components/validation/EmailGate";
import { INPUT_TYPES } from "../constants/formElements";
import { isProductType, productProblem } from "../constants/products";
import useFlow from "../components/workflow/useFlow";
import { recall } from "../components/workflow/engine";

/**
 * What the public link opens: /f/:publicId
 *
 * Standalone by design — no app nav, no footer — so the form is the only
 * thing on screen. Whatever theme the form wears in the Design section is
 * wrapped around it here, so a respondent sees what was designed.
 *
 * A form that validates who may fill it in shows the email gate first, and
 * the form itself only once an address has been let through. The ticket the
 * gate hands back travels with the answers, so the server can close that
 * address off when the form is finished.
 */

/** An answer that was never given. */
const isEmpty = (value) =>
  value === undefined ||
  value === null ||
  value === "" ||
  (Array.isArray(value) && value.length === 0) ||
  (typeof value === "object" &&
    !Array.isArray(value) &&
    Object.values(value).filter(Boolean).length === 0);

/** Which questions on this page were marked required and left blank. */
function missingOn(page, answers) {
  const out = {};
  (page?.fields || []).forEach((f) => {
    // Products have their own rule: a size is needed once a sized product
    // is picked, whether the question is required or not.
    if (isProductType(f.type)) {
      const problem = productProblem(f, answers[f.id]);
      if (problem) out[f.id] = problem;
      return;
    }
    if (!f.required || !INPUT_TYPES.has(f.type)) return;
    if (isEmpty(answers[f.id])) out[f.id] = `${f.label || "This question"} is required.`;
  });
  return out;
}

/**
 * The screen after submitting. Shows the ending the server chose, if the
 * Workflow tab has any; otherwise the standard thank-you. An ending can
 * send people on to another site — only an http(s) address, which the
 * server has already checked.
 */
function Ending({ ending }) {
  const go = ending && /^https?:\/\//i.test(ending.redirect || "") ? ending.redirect : "";
  useEffect(() => {
    if (!go) return undefined;
    const t = setTimeout(() => window.location.assign(go), 2500);
    return () => clearTimeout(t);
  }, [go]);
  return (
    <div className="pf-centre">
      <h1 className="h4 mb-2">{ending?.title || "Thank you"}</h1>
      <p className="text-muted mb-0" style={{ whiteSpace: "pre-line", maxWidth: 560, textAlign: "center" }}>
        {ending?.message || (ending?.title ? "" : "Your answers are in.")}
      </p>
      {go && (
        <p className="mt-3 mb-0 small">
          Taking you on in a moment… <a href={go} rel="noopener noreferrer">Go now</a>
        </p>
      )}
    </div>
  );
}

export default function PublicForm() {
  const { publicId } = useParams();

  /* A phone gets the mobile picture, layout and background; a wide screen
     gets the desktop ones. Follows the window if it is resized. */
  const device = useDevice();

  const [form, setForm] = useState(null);
  const [pages, setPages] = useState([]);
  const [answers, setAnswers] = useState({});

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  // The thank-you screen the server picked from the Workflow tab's endings.
  const [ending, setEnding] = useState(null);

  /* The validation gate. `ticket` is null until an address is let in, and
     `refused` holds the reason a visitor was turned away. */
  const [ticket, setTicket] = useState(null);
  const [refused, setRefused] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { form } = await api.getPublicForm(publicId);
        if (!alive) return;
        const schema = form.schema;
        const list = schema?.pages?.length
          ? schema.pages
          : schema?.fields?.length
          ? [{ id: "p1", name: "Page 1", fields: schema.fields, image: "" }]
          : [];
        setForm(form);
        setPages(list);
      } catch (err) {
        if (alive) setError(err.message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [publicId]);

  const theme = form?.theme?.config;
  const mode = form?.validation?.mode || "none";
  const needsGate = mode !== "none";

  // The loading animation belongs to the form, so it waits until the gate
  // has been passed rather than playing to someone about to be refused.
  const open = !needsGate || Boolean(ticket);
  const starting = useLoadingScreen(open ? theme : null);

  /* Which page is showing, following the form's logic jumps. Back goes to
     the page the respondent actually came from. The server walks the same
     rules again when the answers arrive, so editing them here gains nothing. */
  /* Hidden fields: only the names the Workflow tab declares are read from
     the link, as short plain text. The server checks them again. */
  const hidden = useMemo(() => {
    const out = {};
    const query = new URLSearchParams(window.location.search);
    (form?.workflow?.hidden || []).forEach(({ key }) => {
      const v = (query.get(key) || "").trim().slice(0, 500);
      if (v) out[key] = v;
    });
    return out;
  }, [form]);

  const flow = useFlow(pages, form?.workflow, answers, hidden);
  const { at, last } = flow;

  /* {{name}} in a title or description is filled with a link value or a
     variable. React prints it as text, so nothing in it can run. */
  const page = useMemo(() => {
    const p = pages[at];
    if (!p) return p;
    const fill = (t) => recall(t, hidden, flow.varsBefore);
    return {
      ...p,
      fields: p.fields.map((f) => ({ ...f, label: fill(f.label), description: fill(f.description) })),
    };
  }, [pages, at, hidden, flow.varsBefore]);

  const problems = useMemo(() => missingOn(page, answers), [page, answers]);
  const [showProblems, setShowProblems] = useState(false);

  /** Asks the gate to let an address in. */
  const signIn = async (email) => {
    try {
      const { ticket: pass } = await api.signInToForm(publicId, email);
      setTicket(pass);
      setRefused(null);
    } catch (err) {
      // "not_listed" and "already_done" each get their own page. Anything
      // else — a typo in the box — goes back to the gate as a message.
      if (err.reason && err.reason !== "not_an_email") {
        setRefused({ reason: err.reason, message: err.message });
        return;
      }
      throw err;
    }
  };

  const next = async () => {
    const broken = Object.keys(problems);
    if (broken.length) {
      setShowProblems(true);
      setError(
        broken.length === 1
          ? problems[broken[0]]
          : `${broken.length} answers need a look before you can go on.`
      );
      document
        .querySelector(`[data-field="${broken[0]}"]`)
        ?.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }
    setShowProblems(false);
    setError("");

    if (!last) {
      flow.goNext();
      window.scrollTo({ top: 0 });
      return;
    }

    setSending(true);
    try {
      const result = await api.submitPublicForm(publicId, answers, ticket, hidden);
      setEnding(result?.ending || null);
      setDone(true);
    } catch (err) {
      // The gate can refuse at the last moment too — another tab got there
      // first, or the sign-in expired.
      if (err.reason === "already_done" || err.reason === "no_ticket") {
        setRefused({ reason: err.reason, message: err.message });
        return;
      }
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="pf-centre">
        <Spinner animation="border" size="sm" />
      </div>
    );
  }

  if (!form) {
    return (
      <div className="pf-centre">
        <h1 className="h5 mb-2">This form is not available</h1>
        <p className="text-muted mb-0">
          {error || "The link may be wrong, or the form is no longer published."}
        </p>
      </div>
    );
  }

  /* ---- the gate, before anything else is rendered ---- */

  if (refused) {
    return (
      <GateRefused
        theme={theme}
        reason={refused.reason}
        message={refused.message}
        onAgain={() => {
          setRefused(null);
          setTicket(null);
        }}
      />
    );
  }

  if (needsGate && !ticket) {
    return <EmailGate theme={theme} formName={form.name} mode={mode} onPass={signIn} />;
  }

  if (done) {
    return <Ending ending={ending} />;
  }

  return (
    <ThemedForm
      theme={theme}
      device={device}
      showLoading={starting}
      media={pageMedia(page, device)}
    >
      <div className="pf">
        <header className="pf-top">
          <span className="pf-name">{form.name}</span>
          {pages.length > 1 && (
            <span className="pf-count">
              {at + 1} / {pages.length}
            </span>
          )}
        </header>

        <div className="pf-stage">
          <div className={page?.fields.length === 1 ? "pf-card pf-card-single" : "pf-card"}>
            {!page || page.fields.length === 0 ? (
              <p className="text-muted mb-0">This form has no questions yet.</p>
            ) : (
              <>
                {page.fields.map((f) => (
                  <div
                    key={f.id}
                    data-field={f.id}
                    className={
                      showProblems && problems[f.id] ? "pf-slot is-wrong" : "pf-slot"
                    }
                  >
                    <FieldPreview
                      field={f}
                      device={device}
                      value={answers[f.id]}
                      onChange={(v) => {
                        setAnswers((a) => ({ ...a, [f.id]: v }));
                      }}
                    />
                    {showProblems && problems[f.id] && (
                      <p className="pf-wrong" role="alert">
                        {problems[f.id]}
                      </p>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        <footer className="pf-foot">
          {error && <span className="pf-error">{error}</span>}
          <button
            type="button"
            className="bx-ghost"
            disabled={!flow.canGoBack || sending}
            onClick={() => {
              setError("");
              setShowProblems(false);
              flow.goBack();
            }}
          >
            Back
          </button>
          <button type="button" className="bx-publish" onClick={next} disabled={sending}>
            {sending ? "Sending…" : last ? "Submit" : "Next"}
          </button>
        </footer>
      </div>
    </ThemedForm>
  );
}



