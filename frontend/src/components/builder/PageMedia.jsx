import { useEffect, useState } from "react";
import { isVideo } from "../design/themes";
import "./page-media.css";

/**
 * The background picture of a page, or of a welcome / end screen.
 *
 * A page has one picture. It can sit behind the questions or beside them,
 * and a phone can have a picture and a position of its own:
 *
 *   background, backgroundMobile              the picture, and one for phones
 *   backgroundLayout, backgroundLayoutMobile  where it sits on each
 *   imageFit                                  "cover" (fill) or "contain" (whole)
 *   backgroundDim                             0–80, darkening when it is behind
 *
 * A phone falls back to the desktop picture when it has none of its own.
 *
 * Forms built before there was only one picture may still carry the older
 * `image` / `imageLayout` keys. They are read as the background when no
 * background has been set, so nothing already built loses its picture.
 */

const PHONE = "(max-width: 720px)";

/** "mobile" on a narrow screen, "desktop" otherwise. Follows the window. */
export function useDevice() {
  const read = () =>
    typeof window !== "undefined" && window.matchMedia?.(PHONE).matches ? "mobile" : "desktop";

  const [device, setDevice] = useState(read);

  useEffect(() => {
    const query = window.matchMedia?.(PHONE);
    if (!query) return undefined;
    const update = () => setDevice(query.matches ? "mobile" : "desktop");
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return device;
}

/** The picture stored under `key` that this device should show. */
export function mediaSrc(owner, key, device = "desktop") {
  if (!owner) return "";
  if (device === "mobile") return owner[`${key}Mobile`] || owner[key] || "";
  return owner[key] || "";
}

/** The owner's picture as the settings panel shows it: one for each device. */
export function picturesOf(owner) {
  return {
    desktop: owner?.background || owner?.image || "",
    mobile: owner?.backgroundMobile || owner?.imageMobile || "",
  };
}

/**
 * Where the owner's picture sits on each device.
 *
 * A layout chosen in the Background section wins. Without one, a picture
 * added as a background sits behind the questions, and an older `image`
 * keeps the position it was given.
 */
export function layoutsOf(owner) {
  const isBackground = Boolean(owner?.background || owner?.backgroundMobile);
  return {
    desktop: owner?.backgroundLayout || (isBackground ? "full" : owner?.imageLayout || "banner"),
    mobile:
      owner?.backgroundLayoutMobile || (isBackground ? "full" : owner?.imageLayoutMobile || "banner"),
  };
}

const isScreen = (f) => f?.type === "welcome_screen" || f?.type === "end_screen";

/**
 * The one picture a page shows on this device, or null:
 *   { src, layout, fit, dim }
 *
 * The page's own picture wins. Without one, the first welcome or end screen
 * on the page that has a picture supplies it, so a background set on a
 * screen dresses the page that screen is on.
 */
export function pageMedia(page, device = "desktop") {
  if (!page) return null;

  for (const owner of [page, ...(page.fields || []).filter(isScreen)]) {
    const src =
      mediaSrc(owner, "background", device) || mediaSrc(owner, "image", device);
    if (!src) continue;

    const layouts = layoutsOf(owner);
    const legacyScreenPicture = isScreen(owner) && !owner.background && !owner.backgroundMobile;

    return {
      src,
      layout: device === "mobile" ? layouts.mobile : layouts.desktop,
      fit: owner.imageFit || (legacyScreenPicture ? "contain" : "cover"),
      dim: Math.max(0, Math.min(80, Number(owner.backgroundDim) || 0)),
    };
  }
  return null;
}

/** The picture to draw behind the whole page on this device, or null. */
export function backdropOf(page, device = "desktop") {
  const media = pageMedia(page, device);
  return media && media.layout === "full" ? { src: media.src, dim: media.dim } : null;
}

function Media({ src, alt = "" }) {
  return isVideo(src) ? <video src={src} muted loop autoPlay playsInline /> : <img src={src} alt={alt} />;
}

/**
 * The background picture, filling whatever positioned box it is put in.
 * Give that box the class `has-pb`; the picture then sits behind the box's
 * other children without any of them needing to change.
 */
export function PageBackdrop({ page, device = "desktop" }) {
  const backdrop = backdropOf(page, device);
  if (!backdrop) return null;

  return (
    <div className="pb" aria-hidden="true">
      <Media src={backdrop.src} />
      {backdrop.dim > 0 && <span className="pb-veil" style={{ opacity: backdrop.dim / 100 }} />}
    </div>
  );
}

/**
 * The page's picture when it sits *beside* the questions — down the left,
 * down the right, across the top or along the bottom. A picture that sits
 * behind them is drawn by <PageBackdrop /> instead, and a page with no
 * picture (or one hidden on this device) renders its children untouched.
 */
export default function PageMedia({ page, device = "desktop", children }) {
  const media = pageMedia(page, device);
  if (!media || media.layout === "full" || media.layout === "none") return children;

  return (
    <div className={`pm pm-${media.layout} pm-fit-${media.fit === "contain" ? "contain" : "cover"}`}>
      <figure className="pm-media">
        <Media src={media.src} />
      </figure>

      <div className="pm-body">{children}</div>
    </div>
  );
}