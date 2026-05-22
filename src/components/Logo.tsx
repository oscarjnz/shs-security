import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  /** Optional accent color override (defaults to currentColor / cyber-green). */
  accent?: string;
}

/**
 * Brand logo for S.S.S - Security Smart Services.
 * Inline SVG so it inherits color via currentColor and stays crisp at any size.
 */
export function Logo({ className, accent = "#00ff88" }: LogoProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      className={cn("h-10 w-10", className)}
      aria-label="Security Smart Services"
    >
      <path
        d="M32 4 L56 12 V30 C56 44 46 54 32 60 C18 54 8 44 8 30 V12 Z"
        fill="#0a1a14"
        stroke={accent}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path
        d="M50 16 V30 C50 41 42 49 32 54 C22 49 14 41 14 30 V16"
        fill="none"
        stroke={accent}
        strokeWidth="0.5"
        strokeOpacity="0.4"
      />
      <path
        d="M37 22 Q37 18 32 18 Q27 18 27 22 Q27 26 32 27 Q37 28 37 32 Q37 36 32 36 Q27 36 27 32"
        stroke={accent}
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
      <text
        x="42"
        y="22"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        fontSize="11"
        fontWeight="700"
        fill={accent}
      >
        3
      </text>
      <line
        x1="20"
        y1="44"
        x2="44"
        y2="44"
        stroke={accent}
        strokeWidth="1"
        strokeOpacity="0.5"
        strokeLinecap="round"
      />
      <line
        x1="24"
        y1="47"
        x2="40"
        y2="47"
        stroke={accent}
        strokeWidth="1"
        strokeOpacity="0.3"
        strokeLinecap="round"
      />
    </svg>
  );
}
