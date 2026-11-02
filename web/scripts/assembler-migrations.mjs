// Regroupe les migrations (supabase/migrations/0001_… à la dernière) en quelques fichiers à coller, dans l'ordre, dans
// l'éditeur SQL du projet Supabase de production (spec de la mise en ligne, §1.3). Les exemples (supabase/exemples)
// n'en font jamais partie. À relancer après chaque nouvelle migration : `node scripts/assembler-migrations.mjs`.
// Un test (tests/production/assemblage.test.ts) vérifie que les fichiers produits suivent les migrations.
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATIONS = join(RACINE, "supabase", "migrations");
const SORTIE = join(RACINE, "supabase", "production");
/** Taille visée d'un fichier : assez petit pour l'éditeur SQL, assez gros pour en coller peu. */
export const TAILLE_MAX = 250_000;

/** Les migrations, dans l'ordre de leur numéro. */
export function lireMigrations(dossier = MIGRATIONS) {
  return readdirSync(dossier)
    .filter((nom) => /^\d{4}_.+\.sql$/.test(nom))
    .sort()
    .map((nom) => ({ nom, sql: readFileSync(join(dossier, nom), "utf8").replace(/\r\n/g, "\n") }));
}

/** Range les migrations dans des parties successives d'au plus TAILLE_MAX caractères (une migration n'est jamais coupée). */
export function regrouper(migrations, tailleMax = TAILLE_MAX) {
  const parties = [];
  let courante = [];
  let taille = 0;
  for (const m of migrations) {
    if (courante.length > 0 && taille + m.sql.length > tailleMax) {
      parties.push(courante);
      courante = [];
      taille = 0;
    }
    courante.push(m);
    taille += m.sql.length;
  }
  if (courante.length > 0) parties.push(courante);
  return parties;
}

/** Le texte d'une partie : un en-tête qui dit quoi en faire, puis chaque migration précédée de son nom. */
export function texteDePartie(partie, numero, total) {
  const premiere = partie[0].nom.slice(0, 4);
  const derniere = partie[partie.length - 1].nom.slice(0, 4);
  const entete = [
    `-- Étudium · base de production · partie ${numero} sur ${total} (migrations ${premiere} à ${derniere}).`,
    "-- Fichier produit par scripts/assembler-migrations.mjs : ne pas le modifier à la main.",
    "-- Supabase › SQL Editor › New query : colle tout ce fichier, puis Run. Attends « Success » avant la partie suivante.",
    numero < total ? `-- Ensuite : partie ${numero + 1}.` : "-- C'était la dernière partie : reprends le guide « Mise en ligne ».",
    "",
  ].join("\n");
  const corps = partie.map((m) => `-- ═══ ${m.nom} ═══\n${m.sql.trimEnd()}\n`).join("\n");
  return `${entete}\n${corps}`;
}

function assembler() {
  const parties = regrouper(lireMigrations());
  rmSync(SORTIE, { recursive: true, force: true });
  mkdirSync(SORTIE, { recursive: true });
  parties.forEach((partie, i) => {
    writeFileSync(join(SORTIE, `partie-${i + 1}.sql`), texteDePartie(partie, i + 1, parties.length), "utf8");
  });
  console.log(`${parties.length} parties écrites dans supabase/production/ (${parties.flat().length} migrations).`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) assembler();
