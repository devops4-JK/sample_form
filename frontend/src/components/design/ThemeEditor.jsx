import { useEffect, useState } from "react";
import FontPicker from "react-fontpicker-ts";
import "react-fontpicker-ts/dist/index.css";
import ThemeCanvas from "./ThemeCanvas";
import LoadingScreen from "./LoadingScreen";
import {
  ALIGNMENTS,
  ANIMATIONS,
  BORDER_STYLES,
  BUTTON_STYLES,
  BUTTON_WIDTHS,
  DESKTOP_LAYOUTS,
  FIELD_STYLES,
  HEADER_PLACES,
  HOVERS,
  LOADING_ANIMATIONS,
  MAX_WAIT,
  MIN_WAIT,
  LOGO_SIZES,
  MOBILE_LAYOUTS,
  MAX_PX,
  MIN_PX,
  SHADOWS,
  SPEEDS,
  animationId,
  fontName,
  fontSizePx,
  fontStack,
} from "./themes";
import {
  ColourControl,
  FocalPicker,
  Group,
  ImagePicker,
  LayoutPicker,
  OptionCards,
  Row,
  Segmented,
  SelectControl,
  SliderControl,
  Switch,
} from "./controls";

/* ---------------- the sections down the left ---------------- */

const SECTIONS = [
  { id: "logo", label: "Logo", note: "Brand mark", icon: "M4 16l5-6 4 5 3-3 4 4M4 5h16v14H4zM9 9.5a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4" },
  { id: "font", label: "Typography", note: "Family, colour, size", icon: "M5 19h4M15 19h4M7 19l5-14 5 14M9 13h6" },
  { id: "buttons", label: "Buttons", note: "Fill, text, shape", icon: "M3 9h18v6H3zM7 12h4" },
  { id: "background", label: "Background", note: "Colour, image, layout", icon: "M3 5h18v14H3zM3 15l5-4 4 3 3-2 6 5" },
  { id: "border", label: "Border & depth", note: "Edges, radius, shadow", icon: "M5 5h14v14H5zM9 9h6v6H9z" },
  { id: "motion", label: "Motion", note: "Animation and hover", icon: "M4 12h4l3-7 3 14 2-7h4" },
  {
    id: "loading",
    label: "Loading",
    note: "The wait before question 1",
    icon: "M12 3a9 9 0 1 0 9 9M12 7v5l3 2",
  },
];

const ALIGN_ICONS = ALIGNMENTS.map((a) => ({ ...a, icon: a.id }));

function SectionGlyph({ d }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

/**
 * The theme editor: the section list on the left, which never moves; the
 * controls for the chosen section beside it, which can be folded away; and
 * the form itself, live, on the right.
 *
 * Every change lands in local state only — this is the design surface,
 * not a save path.
 */
export default function ThemeEditor({ theme, onChange, onBack, onRename }) {
  const [section, setSection] = useState("font");
  const [panelOpen, setPanelOpen] = useState(true);
  const [device, setDevice] = useState("desktop");
  const [replay, setReplay] = useState(0);

  /* Replaying the entrance lets someone judge the animation they picked
     instead of imagining it. */
  useEffect(() => {
    setReplay((n) => n + 1);
  }, [
    theme.motion.animation,
    theme.motion.speed,
    theme.background.desktop,
    theme.background.mobile,
    device,
  ]);

  const set = (part, patch) => onChange({ ...theme, [part]: { ...theme[part], ...patch } });

  const current = SECTIONS.find((s) => s.id === section);

  /* Clicking the section you are already on folds the controls away. */
  const choose = (id) => {
    if (id === section) setPanelOpen((v) => !v);
    else {
      setSection(id);
      setPanelOpen(true);
    }
  };

  return (
    <div className={panelOpen ? "ds-editor" : "ds-editor is-folded"}>
      {/* ---------------- section rail: always in place ---------------- */}
      <nav className="ds-rail" aria-label="Design sections">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            className={section === s.id && panelOpen ? "ds-rail-item is-on" : "ds-rail-item"}
            onClick={() => choose(s.id)}
            aria-current={section === s.id}
            aria-expanded={section === s.id && panelOpen}
          >
            <span className="ds-rail-icon">
              <SectionGlyph d={s.icon} />
            </span>
            <span className="ds-rail-text">
              <span className="ds-rail-label">{s.label}</span>
              <span className="ds-rail-note">{s.note}</span>
            </span>
          </button>
        ))}

        <div className="ds-rail-foot">
          <button type="button" className="ds-btn ds-btn-quiet ds-rail-back" onClick={onBack}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m15 18-6-6 6-6" />
            </svg>
            <span>All themes</span>
          </button>
        </div>
      </nav>

      {/* ---------------- controls: folds away ---------------- */}
      <div className="ds-panel" aria-hidden={!panelOpen}>
        <header className="ds-panel-head">
          <div className="ds-panel-headings">
            <h2 className="ds-panel-title">{current.label}</h2>
            <p className="ds-panel-sub">
              Editing <b>{theme.name}</b>
            </p>
          </div>
          <button type="button" className="ds-btn ds-btn-quiet" onClick={onRename}>
            Rename
          </button>
          <button
            type="button"
            className="ds-fold"
            onClick={() => setPanelOpen(false)}
            aria-label="Hide these settings"
            title="Hide these settings"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
        </header>

        <div className="ds-panel-body">
          {section === "logo" && (
            <Group
              title="Brand mark"
              note="Floats in the top-left corner, over the background picture rather than above it, so it takes no room from the questions. The same corner on a phone."
            >
              <Row label="Logo" hint="Kept in this browser while you design" stack>
                <ImagePicker
                  value={theme.logo.src}
                  onChange={(src) => set("logo", { src })}
                  label="Form logo"
                  cta="Add logo"
                />
              </Row>
              <Row label="Show the logo">
                <Switch
                  checked={theme.logo.show !== false}
                  onChange={(show) => set("logo", { show })}
                  label="Show the logo"
                />
              </Row>
              <Row label="Size">
                <Segmented
                  options={LOGO_SIZES}
                  value={theme.logo.size}
                  onChange={(size) => set("logo", { size })}
                  label="Logo size"
                />
              </Row>
            </Group>
          )}

          {section === "logo" && (
            <Group
              title="Logo and name strip"
              note="The logo and the form's name travel together. Switch off what you do not want people to see."
            >
              <Row label="Position" hint="Which end of the form it sits at">
                <Segmented
                  options={HEADER_PLACES}
                  value={theme.header.place}
                  onChange={(place) => set("header", { place })}
                  label="Strip position"
                />
              </Row>
              <Row label="Form name">
                <Switch
                  checked={theme.header.showName}
                  onChange={(showName) => set("header", { showName })}
                  label="Show the form name"
                />
              </Row>
              <Row label="Page count" hint="“1 / 4” on the right">
                <Switch
                  checked={theme.header.showCount}
                  onChange={(showCount) => set("header", { showCount })}
                  label="Show the page count"
                />
              </Row>
            </Group>
          )}

          {section === "font" && (
            <>
              <Group title="Font" note="One family carries the whole form. Every Google font is here: type to search.">
                <Row label="Family" stack>
                  {/* The react-fontpicker-ts package: the whole Google Fonts
                      catalogue, searchable, each name drawn in its own face.
                      It loads the chosen font as well. */}
                  <div
                    className="ds-fontpicker"
                    onKeyDown={(e) => {
                      /* Escape leaves the search box; it must not also
                         close the whole Design section behind it. */
                      if (e.key !== "Escape") return;
                      e.stopPropagation();
                      e.nativeEvent.stopImmediatePropagation?.();
                      e.target.blur?.();
                    }}
                  >
                    <FontPicker
                      key={theme.id}
                      autoLoad
                      defaultValue={fontName(theme.font.family)}
                      value={(family) => {
                        if (family && family !== fontName(theme.font.family)) set("font", { family });
                      }}
                      noMatches="No font by that name"
                      inputId="ds-font-family"
                    />
                  </div>
                </Row>
              </Group>

              <Group title="Colour">
                <Row label="Titles" hint="Welcome screen and endings">
                  <ColourControl
                    value={theme.font.titleColour}
                    onChange={(titleColour) => set("font", { titleColour })}
                    label="Title colour"
                  />
                </Row>
                <Row label="Questions">
                  <ColourControl
                    value={theme.font.questionColour}
                    onChange={(questionColour) => set("font", { questionColour })}
                    label="Question colour"
                  />
                </Row>
                <Row label="Descriptions" hint="The small text under a question">
                  <ColourControl
                    value={theme.font.helpColour}
                    onChange={(helpColour) => set("font", { helpColour })}
                    label="Description colour"
                  />
                </Row>
                <Row label="Answers" hint="What people type and the choices they pick">
                  <ColourControl
                    value={theme.font.answerColour}
                    onChange={(answerColour) => set("font", { answerColour })}
                    label="Answer colour"
                  />
                </Row>
              </Group>

              <Group title="Size and alignment">
                <Row label="Text size" hint="The size questions are set in">
                  <SliderControl
                    value={fontSizePx(theme.font)}
                    onChange={(sizePx) => set("font", { sizePx })}
                    min={MIN_PX}
                    max={MAX_PX}
                    unit="px"
                    label="Text size in pixels"
                  />
                </Row>
                <Row label="Welcome screen and endings">
                  <Segmented
                    options={ALIGN_ICONS}
                    value={theme.font.alignWelcome}
                    onChange={(alignWelcome) => set("font", { alignWelcome })}
                    label="Welcome alignment"
                  />
                </Row>
                <Row label="Questions">
                  <Segmented
                    options={ALIGN_ICONS}
                    value={theme.font.alignQuestions}
                    onChange={(alignQuestions) => set("font", { alignQuestions })}
                    label="Question alignment"
                  />
                </Row>
              </Group>
            </>
          )}

          {section === "buttons" && (
            <>
              <Group title="Colour">
                <Row label="Button">
                  <ColourControl
                    value={theme.buttons.fill}
                    onChange={(fill) => set("buttons", { fill })}
                    label="Button colour"
                  />
                </Row>
                <Row label="Button text">
                  <ColourControl
                    value={theme.buttons.text}
                    onChange={(text) => set("buttons", { text })}
                    label="Button text colour"
                  />
                </Row>
                <Row label="Input" hint="Answer fields and the choice someone picks">
                  <ColourControl
                    value={theme.card.inputColour}
                    onChange={(inputColour) => set("card", { inputColour })}
                    label="Input colour"
                  />
                </Row>
              </Group>

              <Group title="Hover" note="What the button turns into under the pointer. Leave a colour empty to keep the one above.">
                <Row label="Hover background">
                  <ColourControl
                    value={theme.buttons.hoverFill || theme.buttons.fill}
                    onChange={(hoverFill) => set("buttons", { hoverFill })}
                    label="Button hover background"
                  />
                </Row>
                <Row label="Hover text">
                  <ColourControl
                    value={theme.buttons.hoverText || theme.buttons.text}
                    onChange={(hoverText) => set("buttons", { hoverText })}
                    label="Button hover text colour"
                  />
                </Row>
                <Row label="Back to default" hint="Forget both hover colours">
                  <button
                    type="button"
                    className="ds-btn ds-btn-quiet"
                    onClick={() => set("buttons", { hoverFill: "", hoverText: "" })}
                  >
                    Reset
                  </button>
                </Row>
              </Group>

              <Group title="Shape">
                <Row label="Style" stack>
                  <OptionCards
                    options={BUTTON_STYLES}
                    value={theme.buttons.style}
                    onChange={(style) => set("buttons", { style })}
                    label="Button style"
                    columns={3}
                  />
                </Row>
                <Row label="Corner radius" hint="0 is a square edge, 32 is a pill">
                  <SliderControl
                    value={theme.buttons.radius}
                    onChange={(radius) => set("buttons", { radius })}
                    min={0}
                    max={32}
                    unit="px"
                    label="Button corner radius"
                  />
                </Row>
                <Row label="Width">
                  <Segmented
                    options={BUTTON_WIDTHS}
                    value={theme.buttons.width}
                    onChange={(width) => set("buttons", { width })}
                    label="Button width"
                  />
                </Row>
              </Group>
            </>
          )}

          {section === "background" && (
            <>
              <Group title="Colour">
                <Row label="Background">
                  <ColourControl
                    value={theme.background.colour}
                    onChange={(colour) => set("background", { colour })}
                    label="Background colour"
                  />
                </Row>
              </Group>

              <Group title="Image or video" note="One picture or a short clip, laid out around the questions.">
                <Row label="File" hint="PNG, JPG, SVG or MP4" stack>
                  <ImagePicker
                    value={theme.background.image}
                    onChange={(image) => set("background", { image })}
                    label="Background image or video"
                    cta="Add image or video"
                    accept="image/*,video/*"
                    hint="Drop a file here, or choose one"
                  />
                </Row>
              </Group>

              <Group title="Layout" note="Where it sits next to the questions.">
                <Row label="Mobile" hint="Narrow screens">
                  <LayoutPicker
                    options={MOBILE_LAYOUTS}
                    value={theme.background.mobile}
                    onChange={(mobile) => {
                      set("background", { mobile });
                      setDevice("mobile");
                    }}
                    label="Layout on a phone"
                    mobile
                  />
                </Row>
                <Row label="Desktop" hint="Wide screens">
                  <LayoutPicker
                    options={DESKTOP_LAYOUTS}
                    value={theme.background.desktop}
                    onChange={(desktop) => {
                      set("background", { desktop });
                      setDevice("desktop");
                    }}
                    label="Layout on a wide screen"
                  />
                </Row>
              </Group>

              <Group
                title="Focal point"
                note="The part that must stay in view when the picture is cropped. Drag the ring, or nudge it with the arrow keys."
              >
                <FocalPicker
                  src={theme.background.image}
                  x={theme.background.focalX}
                  y={theme.background.focalY}
                  onChange={(focalX, focalY) => set("background", { focalX, focalY })}
                />
                {theme.background.image && (
                  <div className="ds-focal-foot">
                    <span className="ds-focal-read">
                      {Math.round(theme.background.focalX)}% across ·{" "}
                      {Math.round(theme.background.focalY)}% down
                    </span>
                    <button
                      type="button"
                      className="ds-btn ds-btn-quiet"
                      onClick={() => set("background", { focalX: 50, focalY: 50 })}
                    >
                      Reset
                    </button>
                  </div>
                )}
              </Group>

              <Group title="Finish" note="Keep the questions readable over a busy picture.">
                <Row label="Brightness">
                  <SliderControl
                    value={theme.background.brightness}
                    onChange={(brightness) => set("background", { brightness })}
                    min={20}
                    max={150}
                    unit="%"
                    label="Picture brightness"
                  />
                </Row>
                <Row label="Blur">
                  <SliderControl
                    value={theme.background.blur}
                    onChange={(blur) => set("background", { blur })}
                    min={0}
                    max={20}
                    unit="px"
                    label="Picture blur"
                  />
                </Row>
                <Row label="Overlay" hint="A dark wash over the picture">
                  <SliderControl
                    value={theme.background.overlay}
                    onChange={(overlay) => set("background", { overlay })}
                    min={0}
                    max={80}
                    unit="%"
                    label="Picture overlay"
                  />
                </Row>
              </Group>
            </>
          )}

          {section === "border" && (
            <>
              <Group title="Answer fields" note="How an empty answer reads before anyone types.">
                <Row label="Field style" stack>
                  <OptionCards
                    options={FIELD_STYLES}
                    value={theme.card.fieldStyle}
                    onChange={(fieldStyle) => set("card", { fieldStyle })}
                    label="Field style"
                    columns={3}
                  />
                </Row>
              </Group>

              <Group title="Border">
                <Row label="Line">
                  <Segmented
                    options={BORDER_STYLES}
                    value={theme.card.borderStyle}
                    onChange={(borderStyle) => set("card", { borderStyle })}
                    label="Border style"
                  />
                </Row>
                <Row label="Thickness">
                  <SliderControl
                    value={theme.card.borderWidth}
                    onChange={(borderWidth) => set("card", { borderWidth })}
                    min={1}
                    max={4}
                    unit="px"
                    label="Border thickness"
                  />
                </Row>
                <Row label="Border colour">
                  <ColourControl
                    value={theme.card.borderColour}
                    onChange={(borderColour) => set("card", { borderColour })}
                    label="Border colour"
                  />
                </Row>
                <Row label="Corner radius">
                  <SliderControl
                    value={theme.card.radius}
                    onChange={(radius) => set("card", { radius })}
                    min={0}
                    max={28}
                    unit="px"
                    label="Field corner radius"
                  />
                </Row>
              </Group>

              <Group title="Depth">
                <Row label="Shadow" stack>
                  <OptionCards
                    options={SHADOWS}
                    value={theme.card.shadow}
                    onChange={(shadow) => set("card", { shadow })}
                    label="Shadow"
                    columns={4}
                  />
                </Row>
              </Group>
            </>
          )}

          {section === "loading" && (
            <>
              <Group
                title="Before the first question"
                note="A few seconds of your logo while the form gets ready. It needs a logo, and anyone who has asked their device to reduce motion skips straight in."
              >
                <Row label="Show a loading screen">
                  <Switch
                    checked={theme.loading.enabled}
                    onChange={(enabled) => set("loading", { enabled })}
                    label="Show a loading screen"
                  />
                </Row>
                <Row label="How long" hint="Seconds before question 1">
                  <SliderControl
                    value={theme.loading.seconds}
                    onChange={(seconds) => set("loading", { seconds })}
                    min={MIN_WAIT}
                    max={MAX_WAIT}
                    unit="s"
                    label="Seconds to wait"
                  />
                </Row>
                {!theme.logo.src && (
                  <p className="ds-foot-note">
                    Add a logo in the Logo section and it appears here.
                  </p>
                )}
              </Group>

              <Group title="Animation" note="Move the logo itself, or play a spinner under it.">
                <Row label="Animation" stack>
                  <SelectControl
                    options={LOADING_ANIMATIONS}
                    value={theme.loading.animation}
                    onChange={(animation) => set("loading", { animation })}
                    label="Loading animation"
                    width={286}
                  />
                </Row>
                <Row label="Background" hint="Empty follows the form's own">
                  <ColourControl
                    value={theme.loading.background || theme.background.colour}
                    onChange={(background) => set("loading", { background })}
                    label="Loading background"
                  />
                </Row>
              </Group>

              <Group title="Words">
                <Row label="Show a line of text">
                  <Switch
                    checked={theme.loading.showText}
                    onChange={(showText) => set("loading", { showText })}
                    label="Show a line of text"
                  />
                </Row>
                {theme.loading.showText && (
                  <Row label="Text" stack>
                    <input
                      className="ds-hex ds-text-input"
                      value={theme.loading.text}
                      maxLength={60}
                      onChange={(e) => set("loading", { text: e.target.value })}
                      aria-label="Loading text"
                    />
                  </Row>
                )}
              </Group>

              <Group title="How it looks">
                <LoadingScreen theme={theme} preview />
              </Group>
            </>
          )}

          {section === "motion" && (
            <>
              <Group title="Entrance" note="How each question arrives as someone moves through the form.">
                <Row label="Animation" hint={`${ANIMATIONS.length - 1} to choose from`} stack>
                  <SelectControl
                    options={ANIMATIONS}
                    value={animationId(theme.motion.animation)}
                    onChange={(animation) => set("motion", { animation })}
                    label="Entrance animation"
                    width={286}
                  />
                </Row>
                <Row label="Speed">
                  <Segmented
                    options={SPEEDS}
                    value={theme.motion.speed}
                    onChange={(speed) => set("motion", { speed })}
                    label="Animation speed"
                  />
                </Row>
                <Row label="Play it again" hint="Runs the entrance in the preview">
                  <button type="button" className="ds-btn ds-btn-quiet" onClick={() => setReplay((n) => n + 1)}>
                    Replay
                  </button>
                </Row>
              </Group>

              <Group title="Hover" note="What the button does when a pointer rests on it.">
                <Row label="Button hover">
                  <Segmented
                    options={HOVERS}
                    value={theme.motion.hover}
                    onChange={(hover) => set("motion", { hover })}
                    label="Button hover"
                    grow
                  />
                </Row>
              </Group>

              <p className="ds-foot-note">
                Anyone who has asked their device to reduce motion sees the form without these
                animations.
              </p>
            </>
          )}
        </div>
      </div>

      {/* ---------------- live preview ---------------- */}
      <div className="ds-preview">
        <div className="ds-preview-bar">
          {!panelOpen && (
            <button
              type="button"
              className="ds-unfold"
              onClick={() => setPanelOpen(true)}
              aria-label="Show the settings"
              title={`Show ${current.label} settings`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m9 18 6-6-6-6" />
              </svg>
              {current.label}
            </button>
          )}

          <span className="ds-preview-title" style={{ fontFamily: fontStack(theme.font.family) }}>
            {theme.name}
          </span>

          <div className="ds-devices" role="group" aria-label="Preview size">
            {["desktop", "mobile"].map((d) => (
              <button
                key={d}
                type="button"
                className={device === d ? "ds-dev is-on" : "ds-dev"}
                aria-pressed={device === d}
                onClick={() => setDevice(d)}
              >
                {d === "desktop" ? "Desktop" : "Mobile"}
              </button>
            ))}
          </div>
        </div>

        <div className="ds-preview-stage">
          <ThemeCanvas theme={theme} device={device} replay={replay} />
        </div>
      </div>
    </div>
  );
}