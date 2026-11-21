// The shape of an edit. Claude writes projects/<slug>/edit.json in this shape;
// tools/build_props.mjs merges it with words.json + my-style/style.json into the render props.

export type Word = { text: string; s: number; e: number };

/** Where things sit on screen for one beat. */
export type Layout =
  | "face" // just you, full screen (optionally punched in)
  | "split" // graphic on top, you on the bottom
  | "full" // graphic fills the screen, your voice keeps going
  | "overlay" // you full screen with a graphic card floating in the top half
  | "inset"; // zoom-out: your video shrinks into a framed card on a colour or image background (beat.bg)

export type Enter = "up" | "down" | "left" | "right" | "pop" | "fade" | "none";

/** One item that appears on cue (list rows, logos, chat bubbles). `at` = seconds on the cut timeline. */
export type Cue = { at?: number };

export type Panel =
  | { type: "title"; text: string; sub?: string; size?: number; align?: "center" | "left"; card?: boolean }
  | { type: "stat"; value: string; label?: string; countUp?: boolean }
  | { type: "list"; title?: string; items: (string | ({ text: string } & Cue))[]; marker?: "check" | "number" | "bullet" | "x"; at?: number[] }
  | {
      type: "media";
      src: string; // file in projects/<slug>/assets/
      frame?: "card" | "browser" | "phone" | "none";
      url?: string; // text in the browser bar
      fill?: boolean; // cover the whole layout area (B-roll)
      focus?: { x: number; y: number; w: number; h: number; at?: number }; // 0-1 box on the image to circle/zoom
      zoom?: boolean; // zoom into `focus` instead of just marking it
      caption?: string;
    }
  | { type: "logos"; items: { src: string; label?: string; at?: number }[]; title?: string }
  | { type: "compare"; left: { title: string; items?: string[] }; right: { title: string; items?: string[] }; at?: number }
  | { type: "chat"; messages: { from: "me" | "them"; text: string; at?: number; name?: string }[]; app?: string }
  | { type: "typing"; text: string; label?: string; variant?: "prompt" | "search" | "terminal"; result?: string; resultAt?: number }
  | { type: "icon"; emoji?: string; src?: string; label?: string }
  | { type: "quote"; text: string; author?: string };

export type Beat = {
  s: number; // start, seconds on the cut timeline (start on the word that names the thing)
  e: number; // end
  layout: Layout;
  panel?: Panel;
  zoom?: number; // face punch-in (1 = none). Face/split beats alternate automatically if unset
  enter?: Enter; // how the graphic arrives (cycles automatically if unset)
  captions?: boolean; // false hides captions for this beat
  bgTone?: string; // set by build_props: average colour of an image bg, so text on it picks a readable colour
  bg?: string; // inset only: "#hex" colour or an image/video in assets/ (e.g. an outfit-matched Pinterest pick)
  sfx?: SfxName | string | false; // sound at the start of the beat: built-in name or a file in assets/; false = none
  sfxAt?: number; // play the sound at this time (cut timeline) instead of the beat start
  note?: string; // why this beat exists (shown in the storyboard)
};

/** Built-in sound effects (engine/sfx/). */
export type SfxName = "whoosh" | "pop" | "chime";

export type Edit = {
  video: string; // staticFile path of the cut
  duration: number;
  faceCenter?: number; // where the face centre sits in the frame, 0 (top) - 1 (bottom)
  words: Word[];
  beats: Beat[];
  keywords?: string[]; // words/phrases shown in the accent font + colour in captions ("self-worth", "attachment style")
};

export type CaptionStyle = "pill" | "plain" | "outline" | "box" | "highlight" | "none";

export type Style = {
  name: string;
  colors: {
    background: string;
    background2: string; // second colour for gradients / patterns
    surface: string; // cards
    ink: string; // main text
    muted: string; // secondary text
    accent: string; // highlights, marks, active caption word
    accent2: string;
    captionText: string;
    captionBg: string;
    captionAccent?: string; // keyword colour in captions over video (defaults to accent)
  };
  fonts: {
    heading: string; body: string; caption: string; headingWeight: number; bodyWeight: number; captionWeight: number;
    accent?: string; // font for *emphasis* and caption keywords (e.g. "Fraunces"); empty = same font, accent colour only
    accentWeight?: number;
    accentItalic?: boolean;
  };
  background: "solid" | "gradient" | "dots" | "grid" | "blur";
  captions: { style: CaptionStyle; uppercase: boolean; size: number; maxWords: number; maxChars: number };
  cards: { radius: number; shadow: "none" | "soft" | "hard"; border: boolean };
  motion: { energy: "calm" | "normal" | "punchy"; drift: boolean };
  marks: { style: "hand" | "clean"; color: string };
  split: number; // share of the screen the graphic gets in split layout (0.4 - 0.6)
  punchIn: number; // face zoom used for automatic reframes
  sfx?: { auto: boolean; volume: number }; // auto = soft whoosh on inset, chime on full; volume 0-1
  inset?: { scale: number; frame: "polaroid" | "none" }; // size of the zoomed-out video card, and its border
};

export type Props = Edit & { style: Style };
