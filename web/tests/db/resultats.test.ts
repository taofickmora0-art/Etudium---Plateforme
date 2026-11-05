import { readFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { creerBanc, migrationsJusqua, type Banc } from "./banc";

// Migration 0077 : « Mes résultats » (spec du 5 novembre 2026). Parcours scolaires, semestres, UE, ECUE et notes,
// réservés à leur propriétaire (pas même l'équipe) ; règles de calcul et barèmes vérifiés ; limites par compte ; code
// PIN facultatif : quand il existe, la base n'ouvre rien sans un jeton de déverrouillage (en-tête x-etudium-resultats),
// valable 15 minutes ; 5 erreurs bloquent 15 minutes (puis 1 heure, puis 24 heures : migration 0078) ; le code oublié
// se réinitialise après une connexion récente.

const MIGRATION = "supabase/migrations/0077_resultats.sql";
let banc: Banc;
const [A, B, ADM] = Array.from({ length: 3 }, () => randomUUID());

type Resultat = { ok: boolean; jeton?: string; message?: string };
const entete = (jeton: string | null): Record<string, string> => (jeton ? { "request.headers": JSON.stringify({ "x-etudium-resultats": jeton }) } : {});
const en = <T>(qui: string, sql: string, params: unknown[] = [], jeton: string | null = null) => banc.en<T>({ id: qui }, sql, params, entete(jeton));
const r = async <T>(qui: string, sql: string, params: unknown[] = [], jeton: string | null = null) => (await en<{ r: T }>(qui, sql, params, jeton))[0].r;
const refus = (p: Promise<unknown>) => p.then(() => "accepté", (e: Error) => e.message);

/** Un parcours complet de A : parcours → semestre → UE → ECUE → note. */
async function arbre(qui = A, jeton: string | null = null) {
  const parcours = (await en<{ id: string }>(qui, "insert into public.parcours_scolaires (nom, etablissement) values ('Licence en agronomie', 'UAC') returning id", [], jeton))[0].id;
  const semestre = (await en<{ id: string }>(qui, "insert into public.semestres_scolaires (parcours_id, nom, annee) values ($1, 'Semestre 1', '2025-2026') returning id", [parcours], jeton))[0].id;
  const ue = (await en<{ id: string }>(qui, "insert into public.ue_scolaires (semestre_id, code, intitule, credits) values ($1, 'AGR101', 'Biologie végétale', 5) returning id", [semestre], jeton))[0].id;
  const ecue = (await en<{ id: string }>(qui, "insert into public.ecue_scolaires (ue_id, intitule, poids) values ($1, 'Botanique', 3) returning id", [ue], jeton))[0].id;
  await en(qui, "insert into public.notes_scolaires (ecue_id, categorie, libelle, note, sur) values ($1, 'cc', 'Interrogation 1', 14, 20)", [ecue], jeton);
  return { parcours, semestre, ue, ecue };
}
const compter = async (qui: string, jeton: string | null = null) =>
  Number((await en<{ n: number }>(qui, "select (select count(*) from public.parcours_scolaires) + (select count(*) from public.notes_scolaires) as n", [], jeton))[0].n);

beforeAll(async () => {
  banc = await creerBanc(["tests/db/realtime-simule.sql", ...migrationsJusqua("0076"), MIGRATION, "supabase/migrations/0078_blocage_resultats.sql"]);
  for (const [id, roles] of [[A, []], [B, []], [ADM, ["admin"]]] as const) await banc.creerCompte(id, [...roles]);
}, 180_000);

beforeEach(async () => {
  await banc.db.query("delete from public.parcours_scolaires");
  await banc.db.query("delete from public.verrou_resultats");
  await banc.db.query("delete from public.ouvertures_resultats");
});

describe("Les résultats, à leur propriétaire seul", () => {
  it("A crée son parcours jusqu'aux notes ; B et un admin n'en lisent rien", async () => {
    const { ecue } = await arbre();
    expect(await compter(A)).toBe(2);
    expect(await compter(B)).toBe(0);
    expect(await compter(ADM)).toBe(0);
    // B ne peut pas glisser une note dans l'ECUE de A.
    expect(await refus(en(B, "insert into public.notes_scolaires (ecue_id, categorie, note) values ($1, 'cc', 10)", [ecue]))).toMatch(/row-level security/);
    // Un visiteur n'a aucun droit.
    expect(await refus(banc.en("anon", "select count(*) from public.notes_scolaires"))).toMatch(/permission denied/);
  });

  it("refuse une note négative ou au-dessus de son barème, des crédits nuls", async () => {
    const { semestre, ecue } = await arbre();
    expect(await refus(en(A, "insert into public.notes_scolaires (ecue_id, categorie, note, sur) values ($1, 'cc', 12, 10)", [ecue]))).toMatch(/notes_scolaires_note/);
    expect(await refus(en(A, "insert into public.notes_scolaires (ecue_id, categorie, note) values ($1, 'cc', -1)", [ecue]))).toMatch(/notes_scolaires_note/);
    expect(await refus(en(A, "insert into public.ue_scolaires (semestre_id, intitule, credits) values ($1, 'UE', 0)", [semestre]))).toMatch(/ue_scolaires_credits/);
  });

  it("vérifie les règles et les barèmes (total 100 %, un seul examen, clés, 6 types au plus)", async () => {
    const regles = (categories: unknown) => JSON.stringify({ seuil_ue: 10, seuil_semestre: 10, compensation: false, rattrapage: "remplace", categories });
    const essai = (json: string) => refus(en(A, "insert into public.parcours_scolaires (nom, regles) values ('P', $1::jsonb)", [json]));
    expect(await essai(regles([{ cle: "cc", nom: "CC", poids: 39 }, { cle: "examen", nom: "Examen", poids: 60, examen: true }]))).toMatch(/parcours_scolaires_regles/);
    expect(await essai(regles([{ cle: "a", nom: "A", poids: 50, examen: true }, { cle: "b", nom: "B", poids: 50, examen: true }]))).toMatch(/parcours_scolaires_regles/);
    expect(await essai(regles([{ cle: "Contrôle", nom: "CC", poids: 100 }]))).toMatch(/parcours_scolaires_regles/);
    expect(await essai(regles(Array.from({ length: 7 }, (_, i) => ({ cle: `t${i}`, nom: `T${i}`, poids: i === 0 ? 40 : 10 }))))).toMatch(/parcours_scolaires_regles/);
    expect(await essai(JSON.stringify({ seuil_ue: 25, seuil_semestre: 10, compensation: false, rattrapage: "remplace", categories: [{ cle: "examen", nom: "Examen", poids: 100, examen: true }] }))).toMatch(/parcours_scolaires_regles/);
    expect(await essai(regles([{ cle: "interro", nom: "Interrogations", poids: 20 }, { cle: "tp", nom: "TP", poids: 20 }, { cle: "examen", nom: "Examen", poids: 60, examen: true }]))).toBe("accepté");
    // Les règles par défaut : 40 / 60, seuil 10, sans compensation, le rattrapage remplace l'examen.
    const p = (await en<{ regles: { categories: { cle: string; poids: number }[]; seuil_ue: number; compensation: boolean; rattrapage: string } }>(A, "insert into public.parcours_scolaires (nom) values ('Défaut') returning regles"))[0];
    expect(p.regles).toMatchObject({ seuil_ue: 10, compensation: false, rattrapage: "remplace" });
    expect(p.regles.categories.map((c) => [c.cle, c.poids])).toEqual([["cc", 40], ["examen", 60]]);
  });

  it("limite à 10 parcours par compte", async () => {
    for (let i = 0; i < 10; i++) await en(A, "insert into public.parcours_scolaires (nom) values ($1)", [`P${i}`]);
    expect(await refus(en(A, "insert into public.parcours_scolaires (nom) values ('Un de trop')"))).toBe("Tu as atteint la limite de 10 parcours.");
  });
});

describe("Le code PIN", () => {
  it("sans code, tout est lisible ; l'état le dit, et la proposition se note une fois", async () => {
    await arbre();
    expect(await r(A, "select public.etat_resultats() as r")).toMatchObject({ pin: false, ouvert: true, propose: false });
    await en(A, "select public.proposer_pin_vu()");
    expect(await r(A, "select public.etat_resultats() as r")).toMatchObject({ propose: true });
  });

  it("avec un code : rien sans jeton, tout avec le jeton d'ouverture ; un jeton expiré ne vaut plus rien", async () => {
    await arbre();
    const cree = await r<Resultat>(A, "select public.definir_pin_resultats('2580') as r");
    expect(cree.ok).toBe(true);
    expect(cree.jeton).toMatch(/^[0-9a-f]{64}$/);
    expect(await compter(A)).toBe(0);
    expect(await r(A, "select public.etat_resultats() as r")).toMatchObject({ pin: true, ouvert: false });
    expect(await refus(en(A, "insert into public.parcours_scolaires (nom) values ('Sans jeton')"))).toMatch(/row-level security/);
    const ouvert = await r<Resultat>(A, "select public.ouvrir_resultats('2580') as r");
    expect(ouvert.ok).toBe(true);
    expect(await compter(A, ouvert.jeton!)).toBe(2);
    expect(await r(A, "select public.etat_resultats() as r", [], ouvert.jeton!)).toMatchObject({ pin: true, ouvert: true });
    // Le jeton d'un autre compte n'ouvre pas les résultats de A.
    expect(await compter(B, ouvert.jeton!)).toBe(0);
    await banc.db.query("update public.ouvertures_resultats set expire_le = now() - interval '1 minute'");
    expect(await compter(A, ouvert.jeton!)).toBe(0);
    // Fermer : le jeton est retiré.
    const autre = await r<Resultat>(A, "select public.ouvrir_resultats('2580') as r");
    await en(A, "select public.fermer_resultats()", [], autre.jeton!);
    expect(await compter(A, autre.jeton!)).toBe(0);
  });

  it("4 erreurs puis le bon code : ouvert ; 5 erreurs : bloqué 15 minutes, même pour le bon code", async () => {
    await r(A, "select public.definir_pin_resultats('1234') as r");
    for (let i = 0; i < 4; i++) expect((await r<Resultat>(A, "select public.ouvrir_resultats('0000') as r")).ok).toBe(false);
    expect((await r<Resultat>(A, "select public.ouvrir_resultats('1234') as r")).ok).toBe(true);
    const messages: string[] = [];
    for (let i = 0; i < 5; i++) messages.push((await r<Resultat>(A, "select public.ouvrir_resultats('9999') as r")).message ?? "");
    expect(messages[0]).toBe("Code incorrect. Encore 4 essais.");
    expect(messages[3]).toBe("Code incorrect. Encore 1 essai.");
    expect(messages[4]).toBe("Trop d’essais : réessaie dans 15 minutes.");
    expect(await r<Resultat>(A, "select public.ouvrir_resultats('1234') as r")).toMatchObject({ ok: false, message: "Trop d’essais : réessaie dans 15 minutes." });
    expect((await r<{ bloque_jusqua: string | null }>(A, "select public.etat_resultats() as r")).bloque_jusqua).not.toBeNull();
    await banc.db.query("update public.verrou_resultats set bloque_jusqua = now() - interval '1 second'");
    expect((await r<Resultat>(A, "select public.ouvrir_resultats('1234') as r")).ok).toBe(true);
  });

  it("le blocage s'allonge : 15 minutes, 1 heure, puis 24 heures ; le bon code remet le compte à zéro", async () => {
    await r(A, "select public.definir_pin_resultats('1234') as r");
    const bloquer = async () => {
      await banc.db.query("update public.verrou_resultats set bloque_jusqua = null");
      let message = "";
      for (let i = 0; i < 5; i++) message = (await r<Resultat>(A, "select public.ouvrir_resultats('9999') as r")).message ?? "";
      return message;
    };
    expect(await bloquer()).toBe("Trop d’essais : réessaie dans 15 minutes.");
    expect(await bloquer()).toBe("Trop d’essais : réessaie dans 1 heure.");
    expect(await bloquer()).toBe("Trop d’essais : réessaie dans 24 heures.");
    expect((await r<Resultat>(A, "select public.ouvrir_resultats('1234') as r")).message).toBe("Trop d’essais : réessaie dans 24 heures.");
    expect(await bloquer()).toBe("Trop d’essais : réessaie dans 24 heures.");
    await banc.db.query("update public.verrou_resultats set bloque_jusqua = null");
    expect((await r<Resultat>(A, "select public.ouvrir_resultats('1234') as r")).ok).toBe(true);
    expect(await bloquer()).toBe("Trop d’essais : réessaie dans 15 minutes.");
  });

  it("refuse un code qui n'a pas 4 chiffres ; changer le code exige l'actuel ; le retirer rend tout lisible", async () => {
    await arbre();
    expect(await refus(r(A, "select public.definir_pin_resultats('12a4') as r"))).toBe("Le code doit faire 4 chiffres.");
    await r(A, "select public.definir_pin_resultats('1111') as r");
    expect(await r<Resultat>(A, "select public.definir_pin_resultats('2222') as r")).toMatchObject({ ok: false, message: "Code actuel incorrect. Encore 4 essais." });
    expect((await r<Resultat>(A, "select public.definir_pin_resultats('2222', '1111') as r")).ok).toBe(true);
    expect((await r<Resultat>(A, "select public.ouvrir_resultats('1111') as r")).ok).toBe(false);
    expect(await r<Resultat>(A, "select public.retirer_pin_resultats('0000') as r")).toMatchObject({ ok: false });
    expect((await r<Resultat>(A, "select public.retirer_pin_resultats('2222') as r")).ok).toBe(true);
    expect(await compter(A)).toBe(2);
  });

  it("code oublié : refusé sans connexion récente ; accepté juste après une connexion (amr de moins de 10 minutes)", async () => {
    await arbre();
    await r(A, "select public.definir_pin_resultats('4321') as r");
    const maintenant = Math.floor(Date.now() / 1000);
    const claims = (secondes: number) => ({ "request.jwt.claims": JSON.stringify({ amr: [{ method: "password", timestamp: maintenant - secondes }] }) });
    expect(await refus(banc.en({ id: A }, "select public.oublier_pin_resultats()", [], claims(3600)))).toBe("Reconnecte-toi pour créer un nouveau code.");
    expect(await refus(banc.en({ id: A }, "select public.oublier_pin_resultats()"))).toBe("Reconnecte-toi pour créer un nouveau code.");
    await banc.en({ id: A }, "select public.oublier_pin_resultats()", [], claims(60));
    expect(await compter(A)).toBe(2);
    expect(await r(A, "select public.etat_resultats() as r")).toMatchObject({ pin: false, ouvert: true });
  });
});

describe("La migration", () => {
  it("se rejoue sans erreur", async () => {
    await banc.db.exec(readFileSync(join(process.cwd(), MIGRATION), "utf8"));
    await arbre();
    expect(await compter(A)).toBe(2);
  });
});
