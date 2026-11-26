import FontPicker from "react-fontpicker-ts";
import { fontName } from "./themes";

/**
 * Loads Google fonts without drawing anything.
 *
 * The Design section picks a family with the `react-fontpicker-ts` package;
 * this is the same package in its loader-only mode, so the form, the
 * preview and the published page all fetch the face the theme names.
 *
 * `families` may be one name or several. Names are cleaned by fontName()
 * first, so only letters, digits and spaces ever reach the font URL.
 */
export default function FontLoader({ families }) {
  const list = [...new Set((Array.isArray(families) ? families : [families]).map(fontName))];
  if (!list.length) return null;

  return <FontPicker key={list.join("|")} loaderOnly loadFonts={list} />;
}