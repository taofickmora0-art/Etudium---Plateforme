import { randomUUID } from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { creerBanc, migrationsJusqua, type Banc, type Qui } from "./banc";

// Migration 0073, deuxième partie (demande du 3 novembre 2026) : chaque nouvel abonnement pris par un étudiant prévient
// l'équipe des paiements (admins et super admins actifs) par une notification dans la cloche et un e-mail détaillé.
// Une seule fois par paiement (un webhook rejoué ne double rien) ; rien pour un abonnement attribué à la main (0054).

const MIGRATION = "supabase/migrations/0073_codes_promo_formules.sql";
const J = "j".repeat(40); // le jeton du serveur (paiements)

let banc: Banc;
let JETON_ENVOIS: string;
const [S, A, X, M, E, G] = Array.from({ length: 6 }, () => randomUUID());
// S : super admin ; A : admin ; X : admin suspendu ; M : modérateur ; E : étudiante (Awa Kpadé) ; G : étudiant.
const formules: Record<string, string> = {};

type Notification = { destinataire: string; categorie: string; titre: string; texte: string; lien: string | null };
type Envoi = { destinataire: string; canal: string; titre: string; texte: string; lien: string | null; details: { libelle: string; valeur: string }[] | null };
type Carte = { id: string; montant: number; statut: string };

const rpc = async <T>(qui: Qui, sql: string, params: unknown[] = []) => (await banc.en<{ r: T }>(qui, sql, params))[0].r;
const notifications = async (titre = "Nouvel abonnement%") =>
  (await banc.db.query<Notification>("select destinataire, categorie, titre, texte, lien from public.notifications where titre like $1 order by id", [titre])).rows;
const emails = async () =>
  (await banc.db.query<Envoi>("select destinataire, canal, titre, texte, lien, details from public.envois where canal = 'email' and titre like 'Nouvel abonnement%' order by id")).rows;

/** Le parcours d'un paiement Payiz : préparé par l'étudiant, essai noté, puis confirmé par le serveur. */
async function payer(qui: string, formule: string, code: string | null, operateur = "moov", nom: string | null = "Moov Money") {
  const carte = await rpc<Carte>({ id: qui }, "select public.preparer_paiement($1, $2) as r", [formule, code]);
  if (carte.statut === "reussi") return carte.id;
  const payiz = `pay_${carte.id.slice(0, 8)}`;
  await rpc("anon", "select public.noter_essai($1, $2, $3, '+229 •• •• •• •• 00', $4, 'BEN', $5) as r", [carte.id, payiz, operateur, J, nom]);
  await rpc("anon", "select public.confirmer_paiement($1, $2, $3, $4) as r", [carte.id, payiz, carte.montant, J]);
  return carte.id;
}

beforeAll(async () => {
  banc = await creerBanc(migrationsJusqua("0072"));
  for (const [id, roles] of [[S, ["super_admin"]], [A, ["admin"]], [X, ["admin"]], [M, ["moderateur"]], [E, []], [G, []]] as const) {
    await banc.creerCompte(id, [...roles]);
  }
  await banc.db.query("update public.profils set prenom = 'Awa', nom = 'Kpadé' where id = $1", [E]);
  await banc.db.query("insert into public.suspensions (profil_id, motif) values ($1, 'Test')", [X]);
  for (const { id, code } of (await banc.db.query<{ id: string; code: string }>("select id, code from public.formules")).rows) formules[code] = id;
  await banc.db.query("update public.formules set prix_fcfa = case code when 'basique' then 9000 when 'standard' then 15000 else 25000 end");
  await banc.db.query("update public.reglages_paiement set ouverts = true, empreinte = encode(sha256(convert_to($1::text, 'UTF8')), 'hex')", [J]);
  await banc.appliquer(MIGRATION);
  JETON_ENVOIS = (await banc.db.query<{ j: string }>("select public.nouveau_jeton_envois() as j")).rows[0].j;
  await banc.en({ id: A }, "select public.enregistrer_code_promo(null, 'TESTP10', 'pourcentage', 10, null, null, null, true, $1::uuid[])", [[formules.basique]]);
  await banc.en({ id: A }, "select public.enregistrer_code_promo(null, 'OFFERT100', 'pourcentage', 100, null, null, null, true, $1::uuid[])", [[formules.premium]]);
});

beforeEach(async () => {
  await banc.db.query("delete from public.notifications");
  await banc.db.query("delete from public.envois");
  await banc.db.query("delete from public.essais_codes");
});

describe("Un abonnement payé prévient l'équipe des paiements", () => {
  it("une notification et un e-mail détaillé par admin et super admin actifs ; rien pour l'étudiante, le modérateur ni l'admin suspendu", async () => {
    await payer(E, formules.basique, "TESTP10");
    const n = await notifications();
    expect(n.map((x) => x.destinataire).sort()).toEqual([A, S].sort());
    expect(n[0]).toMatchObject({
      categorie: "service",
      titre: "Nouvel abonnement : Awa Kpadé",
      texte: "Basique · 3 mois · 8 100 FCFA payés (code TESTP10) · Moov Money (Bénin)",
      lien: `/admin/utilisateurs/${E}`,
    });
    // L'étudiante garde sa propre notification « Paiement reçu ».
    expect((await notifications("Paiement reçu%")).map((x) => x.destinataire)).toEqual([E]);

    // Un e-mail détaillé aux mêmes destinataires, que le serveur reçoit avec ses lignes.
    const e = await emails();
    expect(e.map((x) => x.destinataire).sort()).toEqual([A, S].sort());
    expect(e[0]).toMatchObject({ titre: "Nouvel abonnement : Awa Kpadé", lien: `/admin/utilisateurs/${E}` });
    const lignes = Object.fromEntries((e[0].details ?? []).map((l) => [l.libelle, l.valeur]));
    expect(lignes).toMatchObject({
      Étudiant: "Awa Kpadé",
      "E-mail": `${E.slice(0, 8)}@exemple.com`,
      Abonnement: "Basique · 3 mois",
      Prix: "9 000 FCFA",
      Remise: "− 900 FCFA (code TESTP10)",
      "Montant payé": "8 100 FCFA",
      "Moyen de paiement": "Moov Money (Bénin) · +229 •• •• •• •• 00",
    });
    expect(lignes.Période).toMatch(/^Du \d{1,2}(er)? \S+ \d{4} au \d{1,2}(er)? \S+ \d{4}$/);
    expect(lignes.Reçu).toMatch(/^ET-R-\d{4}-\d{6}$/);
    expect(lignes["Payé le"]).toMatch(/^\d{1,2}(er)? \S+ \d{4} à \d{2} h \d{2} \(heure du Bénin\)$/);
    expect(Object.keys(lignes)).toEqual(["Étudiant", "E-mail", "Abonnement", "Période", "Prix", "Remise", "Montant payé", "Moyen de paiement", "Reçu", "Payé le"]);

    const pris = await rpc<{ titre: string; details: unknown }[]>("anon", "select public.prendre_envois($1, array['email'], 20) as r", [JETON_ENVOIS]);
    expect(pris.find((p) => p.titre === "Nouvel abonnement : Awa Kpadé")?.details).toEqual(e[0].details);
  });

  it("sans code : ni code ni remise ; un opérateur sans nom prend celui de son code", async () => {
    await payer(G, formules.standard, null, "mtn", null);
    const [n] = await notifications();
    expect(n.texte).toBe("Standard · 6 mois · 15 000 FCFA payés · MTN Mobile Money (Bénin)");
    const lignes = (await emails())[0].details?.map((l) => l.libelle);
    expect(lignes).not.toContain("Remise");
  });

  it("un webhook rejoué (ou la relecture du suivi) ne double rien", async () => {
    const id = await payer(G, formules.premium, null);
    const { rows } = await banc.db.query<{ payiz_id: string; montant: number }>("select payiz_id, montant from public.paiements where id = $1", [id]);
    await rpc("anon", "select public.confirmer_paiement($1, $2, $3, $4) as r", [id, rows[0].payiz_id, rows[0].montant, J]);
    expect(await notifications()).toHaveLength(2);
    expect(await emails()).toHaveLength(2);
  });

  it("un abonnement offert par un code à 100 % : prévenue aussi, « offert », sans moyen de paiement", async () => {
    await payer(G, formules.premium, "OFFERT100");
    const [n] = await notifications();
    expect(n.texte).toBe("Premium · 1 an · offert (code OFFERT100)");
    const lignes = Object.fromEntries(((await emails())[0].details ?? []).map((l) => [l.libelle, l.valeur]));
    expect(lignes["Montant payé"]).toBe("0 FCFA (offert par le code OFFERT100)");
    expect(lignes).not.toHaveProperty("Moyen de paiement");
  });

  it("un abonnement attribué à la main (0054) ne prévient pas : c'est l'équipe qui l'a fait", async () => {
    await banc.en({ id: A }, "select public.attribuer_abonnement($1, $2, 'especes', 15000, null)", [G, formules.standard]);
    await banc.en({ id: A }, "select public.attribuer_abonnement($1, $2, 'offert', null, null)", [G, formules.basique]);
    expect(await notifications()).toEqual([]);
    expect(await emails()).toEqual([]);
  });

  it("un admin qui s'abonne lui-même est prévenu comme les autres", async () => {
    await payer(A, formules.standard, null);
    expect((await notifications()).map((x) => x.destinataire).sort()).toEqual([A, S].sort());
  });
});

describe("Rejouable", () => {
  it("une seconde application garde une seule alerte par abonnement", async () => {
    await banc.appliquer(MIGRATION);
    await payer(G, formules.standard, null);
    expect(await notifications()).toHaveLength(2);
    expect(await emails()).toHaveLength(2);
  });
});
