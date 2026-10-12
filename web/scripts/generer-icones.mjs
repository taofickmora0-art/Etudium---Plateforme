// Génère les icônes de l'appli installable depuis le logo du design (hexagone bleu, « É » blanc).
// À relancer seulement si le logo change : node scripts/generer-icones.mjs (depuis le dossier web).
import { copyFileSync, mkdirSync } from "node:fs";
import sharp from "sharp";

const BLEU = "#0B18C9";
const PAGE = "#F2F6FD";
const POLICE = "Inter, 'Segoe UI', Arial, Helvetica, sans-serif";

/** Le logo dans un carré de 100 : `part` = place occupée (0 à 1), sur fond `fond` (ou transparent). */
function logo({ part, fond = null, hexagone = BLEU, lettre = "#FFFFFF" }) {
  const echelle = (100 * part) / 30;
  const decalage = (100 - 100 * part) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
  ${fond ? `<rect width="100" height="100" fill="${fond}"/>` : ""}
  <g transform="translate(${decalage} ${decalage}) scale(${echelle})">
    <polygon points="15,4 24.5,9.5 24.5,20.5 15,26 5.5,20.5 5.5,9.5" fill="${hexagone}" stroke="${hexagone}" stroke-width="5" stroke-linejoin="round"/>
    <text x="15" y="20" text-anchor="middle" font-size="14" font-weight="700" fill="${lettre}" font-family="${POLICE}">É</text>
  </g>
</svg>`;
}

async function png(svg, taille, chemin) {
  await sharp(Buffer.from(svg), { density: (72 * taille) / 100 }).resize(taille, taille).png().toFile(chemin);
  console.log("écrit", chemin);
}

mkdirSync("public/icons", { recursive: true });
// « any » : le logo seul, marge de 6 %.
await png(logo({ part: 0.88 }), 192, "public/icons/icone-192.png");
await png(logo({ part: 0.88 }), 512, "public/icons/icone-512.png");
// « maskable » : Android découpe l'icône ; fond plein bleu, logo inversé dans la zone sûre (60 % au centre).
await png(logo({ part: 0.6, fond: BLEU, hexagone: "#FFFFFF", lettre: BLEU }), 512, "public/icons/icone-masquable-512.png");
// iPhone : pas de transparence (iOS la remplit en noir) ; fond de page, logo à 76 %.
await png(logo({ part: 0.76, fond: PAGE }), 180, "src/app/apple-icon.png");
// Onglet du navigateur : le logo en SVG.
copyFileSync("scripts/logo-etudium.svg", "src/app/icon.svg");
console.log("écrit src/app/icon.svg");
