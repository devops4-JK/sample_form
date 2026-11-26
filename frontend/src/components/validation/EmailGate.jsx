import { useState } from "react";
import { fillTheme, themeVars } from "../design/themes";
import "./validation.css";

/**
 * What a respondent meets before a validated form opens.
 *
 * One box, one button. The server decides whether the address may come in;
 * this only asks for it and shows whatever came back. Refusals are pages in
 * their own right — a turned-away visitor should not be left staring at a
 * form they cannot fill in.
 *
 * A form with no validation never renders any of this.
 */

const I = {
  mail: "M3 6h18v12H3zM3 7l9 6 9-6",
  stop: "M12 9v4M12 17h.01M10.3 3.9 2.4 17.6A2 2 0 0 0 4.1 20.6h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0",
  done: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M8.5 12.2l2.4 2.4 4.6-5",
};

function Glyph({ d, size = 22 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

/**
 * The shell every gate screen sits in. It carries the form's theme, so the
 * sign-in and the error pages look like the form behind them rather than
 * like the app.
 */
function Shell({ theme, children }) {
  const filled = theme && Object.keys(theme).length ? fillTheme(theme) : null;
  const style = filled ? themeVars(filled) : undefined;
  const logo = filled?.logo?.show !== false ? filled?.logo?.src : null;

  return (
    <div className="vg" style={style}>
      <div className="vg-card">
        {logo && (
          <div className="vg-logo">
            <img src={logo} alt="" />
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

/* ------------------------------ refusals ------------------------------ */

/**
 * The error page. `reason` decides the heading; the wording underneath is
 * whatever the form's owner set in the Validation tab, or a sensible
 * default when they set nothing.
 */
export function GateRefused({ theme, reason, message, onAgain }) {
  const finished = reason === "already_done" || reason === "already_open";

  const title = finished
    ? reason === "already_done"
      ? "This form has already been filled in"
      : "This form has already been opened"
    : "You cannot open this form";

  return (
    <Shell theme={theme}>
      <span className={finished ? "vg-icon vg-icon-done" : "vg-icon vg-icon-stop"}>
        <Glyph d={finished ? I.done : I.stop} />
      </span>

      <h1 className="vg-title">{title}</h1>
      <p className="vg-text">{message}</p>

      {/* Only a wrong address is worth another go — a finished form is not. */}
      {!finished && onAgain && (
        <button type="button" className="vg-again" onClick={onAgain}>
          Try another address
        </button>
      )}

      <p className="vg-foot">
        {finished
          ? "If you think this is wrong, contact whoever sent you the link."
          : "Check the address against the invitation you were sent."}
      </p>
    </Shell>
  );
}

/* ------------------------------ signing in ------------------------------ */

export default function EmailGate({ theme, formName, mode, onPass }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;

    const value = email.trim();
    if (!value) {
      setError("Enter your email address to go on.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      await onPass(value);
    } catch (err) {
      // A refusal is not an error in the box — the page above turns it
      // into its own screen. Only a bad address stays here.
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell theme={theme}>
      <span className="vg-icon">
        <Glyph d={I.mail} />
      </span>

      <h1 className="vg-title">{formName}</h1>
      <p className="vg-text">
        {mode === "list"
          ? "Enter the email address this form was sent to. Only invited addresses can open it."
          : "Enter your email address to open the form. It can be filled in once."}
      </p>

      <form className="vg-form" onSubmit={submit} noValidate>
        <label className="vg-label" htmlFor="vg-email">
          Email address
        </label>
        <input
          id="vg-email"
          className="vg-input"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoFocus
          value={email}
          placeholder="you@company.com"
          onChange={(e) => {
            setEmail(e.target.value);
            if (error) setError("");
          }}
          disabled={busy}
        />

        {error && (
          <p className="vg-error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="vg-btn" disabled={busy}>
          {busy ? "Checking…" : "Open the form"}
        </button>
      </form>

      <p className="vg-foot">Your address is only used to check this form, never shown publicly.</p>
    </Shell>
  );
}