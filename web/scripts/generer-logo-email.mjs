// Génère le logo des e-mails : le logo complet d'Étudium (symbole + « tudium »), bleu sur fond transparent, en PNG
// (les messageries refusent le SVG). Affiché à 32 px de haut, produit à trois fois cette taille pour rester net.
// À relancer seulement si le logo change : node scripts/generer-logo-email.mjs (depuis le dossier web).
import { mkdirSync, readFileSync } from "node:fs";
import sharp from "sharp";

const BLEU = "#0B18C9";
const HAUTEUR = 96;

// Le tracé du logo complet, lu dans le composant du logo : une seule source pour l'appli, les icônes et les e-mails.
const traces = readFileSync("src/components/brand/traces.ts", "utf8");
const bloc = traces.slice(traces.indexOf("export const LOGO_COMPLET"));
const LOGO = {
  largeur: Number(/largeur: (\d+)/.exec(bloc)[1]),
  hauteur: Number(/hauteur: (\d+)/.exec(bloc)[1]),
  d: /d: "([^"]+)"/.exec(bloc)[1],
};

const largeur = Math.round((HAUTEUR * LOGO.largeur) / LOGO.hauteur);
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${LOGO.largeur}" height="${LOGO.hauteur}" viewBox="0 0 ${LOGO.largeur} ${LOGO.hauteur}">
  <path fill="${BLEU}" fill-rule="evenodd" d="${LOGO.d}"/>
</svg>
`;

mkdirSync("public/email", { recursive: true });
await sharp(Buffer.from(svg), { density: (72 * HAUTEUR) / LOGO.hauteur * 2 })
  .resize(largeur, HAUTEUR)
  .png()
  .toFile("public/email/logo-etudium.png");
console.log(`écrit public/email/logo-etudium.png (${largeur} × ${HAUTEUR})`);
