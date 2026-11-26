import { ImagePicker, LayoutPicker } from "../design/controls";
import SettingsSection from "./SettingsSection";
import { DESKTOP_LAYOUTS, MOBILE_LAYOUTS } from "../design/themes";
import { layoutsOf, picturesOf } from "./PageMedia";

/**
 * The Background section, shared by a page's settings and by a welcome /
 * end screen's settings so the two can never drift apart.
 *
 * One picture per page — a background — with:
 *
 *   a version for wide screens and, if wanted, a different one for phones
 *   a layout for each: behind the questions, or beside them (left half,
 *     right half, a narrow tile either side, a banner across the top)
 *   Darken, when it sits behind them, so the words stay readable
 *
 * Like a theme picture in the Design section, it always fills the space
 * its layout gives it, edge to edge — there is no shrink-to-fit option.
 *
 * `kind` is "page" or "screen" and only changes the wording.
 *
 * Forms built earlier may hold their picture under the older `image` keys.
 * It shows up here as the background, and replacing or removing it clears
 * the old key, so there is never a second, hidden picture.
 */
export default function MediaSettings({ owner, onChange, kind = "page" }) {
  const screen = kind === "screen";

  const pictures = picturesOf(owner);
  const layouts = layoutsOf(owner);
  const hasPicture = Boolean(pictures.desktop || pictures.mobile);

  const behind = layouts.desktop === "full" || layouts.mobile === "full";
  const dim = Number(owner.backgroundDim) || 0;

  return (
    <SettingsSection title="Background">

      <div className="fb-field">
        <span className="fb-label">Desktop background</span>
        <ImagePicker
          value={pictures.desktop}
          onChange={(background) => onChange({ background, image: "" })}
          label="Background picture for wide screens"
          cta="Add a background"
          hint="Drop a file here, or choose one"
        />
        <span className="fb-hint">Shown on laptops and other wide screens.</span>
      </div>

      <div className="fb-field">
        <span className="fb-label">Mobile background</span>
        <ImagePicker
          value={pictures.mobile}
          onChange={(backgroundMobile) => onChange({ backgroundMobile, imageMobile: "" })}
          label="Background picture for phones"
          cta="Add a mobile background"
          hint="Drop a file here, or choose one"
        />
        <span className="fb-hint">
          Shown on phones. Leave empty and phones use the desktop background.
        </span>
      </div>

      {hasPicture && (
        <>
          <div className="fb-field">
            <span className="fb-label">Layout</span>
            <span className="fb-hint">
              Where the background sits next to {screen ? "this screen" : "this page's questions"}.
            </span>
            <div className="fb-layouts">
              <span className="fb-layout-row">
                <span className="fb-label-sm">Desktop</span>
                <LayoutPicker
                  options={DESKTOP_LAYOUTS}
                  value={layouts.desktop}
                  onChange={(backgroundLayout) => onChange({ backgroundLayout })}
                  label="Background layout on a wide screen"
                />
              </span>
              <span className="fb-layout-row">
                <span className="fb-label-sm">Mobile</span>
                <LayoutPicker
                  options={MOBILE_LAYOUTS}
                  value={layouts.mobile}
                  onChange={(backgroundLayoutMobile) => onChange({ backgroundLayoutMobile })}
                  label="Background layout on a phone"
                  mobile
                />
              </span>
            </div>
          </div>

          {behind && (
            <label className="fb-field">
              <span className="fb-label">Darken · {dim}%</span>
              <input
                type="range"
                className="fb-range"
                min={0}
                max={80}
                step={5}
                value={dim}
                onChange={(e) => onChange({ backgroundDim: Number(e.target.value) })}
              />
              <span className="fb-hint">
                Darkens a background that sits behind the words, so they stay easy to read.
              </span>
            </label>
          )}
        </>
      )}
    </SettingsSection>
  );
}