export type MascotPose =
  | "wave"
  | "cheer"
  | "read"
  | "write"
  | "sleep"
  | "thinking";
export type MascotMood = "happy" | "closed" | "thinking";
export type MascotKind = "ferret" | "owl";

interface FerretProps {
  size?: number;
  pose?: MascotPose;
  mood?: MascotMood;
  accent?: string;
}

const Ferret = ({
  size = 120,
  pose = "wave",
  mood = "happy",
  accent,
}: FerretProps) => {
  const teal = "var(--teal)";
  const rust = "var(--rust)";
  const ink = "var(--ink)";
  const cream = "var(--paper-2)";
  const accentColor = accent || rust;

  const eyes =
    mood === "closed" ? (
      <>
        <path
          d="M40 50 Q44 47 48 50"
          stroke={ink}
          strokeWidth={2.2}
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M58 50 Q62 47 66 50"
          stroke={ink}
          strokeWidth={2.2}
          fill="none"
          strokeLinecap="round"
        />
      </>
    ) : (
      <>
        <ellipse cx={44} cy={50} rx={2.6} ry={3.4} fill={ink} />
        <ellipse cx={62} cy={50} rx={2.6} ry={3.4} fill={ink} />
        <circle cx={44.7} cy={49} r={0.9} fill="#fff" />
        <circle cx={62.7} cy={49} r={0.9} fill="#fff" />
      </>
    );

  const mouth =
    mood === "thinking" ? (
      <path
        d="M48 60 Q53 62 58 60"
        stroke={ink}
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
      />
    ) : (
      <path
        d="M48 59 Q53 64 58 59"
        stroke={ink}
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
      />
    );

  return (
    <svg width={size} height={size} viewBox="0 0 106 106" aria-hidden="true">
      <path
        d="M82 78 Q98 72 96 56 Q94 44 84 44"
        fill={accentColor}
        stroke={ink}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <path
        d="M88 70 Q96 65 95 55"
        fill="none"
        stroke={ink}
        strokeWidth={1.5}
        strokeLinecap="round"
        opacity={0.5}
      />
      <ellipse
        cx={53}
        cy={74}
        rx={28}
        ry={22}
        fill={cream}
        stroke={ink}
        strokeWidth={2}
      />
      <ellipse cx={53} cy={80} rx={16} ry={11} fill="#fff" opacity={0.8} />
      <ellipse
        cx={42}
        cy={93}
        rx={6}
        ry={4}
        fill={accentColor}
        stroke={ink}
        strokeWidth={2}
      />
      <ellipse
        cx={64}
        cy={93}
        rx={6}
        ry={4}
        fill={accentColor}
        stroke={ink}
        strokeWidth={2}
      />

      {pose === "wave" && (
        <>
          <path
            d="M30 70 Q22 64 25 50"
            stroke={ink}
            strokeWidth={2}
            fill={cream}
            strokeLinejoin="round"
          />
          <circle
            cx={25}
            cy={48}
            r={4}
            fill={accentColor}
            stroke={ink}
            strokeWidth={2}
          />
          <path
            d="M76 70 Q84 70 84 78"
            stroke={ink}
            strokeWidth={2}
            fill={cream}
            strokeLinejoin="round"
          />
        </>
      )}
      {pose === "cheer" && (
        <>
          <path
            d="M30 70 Q20 56 26 42"
            stroke={ink}
            strokeWidth={2}
            fill={cream}
            strokeLinejoin="round"
          />
          <circle
            cx={26}
            cy={40}
            r={4.5}
            fill={accentColor}
            stroke={ink}
            strokeWidth={2}
          />
          <path
            d="M76 70 Q86 56 80 42"
            stroke={ink}
            strokeWidth={2}
            fill={cream}
            strokeLinejoin="round"
          />
          <circle
            cx={80}
            cy={40}
            r={4.5}
            fill={accentColor}
            stroke={ink}
            strokeWidth={2}
          />
        </>
      )}
      {pose === "read" && (
        <>
          <rect
            x={34}
            y={64}
            width={38}
            height={22}
            rx={2}
            fill={teal}
            stroke={ink}
            strokeWidth={2}
          />
          <path d="M53 64 V86" stroke={ink} strokeWidth={2} />
          <path
            d="M40 70 H48 M40 75 H48 M58 70 H66 M58 75 H66"
            stroke="#fff"
            strokeWidth={1.5}
            strokeLinecap="round"
          />
          <path
            d="M30 78 Q26 72 32 66"
            stroke={ink}
            strokeWidth={2}
            fill={cream}
          />
          <path
            d="M76 78 Q80 72 74 66"
            stroke={ink}
            strokeWidth={2}
            fill={cream}
          />
        </>
      )}
      {pose === "write" && (
        <>
          <rect
            x={64}
            y={50}
            width={4}
            height={22}
            rx={1}
            fill={accentColor}
            stroke={ink}
            strokeWidth={1.5}
            transform="rotate(-25 66 60)"
          />
          <path
            d="M30 76 Q22 70 28 60"
            stroke={ink}
            strokeWidth={2}
            fill={cream}
          />
          <path
            d="M76 70 Q72 64 70 56"
            stroke={ink}
            strokeWidth={2}
            fill={cream}
          />
        </>
      )}
      {pose === "sleep" && (
        <>
          <path
            d="M30 76 Q26 70 32 64"
            stroke={ink}
            strokeWidth={2}
            fill={cream}
          />
          <path
            d="M76 76 Q80 70 74 64"
            stroke={ink}
            strokeWidth={2}
            fill={cream}
          />
          <text
            x={76}
            y={36}
            fontFamily="var(--font-display)"
            fontSize={14}
            fontWeight={700}
            fill={ink}
          >
            z
          </text>
          <text
            x={84}
            y={28}
            fontFamily="var(--font-display)"
            fontSize={10}
            fontWeight={700}
            fill={ink}
          >
            z
          </text>
        </>
      )}
      {pose === "thinking" && (
        <>
          <path
            d="M30 70 Q26 60 30 52"
            stroke={ink}
            strokeWidth={2}
            fill={cream}
          />
          <path
            d="M76 68 Q80 60 76 52"
            stroke={ink}
            strokeWidth={2}
            fill={cream}
          />
        </>
      )}

      <ellipse
        cx={53}
        cy={48}
        rx={22}
        ry={20}
        fill={cream}
        stroke={ink}
        strokeWidth={2}
      />
      <path
        d="M36 48 Q53 42 70 48 Q66 56 53 56 Q40 56 36 48Z"
        fill={accentColor}
        opacity={0.85}
      />
      <ellipse
        cx={38}
        cy={32}
        rx={5}
        ry={6}
        fill={cream}
        stroke={ink}
        strokeWidth={2}
        transform="rotate(-15 38 32)"
      />
      <ellipse
        cx={38}
        cy={32}
        rx={2.2}
        ry={3}
        fill={accentColor}
        transform="rotate(-15 38 32)"
      />
      <ellipse
        cx={68}
        cy={32}
        rx={5}
        ry={6}
        fill={cream}
        stroke={ink}
        strokeWidth={2}
        transform="rotate(15 68 32)"
      />
      <ellipse
        cx={68}
        cy={32}
        rx={2.2}
        ry={3}
        fill={accentColor}
        transform="rotate(15 68 32)"
      />
      {eyes}
      <ellipse cx={53} cy={55} rx={2} ry={1.4} fill={ink} />
      {mouth}
      <circle cx={40} cy={56} r={2.4} fill={rust} opacity={0.35} />
      <circle cx={66} cy={56} r={2.4} fill={rust} opacity={0.35} />
    </svg>
  );
};

const Owl = ({
  size = 120,
  pose = "wave",
  mood = "happy",
}: {
  size?: number;
  pose?: MascotPose;
  mood?: MascotMood;
}) => {
  const teal = "var(--teal)";
  const rust = "var(--rust)";
  const ink = "var(--ink)";
  const cream = "var(--paper-2)";
  return (
    <svg width={size} height={size} viewBox="0 0 106 106" aria-hidden="true">
      <ellipse
        cx={53}
        cy={62}
        rx={32}
        ry={36}
        fill={teal}
        stroke={ink}
        strokeWidth={2}
      />
      <ellipse cx={53} cy={72} rx={20} ry={22} fill={cream} />
      <path
        d="M42 96 v6 M44 96 v6 M40 96 v6"
        stroke={rust}
        strokeWidth={2.2}
        strokeLinecap="round"
      />
      <path
        d="M62 96 v6 M64 96 v6 M66 96 v6"
        stroke={rust}
        strokeWidth={2.2}
        strokeLinecap="round"
      />
      {pose === "wave" && (
        <>
          <path
            d="M22 60 Q14 50 22 38"
            stroke={ink}
            strokeWidth={2}
            fill={teal}
          />
          <path
            d="M84 60 Q92 70 84 80"
            stroke={ink}
            strokeWidth={2}
            fill={teal}
          />
        </>
      )}
      {pose === "cheer" && (
        <>
          <path
            d="M22 60 Q10 38 26 28"
            stroke={ink}
            strokeWidth={2}
            fill={teal}
          />
          <path
            d="M84 60 Q96 38 80 28"
            stroke={ink}
            strokeWidth={2}
            fill={teal}
          />
        </>
      )}
      {pose !== "wave" && pose !== "cheer" && (
        <>
          <path
            d="M22 60 Q16 70 22 84"
            stroke={ink}
            strokeWidth={2}
            fill={teal}
          />
          <path
            d="M84 60 Q90 70 84 84"
            stroke={ink}
            strokeWidth={2}
            fill={teal}
          />
        </>
      )}
      <circle
        cx={42}
        cy={44}
        r={11}
        fill={cream}
        stroke={ink}
        strokeWidth={2}
      />
      <circle
        cx={64}
        cy={44}
        r={11}
        fill={cream}
        stroke={ink}
        strokeWidth={2}
      />
      {mood === "closed" ? (
        <>
          <path
            d="M36 44 Q42 41 48 44"
            stroke={ink}
            strokeWidth={2}
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M58 44 Q64 41 70 44"
            stroke={ink}
            strokeWidth={2}
            fill="none"
            strokeLinecap="round"
          />
        </>
      ) : (
        <>
          <circle cx={42} cy={45} r={4.5} fill={ink} />
          <circle cx={64} cy={45} r={4.5} fill={ink} />
          <circle cx={43.5} cy={43.5} r={1.4} fill="#fff" />
          <circle cx={65.5} cy={43.5} r={1.4} fill="#fff" />
        </>
      )}
      <path
        d="M48 54 L53 60 L58 54 Z"
        fill={rust}
        stroke={ink}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <path
        d="M34 28 L36 36"
        stroke={ink}
        strokeWidth={2.5}
        strokeLinecap="round"
      />
      <path
        d="M72 28 L70 36"
        stroke={ink}
        strokeWidth={2.5}
        strokeLinecap="round"
      />
    </svg>
  );
};

export const BrandMark = ({
  size = 32,
  color = "currentColor",
}: {
  size?: number;
  color?: string;
}) => {
  const petals = [];
  for (let i = 0; i < 4; i++) {
    petals.push(
      <g transform={`rotate(${i * 90} 50 50)`} key={i}>
        <path
          d="M50 50 C 56 32 70 22 86 22 C 78 36 70 50 50 50 Z"
          fill={color}
        />
        <path
          d="M50 50 C 60 38 76 32 90 38 C 76 44 64 50 50 50 Z"
          fill={color}
          opacity={0.85}
        />
      </g>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      {petals}
    </svg>
  );
};

export interface MascotProps {
  size?: number;
  pose?: MascotPose;
  mood?: MascotMood;
  kind?: MascotKind;
}

export const Mascot = ({
  size = 120,
  pose = "wave",
  mood = "happy",
  kind = "ferret",
}: MascotProps) => {
  if (kind === "owl") return <Owl size={size} pose={pose} mood={mood} />;
  return <Ferret size={size} pose={pose} mood={mood} />;
};

export { Ferret, Owl };
