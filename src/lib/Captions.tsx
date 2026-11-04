import { COLORS, FONTS, PHASE_COLORS } from "./theme";

/** Burned-in caption band: phase chip plus the beat's caption text. */
export const Captions: React.FC<{ phase: string; text: string; top: number }> = ({ phase, text, top }) => {
  const color = PHASE_COLORS[phase] ?? COLORS.muted;
  return (
    <div
      style={{
        position: "absolute",
        left: 120,
        right: 120,
        top,
        bottom: 0,
        display: "flex",
        alignItems: "center",
        gap: 24,
      }}
    >
      <span
        style={{
          flex: "none",
          fontFamily: FONTS.mono,
          fontSize: 18,
          letterSpacing: "0.08em",
          color,
          border: `1.5px solid ${color}`,
          borderRadius: 4,
          padding: "4px 10px",
        }}
      >
        {phase}
      </span>
      <p style={{ margin: 0, fontFamily: FONTS.body, fontSize: 28, lineHeight: 1.3, color: COLORS.ink }}>{text}</p>
    </div>
  );
};
