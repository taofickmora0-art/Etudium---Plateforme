export type Parcours = "academique" | "digital" | "business";

// Trois plaques superposées aux couleurs du parcours (planche « Fondations », « Illustration des cartes »).
// Chaque plaque : un contour sombre de 12,4 puis un aplat de 10, d'où l'effet de tranche.
export const PALETTES: Record<Parcours, [string, string, string, string, string, string]> = {
  academique: ["#08149F", "#0B18C9", "#060F75", "#9DA6FF", "#060F75", "#EEF0FF"],
  digital: ["#5B21B6", "#7C3AED", "#4C1D95", "#C4B5FD", "#4C1D95", "#F5F3FF"],
  business: ["#C2410C", "#F97316", "#7C2D12", "#FDBA74", "#7C2D12", "#FFF7ED"],
};

export const PLAQUES = ["7.7,35 24,30.2 40.3,35 24,39.8", "10.6,22.5 24.2,18.2 37.8,22.5 24.2,26.8", "13.2,12.5 24,8.7 34.8,12.5 24,16.3"];

export function CourseIllustration({ parcours, size = 48 }: { parcours: Parcours; size?: number }) {
  const c = PALETTES[parcours];
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" className="block shrink-0">
      {PLAQUES.map((points, i) => (
        <g key={points}>
          <polygon points={points} fill={c[i * 2]} stroke={c[i * 2]} strokeWidth={12.4} strokeLinejoin="round" />
          <polygon points={points} fill={c[i * 2 + 1]} stroke={c[i * 2 + 1]} strokeWidth={10} strokeLinejoin="round" />
        </g>
      ))}
    </svg>
  );
}
