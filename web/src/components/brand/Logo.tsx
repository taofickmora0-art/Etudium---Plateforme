/** Symbole Étudium : hexagone bleu avec un « É » (repris du design). */
export function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 30 30" aria-hidden="true" className="block">
      <polygon
        points="15,4 24.5,9.5 24.5,20.5 15,26 5.5,20.5 5.5,9.5"
        fill="#0B18C9"
        stroke="#0B18C9"
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <text x="15" y="20" textAnchor="middle" fontSize="14" fontWeight="700" fill="#FFFFFF" fontFamily="inherit">
        É
      </text>
    </svg>
  );
}

/** Logo Étudium complet : symbole suivi du nom. */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span aria-label="Étudium" role="img" className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark />
      <span aria-hidden="true" className="text-[17px] font-bold tracking-[-0.02em] text-bleu">
        Étudium
      </span>
    </span>
  );
}
