import "animate.css";
import FontLoader from "./FontLoader";
import { animationId, fillTheme, isVideo, themeVars } from "./themes";

/**
 * What a theme looks like when someone fills the form in.
 *
 * One component serves both places a theme is shown: the small square on a
 * gallery card (`compact`) and the full sheet in the editor. Because both
 * read the same custom properties from themeVars(), a card can never show
 * something the editor does not.
 *
 * The logo floats in the top-left corner, over the background picture
 * rather than above it, so it costs no room of its own.
 */
export default function ThemeCanvas({ theme: raw, compact = false, replay = 0, device = "desktop" }) {
  const theme = fillTheme(raw);
  const bg = theme.background;

  /* A phone gets its own layout; a card always previews the wide one. */
  const layout = device === "mobile" && !compact ? bg.mobile : bg.desktop;
  const showMedia = Boolean(bg.image) && layout !== "none";
  const showLogo = theme.logo.show !== false && (Boolean(theme.logo.src) || !compact);
  const showHeader = !compact && (theme.header.showName || theme.header.showCount);
  const atTop = theme.header.place === "top";

  const cls = [
    "ds-canvas",
    compact ? "is-compact" : "is-full",
    device === "mobile" ? "is-mobile" : "",
    `ds-anim-${animationId(theme.motion.animation)}`,
    `ds-hover-${theme.motion.hover}`,
    `ds-fields-${theme.card.fieldStyle}`,
    `ds-btnw-${theme.buttons.width}`,
    showMedia ? `ds-lay-${layout}` : "ds-lay-none",
    atTop ? "ds-strip-top" : "ds-strip-bottom",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cls} style={themeVars(theme)} aria-hidden={compact ? "true" : undefined}>
      <FontLoader families={theme.font.family} />
      <div className="ds-canvas-split">
        {showMedia && (
          <figure className="ds-cv-media">
            {isVideo(bg.image) ? (
              <video src={bg.image} muted loop autoPlay playsInline />
            ) : (
              <img src={bg.image} alt="" />
            )}
            <span className="ds-cv-media-veil" />
          </figure>
        )}

        <div className="ds-canvas-form">
          {showHeader && atTop && (
            <div className="ds-cv-header">
              {theme.header.showName && <span className="ds-cv-formname">Your form</span>}
              {theme.header.showCount && <span className="ds-cv-pagecount">1 / 4</span>}
            </div>
          )}

          <div className="ds-canvas-sheet" key={replay}>
            <p className="ds-cv-welcome">{compact ? "Welcome" : "Welcome to the form"}</p>

            <div className="ds-cv-block" style={{ "--i": 0 }}>
              <p className="ds-cv-question">
                {compact ? "Your question here" : "1 · What should we call you?"}
              </p>
              {!compact && (
                <p className="ds-cv-help">A short description sits under every question.</p>
              )}
              <div className="ds-cv-field">
                <span className="ds-cv-answer">{compact ? "Answer" : "Type your answer here"}</span>
              </div>
            </div>

            {!compact && (
              <div className="ds-cv-block" style={{ "--i": 1 }}>
                <p className="ds-cv-question">2 · Which gift suits you best?</p>
                <div className="ds-cv-choices">
                  {["Hamper", "Gift card", "Experience day"].map((c, i) => (
                    <span key={c} className={i === 0 ? "ds-cv-choice is-on" : "ds-cv-choice"}>
                      <span className="ds-cv-key">{String.fromCharCode(65 + i)}</span>
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="ds-cv-actions" style={{ "--i": 2 }}>
              <span className="ds-cv-btn">{compact ? "Submit" : "Continue"}</span>
              {!compact && <span className="ds-cv-hint">or press Enter ↵</span>}
            </div>
          </div>

          {showHeader && !atTop && (
            <div className="ds-cv-header">
              {theme.header.showName && <span className="ds-cv-formname">Your form</span>}
              {theme.header.showCount && <span className="ds-cv-pagecount">1 / 4</span>}
            </div>
          )}
        </div>
      </div>

      {/* Positioned, so it sits over the picture rather than above it. */}
      {showLogo && (
        <div className="ds-cv-logo">
          {theme.logo.src ? (
            <img src={theme.logo.src} alt="" />
          ) : (
            <span className="ds-cv-logo-slot">Your logo</span>
          )}
        </div>
      )}
    </div>
  );
}