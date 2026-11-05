import { COLORS, FONTS, PHASE_COLORS } from "../theme";

/** Subtitle band: small colored phase label above centered white caption text. */
export const Captions: React.FC<{ phase: string; text: string; top: number }> = ({ phase, text, top }) => (
  <div
    style={{
      position: "absolute",
      left: 160,
      right: 160,
      top,
      bottom: 0,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      textAlign: "center",
    }}
  >
    <span style={{ fontFamily: FONTS.body, fontSize: 18, letterSpacing: "0.14em", color: PHASE_COLORS[phase] ?? COLORS.muted }}>
      {phase}
    </span>
    <p style={{ margin: 0, fontFamily: FONTS.body, fontSize: 29, lineHeight: 1.3, color: COLORS.ink }}>{text}</p>
  </div>
);
