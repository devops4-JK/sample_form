import { useEffect, useState } from "react";
import {
  BarLoader,
  BeatLoader,
  BounceLoader,
  CircleLoader,
  ClimbingBoxLoader,
  ClipLoader,
  ClockLoader,
  DotLoader,
  FadeLoader,
  GridLoader,
  HashLoader,
  MoonLoader,
  PacmanLoader,
  PropagateLoader,
  PuffLoader,
  PulseLoader,
  RingLoader,
  RiseLoader,
  RotateLoader,
  ScaleLoader,
  SkewLoader,
  SquareLoader,
  SyncLoader,
} from "react-spinners";
import { fillTheme, isSpinner, themeVars } from "./themes";
import "./loading-screen.css";

/**
 * The few seconds before the first question: the form's logo on the
 * theme's background, with an animation.
 *
 * `useLoadingScreen` is what pages use — it answers "is the form still
 * getting ready?" and counts the seconds down. `LoadingScreen` draws it.
 * Anyone who has asked their device to reduce motion skips the wait.
 *
 * Two kinds of animation: the seven that move the logo itself (plain CSS in
 * loading-screen.css), and the spinners from the `react-spinners` package,
 * drawn under the logo in the theme's button colour.
 */

/* id → the react-spinners component, and the size that suits it. */
const SPINNERS = {
  "sp-bar": [BarLoader, { width: 140, height: 4 }],
  "sp-beat": [BeatLoader, { size: 14 }],
  "sp-bounce": [BounceLoader, { size: 52 }],
  "sp-circle": [CircleLoader, { size: 52 }],
  "sp-climbing-box": [ClimbingBoxLoader, { size: 13 }],
  "sp-clip": [ClipLoader, { size: 44 }],
  "sp-clock": [ClockLoader, { size: 48 }],
  "sp-dot": [DotLoader, { size: 48 }],
  "sp-fade": [FadeLoader, {}],
  "sp-grid": [GridLoader, { size: 13 }],
  "sp-hash": [HashLoader, { size: 48 }],
  "sp-moon": [MoonLoader, { size: 44 }],
  "sp-pacman": [PacmanLoader, { size: 22 }],
  "sp-propagate": [PropagateLoader, { size: 13 }],
  "sp-puff": [PuffLoader, { size: 56 }],
  "sp-pulse": [PulseLoader, { size: 13 }],
  "sp-ring": [RingLoader, { size: 56 }],
  "sp-rise": [RiseLoader, { size: 13 }],
  "sp-rotate": [RotateLoader, { size: 13 }],
  "sp-scale": [ScaleLoader, {}],
  "sp-skew": [SkewLoader, { size: 22 }],
  "sp-square": [SquareLoader, { size: 44 }],
  "sp-sync": [SyncLoader, { size: 13 }],
};

export function useLoadingScreen(config) {
  const theme = config ? fillTheme(config) : null;

  /* A logo animation needs a logo to move. A spinner stands on its own. */
  const wanted = Boolean(
    theme?.loading?.enabled && (theme.logo?.src || isSpinner(theme.loading.animation))
  );

  const [waiting, setWaiting] = useState(wanted);

  useEffect(() => {
    if (!wanted) {
      setWaiting(false);
      return undefined;
    }

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (reduced) {
      setWaiting(false);
      return undefined;
    }

    setWaiting(true);
    const timer = setTimeout(() => setWaiting(false), theme.loading.seconds * 1000);
    return () => clearTimeout(timer);
  }, [wanted, theme?.loading?.seconds]);

  return waiting;
}

export default function LoadingScreen({ theme: config, preview = false }) {
  const theme = fillTheme(config || {});
  const { loading, logo } = theme;

  const spinner = SPINNERS[loading.animation];
  const [Spinner, spinnerProps] = spinner || [];

  /* On the real page a missing logo is simply left out; the placeholder is
     only for the design panel, where it shows where the logo will go. */
  const showMark = Boolean(logo.src) || preview;

  return (
    <div
      className={`tl tl-${spinner ? "has-spinner" : loading.animation}${preview ? " is-preview" : ""}`}
      style={themeVars(theme)}
      role="status"
      aria-live="polite"
    >
      {showMark && (
        <div className="tl-mark">
          {logo.src ? <img src={logo.src} alt="" /> : <span className="tl-slot">Your logo</span>}
          <span className="tl-halo" aria-hidden="true" />
          <span className="tl-sweep" aria-hidden="true" />
        </div>
      )}

      {Spinner && (
        <div className="tl-spinner" aria-hidden="true">
          <Spinner color={theme.buttons.fill} speedMultiplier={0.9} {...spinnerProps} />
        </div>
      )}

      {loading.animation === "bars" && (
        <div className="tl-bars" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      )}

      {loading.showText && loading.text && <p className="tl-text">{loading.text}</p>}
    </div>
  );
}