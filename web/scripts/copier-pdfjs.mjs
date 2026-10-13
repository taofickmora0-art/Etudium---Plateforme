// Copie les fichiers de décodage de pdf.js (images de PDF scannés, polices standard) dans public/pdfjs, pour que le
// visualiseur des ressources (tâche 1.8) les serve. Lancé avant `next dev` et `next build` : les fichiers restent ceux
// de la version de pdfjs-dist installée. Le dossier public/pdfjs n'est pas suivi par Git (il est recréé à chaque fois).
import { cpSync, existsSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const racine = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(racine, "node_modules", "pdfjs-dist");
const cible = join(racine, "public", "pdfjs");

if (!existsSync(source)) {
  console.error("pdfjs-dist n'est pas installé : lancez « npm install ».");
  process.exit(1);
}
rmSync(cible, { recursive: true, force: true });
for (const dossier of ["wasm", "standard_fonts"]) {
  cpSync(join(source, dossier), join(cible, dossier), { recursive: true });
}
console.log("pdf.js : fichiers de décodage copiés dans public/pdfjs.");
