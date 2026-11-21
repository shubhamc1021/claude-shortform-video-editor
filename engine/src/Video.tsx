import React, { useMemo } from "react";
import { AbsoluteFill, Audio, OffthreadVideo, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Background, InsetBackground } from "./components/Background";
import { Captions } from "./components/Captions";
import { Arrive, FitBox } from "./components/Motion";
import { PanelView } from "./components/panels";
import { AssetsContext, SurfaceContext, useAsset } from "./components/RichText";
import { H, mergeStyle, SAFE, springFor, StyleContext, useFonts, W } from "./style";
import type { Beat, Enter, Layout, Props, Style } from "./types";

const SFX = new Set(["whoosh", "pop", "chime"]);

/** The sound a beat plays, if any: its own `sfx`, or (with style.sfx.auto) a whoosh on a zoom-out and a chime on a full-screen card. */
export const sfxFor = (b: Beat, prev: Beat | undefined, s: Style): string | null => {
  if (b.sfx === false) return null;
  if (typeof b.sfx === "string" && b.sfx) return b.sfx;
  if (!s.sfx?.auto) return null;
  const joined = prev && prev.layout === b.layout && Math.abs(prev.e - b.s) < 0.05; // same layout continuing: no new sound
  if (b.layout === "inset" && !joined) return "whoosh";
  if (b.layout === "full" && !joined) return "chime";
  return null;
};

/** Size and position of the zoomed-out video card. With a panel, the card is smaller and sits high so the panel fits below. */
const insetBox = (s: Style, withPanel: boolean) => {
  const k = (s.inset?.scale ?? 0.62) * (withPanel ? 0.82 : 1);
  const h = H * k;
  const centerY = withPanel ? SAFE.top + h / 2 : 880;
  return { k, centerY, top: centerY - h / 2, bottom: centerY + h / 2 };
};

const ENTERS: Enter[] = ["up", "left", "pop", "right", "down"];

/** Where the graphic goes for each layout (x is always the safe column). */
const areaFor = (layout: Layout, splitY: number, fill: boolean) => {
  if (fill) return layout === "split" ? { top: 0, height: splitY, width: W, left: 0 } : { top: 0, height: H, width: W, left: 0 };
  const left = SAFE.left;
  const width = SAFE.right - SAFE.left;
  if (layout === "split") return { top: SAFE.top, height: splitY - SAFE.top - 70, width, left };
  if (layout === "overlay") return { top: SAFE.top, height: 680, width: width - 40, left: left + 20 };
  return { top: SAFE.top, height: 1170, width, left }; // full
};

const captionY = (layout: Layout, splitY: number) => (layout === "split" ? splitY : layout === "full" ? 1440 : 1250);

/** The colour a beat's panel text sits on, so accent words pick a readable colour. */
const surfaceFor = (b: Beat, s: Style) => {
  if (b.layout === "inset") return b.bg && /^#/.test(b.bg) ? b.bg : b.bg ? "#202020" : s.colors.background;
  if (b.layout === "overlay" || s.background === "blur") return "#202020"; // over video
  return s.colors.background;
};

const SfxTrack: React.FC<{ beats: Beat[]; style: Style }> = ({ beats, style }) => {
  const { fps } = useVideoConfig();
  const asset = useAsset();
  return (
    <>
      {beats.map((b, i) => {
        const name = sfxFor(b, beats[i - 1], style);
        if (!name) return null;
        const src = SFX.has(name) ? staticFile(`sfx/${name}.wav`) : asset(name);
        return (
          <Sequence key={`sfx${i}`} from={Math.max(0, Math.round((b.sfxAt ?? b.s) * fps))} layout="none" name={`sfx ${i + 1}: ${name}`}>
            <Audio src={src} volume={style.sfx?.volume ?? 0.35} />
          </Sequence>
        );
      })}
    </>
  );
};

export const Main: React.FC<Props & { assets: string }> = (props) => {
  const style = useMemo(() => mergeStyle(props.style), [props.style]);
  useFonts(style);
  return (
    <StyleContext.Provider value={style}>
      <AssetsContext.Provider value={props.assets}>
        <SurfaceContext.Provider value={style.background === "blur" ? "#202020" : style.colors.background}>
          <Edit {...props} style={style} />
        </SurfaceContext.Provider>
      </AssetsContext.Provider>
    </StyleContext.Provider>
  );
};

const Edit: React.FC<Props & { assets: string }> = ({ video, words, beats, style, faceCenter = 0.42, keywords }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const src = /^https?:/.test(video) ? video : staticFile(video);
  const splitY = Math.round(H * Math.min(0.62, Math.max(0.38, style.split)));

  const idx = beats.findIndex((b) => t >= b.s && t < b.e);
  const beat: Beat | undefined = beats[idx];
  const layout: Layout = beat?.layout ?? "face";

  // automatic reframing: face/split beats alternate wide and punched-in, so your face "cuts" too
  const zoom = layout === "inset" ? 1 : beat?.zoom ?? ((layout === "face" || layout === "split") && idx % 2 === 1 ? style.punchIn : 1);

  // zoom-out: the whole frame shrinks into a card (animated in, unless the beat before was already zoomed out)
  const ib = beat && layout === "inset" ? insetBox(style, !!beat.panel) : null;
  let insetCss: React.CSSProperties = {};
  if (beat && ib) {
    const prev = beats[idx - 1];
    const prevIb = prev && prev.layout === "inset" && Math.abs(prev.e - beat.s) < 0.05 ? insetBox(style, !!prev.panel) : null;
    const p = spring({ frame: frame - Math.round(beat.s * fps), fps, config: springFor(style), durationInFrames: 14 });
    const from = prevIb ?? { k: 1, centerY: H / 2 };
    const k = from.k + (ib.k - from.k) * p;
    const cy = from.centerY + (ib.centerY - from.centerY) * p;
    const frameW = style.inset?.frame === "none" ? 0 : 16;
    insetCss = {
      transform: `translateY(${cy - H / 2}px) scale(${k})`, transformOrigin: "50% 50%", borderRadius: 34 / k,
      boxShadow: `${frameW ? `0 0 0 ${frameW / k}px ${style.colors.surface}, ` : ""}0 ${30 / k}px ${80 / k}px rgba(0,0,0,0.22)`,
    };
  }
  const faceY = faceCenter * H;
  const videoBox: React.CSSProperties =
    layout === "inset" ? { top: 0, height: H, ...insetCss } : layout === "split" ? { top: splitY, height: H - splitY } : layout === "full" ? { top: 0, height: H, opacity: 0 } : { top: 0, height: H };
  // in split, slide the frame up so your face sits ~40% down the bottom box
  const offset = layout === "split" ? Math.min(0, Math.round(0.4 * (H - splitY) - faceY)) : 0;

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {(layout === "split" || layout === "full") && <Background video={src} />}
      {layout === "inset" && beat && <InsetBackground bg={beat.bg} t0={beat.s} dur={beat.e - beat.s} />}

      {/* one video element for the whole edit, so the audio never stops; layouts only move it */}
      <div style={{ position: "absolute", left: 0, width: W, overflow: "hidden", ...videoBox }}>
        <div style={{ position: "absolute", left: 0, top: offset, width: W, height: H, transform: `scale(${zoom})`, transformOrigin: `50% ${faceCenter * 100}%` }}>
          <OffthreadVideo src={src} style={{ width: W, height: H }} />
        </div>
      </div>

      {beats.map((b, i) => {
        if (!b.panel) return null;
        // on a fresh zoom-out, let the card finish shrinking before the panel arrives below it
        const prevB = beats[i - 1];
        const settling = b.layout === "inset" && !(prevB && prevB.layout === "inset" && Math.abs(prevB.e - b.s) < 0.05) ? 9 : 0;
        const from = Math.round(b.s * fps) + settling;
        const dur = Math.max(1, Math.round(b.e * fps) - from);
        const fill = b.panel.type === "media" && !!b.panel.fill;
        const ibx = b.layout === "inset" ? insetBox(style, true) : null;
        const area = ibx
          ? { top: Math.round(ibx.bottom + 50), height: Math.max(160, SAFE.bottom - Math.round(ibx.bottom + 50)), width: SAFE.right - SAFE.left, left: SAFE.left }
          : areaFor(b.layout, splitY, fill);
        const enter: Enter = fill ? "fade" : b.enter ?? (style.motion.energy === "calm" ? "fade" : ENTERS[i % ENTERS.length]);
        // panels lay out a little narrower than the area: the entrance pop + slow push-in grow them ~4%
        const inner = fill ? area.width : Math.round(area.width * 0.94);
        const ctx = { t0: b.s, dur: b.e - b.s, width: inner, full: b.layout === "full", overlay: b.layout === "overlay" };
        return (
          <Sequence key={i} from={from} durationInFrames={dur} layout="none" name={`beat ${i + 1}: ${b.panel.type}`}>
            <SurfaceContext.Provider value={surfaceFor(b, style)}>
            <div style={{ position: "absolute", ...area, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Arrive enter={enter} dur={dur}>
                {fill ? (
                  <div style={{ width: area.width, height: area.height }}>
                    <PanelView panel={b.panel} ctx={ctx} areaH={area.height} />
                  </div>
                ) : (
                  <FitBox width={inner} height={Math.round(area.height * 0.96)}>
                    <PanelView panel={b.panel} ctx={ctx} areaH={area.height} />
                  </FitBox>
                )}
              </Arrive>
            </div>
            </SurfaceContext.Provider>
          </Sequence>
        );
      })}

      {beat?.captions !== false && (
        <Captions words={words} keywords={keywords} y={ib ? Math.round(ib.centerY + (ib.bottom - ib.top) * 0.22) : captionY(layout, splitY)} />
      )}
      <SfxTrack beats={beats} style={style} />
    </AbsoluteFill>
  );
};
