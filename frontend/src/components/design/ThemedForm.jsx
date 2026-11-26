import "animate.css";
import FontLoader from "./FontLoader";
import LoadingScreen from "./LoadingScreen";
import { animationId, fillTheme, isVideo, themeVars } from "./themes";
import "./themed-form.css";

/**
 * Wraps the real form in whatever theme it wears.
 *
 * The Design section previews a theme with made-up questions; this puts
 * the same theme around the actual ones, so what someone designed is what
 * a respondent sees.
 *
 * The logo floats over the background picture instead of sitting above
 * it, so it never pushes the picture down the page.
 *
 * The font comes from Google Fonts through FontLoader, and the entrance
 * animation from the animate.css package.
 *
 * `media` is the background of the page on screen, from pageMedia() in
 * PageMedia.jsx: { src, layout, dim }. When a page has one, it takes the
 * place of the theme's own picture on that page and is drawn exactly the
 * way the Design section draws a theme picture: it always fills its space
 * edge to edge, so a left half is the whole left half of the screen and a
 * top banner runs right across. A form without a theme still gets the
 * layout; it simply has no theme colours around it.
 */

/** True when the form wears a theme. */
export const isThemed = (config) => Boolean(config && Object.keys(config).length);

/** The picture, in the slot the layout gives it. */
function Picture({ src }) {
  return (
    <figure className="tf-media">
      {isVideo(src) ? <video src={src} muted loop autoPlay playsInline /> : <img src={src} alt="" />}
      <span className="tf-media-veil" />
    </figure>
  );
}

/* A page picture is shown as it is: centred, unfiltered, darkened only by
   the page's own Darken slider. */
const mediaVars = (media) => ({
  "--t-media-focal": "50% 50%",
  "--t-media-filter": "none",
  "--t-media-overlay": `rgba(0, 0, 0, ${(media.dim || 0) / 100})`,
});

export default function ThemedForm({
  theme: config,
  children,
  device = "desktop",
  showLoading = false,
  media = null,
}) {
  const themed = isThemed(config);
  const pageMedia = media && media.src && media.layout !== "none" ? media : null;

  /* ---- no theme ---- */

  if (!themed) {
    if (!pageMedia) return children;

    // The same split as a themed form, with no theme colours around it.
    return (
      <div
        className={`tf-bare tf-lay-${pageMedia.layout}`}
        style={mediaVars(pageMedia)}
      >
        <div className="tf-split">
          <Picture src={pageMedia.src} />
          <div className="tf-form">{children}</div>
        </div>
      </div>
    );
  }

  /* ---- a theme ---- */

  const theme = fillTheme(config);
  const bg = theme.background;

  // A page's own background wins; otherwise the theme's picture.
  const src = pageMedia ? pageMedia.src : bg.image;
  const layout = pageMedia ? pageMedia.layout : device === "mobile" ? bg.mobile : bg.desktop;
  const showMedia = Boolean(src) && layout !== "none";

  const cls = [
    "tf",
    `tf-anim-${animationId(theme.motion.animation)}`,
    `tf-hover-${theme.motion.hover}`,
    `tf-fields-${theme.card.fieldStyle}`,
    `tf-btnw-${theme.buttons.width}`,
    showMedia ? `tf-lay-${layout}` : "tf-lay-none",
    theme.header.showName ? "" : "tf-no-name",
    theme.header.showCount ? "" : "tf-no-count",
    theme.header.place === "top" ? "tf-strip-top" : "tf-strip-bottom",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cls} style={{ ...themeVars(theme), ...(pageMedia ? mediaVars(pageMedia) : {}) }}>
      <FontLoader families={theme.font.family} />
      <div className="tf-split">
        {showMedia && <Picture src={src} />}
        <div className="tf-form">{children}</div>
      </div>

      {theme.logo.show !== false && theme.logo.src && (
        <div className="tf-logo">
          <img src={theme.logo.src} alt="" />
        </div>
      )}

      {/* Last and outermost, so the form — logo included — stays behind it. */}
      {showLoading && <LoadingScreen theme={config} />}
    </div>
  );
}