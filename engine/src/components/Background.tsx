import React from "react";
import { AbsoluteFill, Img, OffthreadVideo, useCurrentFrame, useVideoConfig } from "remotion";
import { useAsset } from "./RichText";
import { H, useStyle, W } from "../style";

/** The canvas behind graphics. "blur" uses a dark, blurred copy of your own video. */
export const Background: React.FC<{ video: string }> = ({ video }) => {
  const s = useStyle();
  const frame = useCurrentFrame();
  const { background: bg, background2: bg2 } = s.colors;
  if (s.background === "blur") {
    return (
      <AbsoluteFill style={{ background: "#000" }}>
        <OffthreadVideo src={video} muted style={{ width: W, height: H, filter: "blur(38px) brightness(0.42) saturate(1.2)", transform: "scale(1.15)" }} />
      </AbsoluteFill>
    );
  }
  if (s.background === "gradient") {
    return <AbsoluteFill style={{ background: `linear-gradient(165deg, ${bg} 0%, ${bg2} 100%)` }} />;
  }
  if (s.background === "dots" || s.background === "grid") {
    const step = s.background === "dots" ? 44 : 72;
    const drift = (frame * 0.4) % step; // a slow drift so the background is never frozen
    const pattern =
      s.background === "dots"
        ? `radial-gradient(${bg2} 2.6px, transparent 2.8px)`
        : `linear-gradient(${bg2} 2px, transparent 2px), linear-gradient(90deg, ${bg2} 2px, transparent 2px)`;
    return (
      <AbsoluteFill style={{ background: bg, overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: -step, backgroundImage: pattern, backgroundSize: `${step}px ${step}px`, transform: `translate(${drift}px, ${drift}px)` }} />
      </AbsoluteFill>
    );
  }
  return <AbsoluteFill style={{ background: bg }} />;
};

/** Behind a zoomed-out (inset) video: a solid colour ("#hex"), or an image/video from assets/ that slowly pushes in. */
export const InsetBackground: React.FC<{ bg?: string; t0: number; dur: number }> = ({ bg, t0, dur }) => {
  const s = useStyle();
  const frame = useCurrentFrame();
  const asset = useAsset();
  const { fps } = useVideoConfig();
  const v = bg || s.colors.background;
  if (/^(#|rgb|hsl)/i.test(v)) return <AbsoluteFill style={{ background: v }} />;
  const p = Math.min(1, Math.max(0, (frame / fps - t0) / Math.max(0.1, dur)));
  const media: React.CSSProperties = { width: W, height: H, objectFit: "cover", transform: `scale(${1.04 + 0.04 * p})` };
  return (
    <AbsoluteFill style={{ background: s.colors.background, overflow: "hidden" }}>
      {/\.(mp4|mov|webm|m4v)$/i.test(v) ? <OffthreadVideo src={asset(v)} muted style={media} /> : <Img src={asset(v)} style={media} />}
    </AbsoluteFill>
  );
};
