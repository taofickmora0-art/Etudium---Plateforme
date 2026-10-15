// Génère les icônes de l'appli (onglet, iPhone, appli installée) depuis le symbole Étudium : le « e » coiffé d'un
// chapeau de diplômé, blanc sur une tuile bleue (logo fourni le 15 octobre 2026).
// À relancer seulement si le logo change : node scripts/generer-icones.mjs (depuis le dossier web).
import { readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const BLEU = "#0B18C9";

// Le tracé du symbole, lu dans le composant du logo : une seule source pour l'appli et les icônes.
const traces = readFileSync("src/components/brand/traces.ts", "utf8");
const bloc = traces.slice(traces.indexOf("export const SYMBOLE"), traces.indexOf("export const LOGO_COMPLET"));
const SYMBOLE = {
  largeur: Number(/largeur: (\d+)/.exec(bloc)[1]),
  hauteur: Number(/hauteur: (\d+)/.exec(bloc)[1]),
  d: /d: "([^"]+)"/.exec(bloc)[1],
};

/**
 * L'icône dans un carré de 100 : fond bleu (`rayon` d'arrondi, 0 = plein carré) et symbole blanc centré, qui occupe
 * la part `part` du côté.
 */
function icone({ part, rayon }) {
  const echelle = (100 * part) / Math.max(SYMBOLE.largeur, SYMBOLE.hauteur);
  const x = (100 - SYMBOLE.largeur * echelle) / 2;
  const y = (100 - SYMBOLE.hauteur * echelle) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="${rayon}" fill="${BLEU}"/>
  <path transform="translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${echelle.toFixed(5)})" fill="#FFFFFF" fill-rule="evenodd" d="${SYMBOLE.d}"/>
</svg>
`;
}

async function png(svg, taille, chemin) {
  await sharp(Buffer.from(svg), { density: (72 * taille) / 100 }).resize(taille, taille).png().toFile(chemin);
  console.log("écrit", chemin);
}

// « any » : la tuile bleue arrondie, coins transparents.
await png(icone({ part: 0.62, rayon: 22 }), 192, "public/icons/icone-192.png");
await png(icone({ part: 0.62, rayon: 22 }), 512, "public/icons/icone-512.png");
// « maskable » : Android découpe l'icône ; fond plein, symbole dans la zone sûre (cercle central de 80 %).
await png(icone({ part: 0.5, rayon: 0 }), 512, "public/icons/icone-masquable-512.png");
// iPhone : pas de transparence (iOS la remplit en noir et arrondit lui-même les coins).
await png(icone({ part: 0.62, rayon: 0 }), 180, "src/app/apple-icon.png");
// Onglet du navigateur : en SVG, symbole un peu plus grand pour rester lisible à 16 px.
writeFileSync("src/app/icon.svg", icone({ part: 0.72, rayon: 22 }));
console.log("écrit src/app/icon.svg");
