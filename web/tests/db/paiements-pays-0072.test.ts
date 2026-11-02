import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { abonner } from "./abonner";
import { creerBanc, migrationsJusqua, type Banc, type Qui } from "./banc";

// Migration 0072 : le paiement ouvert à tous les pays et à tous les opérateurs de Payiz (demande du 2 novembre 2026).
//   - L'opérateur n'est plus limité à MTN et Moov : tout code Payiz (minuscules, chiffres, « _ », « - », 40 au plus).
//   - Le pays du payeur (alpha-3) et le nom de l'opérateur au moment du paiement sont gardés, pour le reçu, l'historique
//     et le back-office ; les paiements d'avant (tous béninois) prennent « BEN ».
//   - noter_essai les reçoit, et s'appelle encore avec ses 5 paramètres d'avant.

const MIGRATION = "supabase/migrations/0072_paiements_tous_pays.sql";

let banc: Banc;
const [S, A, E, G] = Array.from({ length: 4 }, () => randomUUID());
// S : super admin ; A : admin ; E : étudiante ; G : étudiant.
const J = "j".repeat(40); // le jeton du serveur
const formules: Record<string, string> = {};
let ancien: { paiement: string; recu: string };

type Carte = { id: string; statut: string; operateur: string | null; operateur_nom: string | null; pays: string | null; telephone_masque: string | null; numero_recu: string | null };

const rpc = async <T>(qui: Qui, sql: string, params: unknown[] = []) => (await banc.en<{ r: T }>(qui, sql, params))[0].r;
const paiement = async (profil: string, champs: Record<string, unknown> = {}) => {
  const colonnes = { profil_id: profil, formule_id: formules.standard, prix_initial: 15000, montant: 15000, ...champs };
  const noms = Object.keys(colonnes);
  const { rows } = await banc.db.query<{ id: string }>(
    `insert into public.paiements (${noms.join(", ")}) values (${noms.map((_, i) => `$${i + 1}`).join(", ")}) returning id`,
    Object.values(colonnes),
  );
  return rows[0].id;
};
const noterEssai = (id: string, payiz: string, operateur: string | null, masque: string, pays: string | null, nom: string | null) =>
  rpc<Carte>("anon", "select public.noter_essai($1, $2, $3, $4, $5, $6, $7) as r", [id, payiz, operateur, masque, J, pays, nom]);
const colonnes = async (id: string) =>
  (await banc.db.query<{ operateur: string | null; operateur_nom: string | null; pays: string | null }>("select operateur, operateur_nom, pays from public.paiements where id = $1", [id]))
    .rows[0];

beforeAll(async () => {
  banc = await creerBanc(migrationsJusqua("0071"));
  for (const [id, roles] of [[S, ["super_admin"]], [A, ["admin"]], [E, []], [G, []]] as const) await banc.creerCompte(id, [...roles]);
  for (const { id, code } of (await banc.db.query<{ id: string; code: string }>("select id, code from public.formules")).rows) formules[code] = id;
  await banc.db.query("update public.formules set prix_fcfa = 15000 where code = 'standard'");

  // Avant la 0072 : un paiement MTN réussi (avec son abonnement), un paiement manuel, une préparation jamais partie.
  await abonner(banc, E);
  const { rows } = await banc.db.query<{ id: string; numero_recu: string }>("select id, numero_recu from public.paiements where profil_id = $1", [E]);
  ancien = { paiement: rows[0].id, recu: rows[0].numero_recu };
  await paiement(G, { source: "manuel", moyen_manuel: "especes", statut: "reussi", numero_recu: "ET-R-MANUEL" });
  await paiement(G);
  await expect(paiement(G, { operateur: "celtiis" })).rejects.toThrow();

  await banc.appliquer(MIGRATION);
  await banc.db.query(
    "update public.reglages_paiement set ouverts = true, empreinte = encode(sha256(convert_to($1::text, 'UTF8')), 'hex')",
    [J],
  );
});

describe("Les paiements d'avant", () => {
  it("restent tels quels ; ceux passés par Payiz (tous en +229) prennent le Bénin pour pays", async () => {
    expect(await colonnes(ancien.paiement)).toEqual({ operateur: "mtn", operateur_nom: null, pays: "BEN" });
    const { rows } = await banc.db.query<{ source: string; pays: string | null }>("select source, pays from public.paiements where profil_id = $1 order by source", [G]);
    expect(rows).toEqual([
      { source: "manuel", pays: null },
      { source: "payiz", pays: null },
    ]);
  });

  it("le reçu d'un ancien paiement : l'opérateur, le Bénin, pas de nom (l'appli le déduit du code)", async () => {
    expect(await rpc({ id: E }, "select public.recu($1) as r", [ancien.recu])).toMatchObject({
      operateur: "mtn",
      operateur_nom: null,
      pays: "BEN",
      telephone_masque: "+229 01 •• •• •• 00",
    });
  });
});

describe("Tout opérateur, tout pays", () => {
  it("tout code d'opérateur de Payiz ; un code, un pays ou un nom mal formés sont refusés", async () => {
    for (const operateur of ["celtiis", "orange_money", "t-money", "a".repeat(40)]) await paiement(G, { operateur });
    for (const champs of [{ operateur: "MTN" }, { operateur: "mtn bj" }, { operateur: "a".repeat(41) }, { pays: "ben" }, { pays: "BENIN" }, { operateur_nom: "" }, { operateur_nom: "x".repeat(61) }]) {
      await expect(paiement(G, champs)).rejects.toThrow(/violates check constraint/);
    }
  });

  it("noter_essai garde le pays et le nom de l'opérateur ; un nouvel essai d'un autre pays les remplace", async () => {
    const id = await paiement(E);
    const carte = await noterEssai(id, "pay_celtiis", "celtiis", "+229 •• •• •• •• 00", "BEN", "Celtiis Cash");
    expect(carte).toMatchObject({ statut: "en_attente", operateur: "celtiis", operateur_nom: "Celtiis Cash", pays: "BEN", telephone_masque: "+229 •• •• •• •• 00" });

    await banc.db.query("update public.paiements set statut = 'echoue' where id = $1", [id]);
    expect(await noterEssai(id, "pay_celtiis", "togocel", "+228 •• •• •• •• 56", "TGO", "  Mixx by Yas  ")).toMatchObject({
      operateur: "togocel",
      operateur_nom: "Mixx by Yas",
      pays: "TGO",
      telephone_masque: "+228 •• •• •• •• 56",
    });

    // Un code illisible ne remplace rien ; un pays en minuscules est relevé ; un nom trop long est coupé.
    expect(await noterEssai(id, "pay_celtiis", "MTN!", "+221 •• •• •• •• 67", "sen", "Nom ignoré")).toMatchObject({
      operateur: "togocel",
      operateur_nom: "Mixx by Yas",
      pays: "SEN",
    });
    expect(await noterEssai(id, "pay_celtiis", "wave", "+221 •• •• •• •• 67", "XX", "W".repeat(80))).toMatchObject({ operateur: "wave", pays: "SEN" });
    expect((await colonnes(id)).operateur_nom).toBe("W".repeat(60));
  });

  it("l'appli d'avant appelle encore noter_essai avec ses 5 paramètres", async () => {
    const id = await paiement(E);
    const carte = await rpc<Carte>("anon", "select public.noter_essai($1, $2, 'moov', '+229 01 •• •• •• 00', $3) as r", [id, "pay_cinq", J]);
    expect(carte).toMatchObject({ operateur: "moov", operateur_nom: null, pays: null });
    const { rows } = await banc.db.query<{ n: number }>("select count(*)::int as n from pg_proc where proname = 'noter_essai' and pronamespace = 'public'::regnamespace");
    expect(rows[0].n).toBe(1);
  });

  it("sans le jeton du serveur, rien n'est noté", async () => {
    const id = await paiement(E);
    await expect(rpc("anon", "select public.noter_essai($1, 'pay_x', 'celtiis', '', 'mauvais', 'BEN', 'Celtiis Cash') as r", [id])).rejects.toThrow();
    expect(await colonnes(id)).toEqual({ operateur: null, operateur_nom: null, pays: null });
  });
});

describe("Le reçu, l'historique et le back-office", () => {
  it("renvoient le pays et le nom de l'opérateur d'un nouveau paiement", async () => {
    const id = await paiement(G);
    await noterEssai(id, "pay_nouveau", "celtiis", "+229 •• •• •• •• 00", "BEN", "Celtiis Cash");
    const reussi = await rpc<Carte>("anon", "select public.confirmer_paiement($1, 'pay_nouveau', 15000, $2) as r", [id, J]);
    expect(reussi).toMatchObject({ statut: "reussi", operateur: "celtiis", operateur_nom: "Celtiis Cash", pays: "BEN" });

    expect(await rpc({ id: G }, "select public.recu($1) as r", [reussi.numero_recu])).toMatchObject({
      operateur: "celtiis",
      operateur_nom: "Celtiis Cash",
      pays: "BEN",
      telephone_masque: "+229 •• •• •• •• 00",
    });
    const historique = await rpc<Carte[]>({ id: G }, "select public.mes_paiements() as r");
    expect(historique.find((c) => c.id === id)).toMatchObject({ operateur_nom: "Celtiis Cash", pays: "BEN" });

    const page = await rpc<{ lignes: (Carte & { id: string })[] }>({ id: A }, "select public.paiements_equipe(null, '', 1) as r");
    expect(page.lignes.find((l) => l.id === id)).toMatchObject({ operateur: "celtiis", operateur_nom: "Celtiis Cash", pays: "BEN" });
    expect(page.lignes.find((l) => l.id === ancien.paiement)).toMatchObject({ operateur: "mtn", operateur_nom: null, pays: "BEN" });
    expect(await rpc({ id: A }, "select public.paiement_equipe($1) as r", [id])).toMatchObject({ operateur_nom: "Celtiis Cash", pays: "BEN" });

    const fiche = await rpc<{ abonnements: { paiement_id: string; operateur_nom: string | null; pays: string | null }[] }>({ id: A }, "select public.abonnements_compte($1) as r", [G]);
    expect(fiche.abonnements.find((a) => a.paiement_id === id)).toMatchObject({ operateur_nom: "Celtiis Cash", pays: "BEN" });
  });

  it("l'équipe seule lit la liste et la fiche (droits inchangés)", async () => {
    await expect(rpc({ id: E }, "select public.paiements_equipe(null, '', 1) as r")).rejects.toThrow();
    await expect(rpc({ id: E }, "select public.abonnements_compte($1) as r", [G])).rejects.toThrow();
  });
});

describe("Rejouable", () => {
  it("une seconde application ne change rien, sauf le pays de ce que l'appli d'avant a noté entre-temps (au Bénin)", async () => {
    type Ligne = { id: string; source: string; operateur: string | null; operateur_nom: string | null; pays: string | null; telephone_masque: string | null };
    const lire = async () =>
      (await banc.db.query<Ligne>("select id, source, operateur, operateur_nom, pays, telephone_masque from public.paiements order by id")).rows;
    const avant = await lire();
    const notesParLAppliDAvant = avant.filter((l) => l.source === "payiz" && l.pays === null && l.telephone_masque?.startsWith("+229 "));
    expect(notesParLAppliDAvant).toHaveLength(1);
    await banc.appliquer(MIGRATION);
    expect(await lire()).toEqual(avant.map((l) => (notesParLAppliDAvant.includes(l) ? { ...l, pays: "BEN" } : l)));
    const { rows } = await banc.db.query<{ conname: string }>(
      "select conname from pg_constraint where conrelid = 'public.paiements'::regclass and conname like 'paiements_%' order by conname",
    );
    expect(rows.map((r) => r.conname)).toEqual(expect.arrayContaining(["paiements_operateur_valide", "paiements_pays_valide", "paiements_operateur_nom_valide"]));
    expect(rows.map((r) => r.conname)).not.toContain("paiements_operateur_check");
  });
});
