import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { creerBanc, migrationsJusqua, type Banc, type Qui } from "./banc";

// Migration 0062 : la vue d'ensemble du back-office (design NdAdmin) et les statistiques par période (lot 6 A,
// spec §4). Des données connues, des chiffres exacts ; l'heure du Bénin ; une plateforme vide ne divise jamais par zéro.

let banc: Banc;
let vide: Banc;
const S = randomUUID(); // super admin
const M = randomUUID(); // modérateur
const E1 = randomUUID();
const E2 = randomUUID();
const E3 = randomUUID();
const E4 = randomUUID();
const MAINTENANT = "2026-11-15T12:00:00+01:00";

const un = async <T>(sql: string, params: unknown[] = []) => (await banc.db.query<T>(sql, params)).rows[0];
const en = async <T>(b: Banc, qui: string, sql: string, params: unknown[] = []) => ((await b.en({ id: qui } as Qui, sql, params)) as { r: T }[])[0].r;

async function payer(profil: string, formule: string, montant: number, statut: string, quand: string, abonnement?: { debut: string; fin: string }, code?: string) {
  const paiement = randomUUID();
  await banc.db.query(
    `insert into public.paiements (id, profil_id, formule_id, prix_initial, montant, remise, code_promo_id, statut, payiz_id, operateur, essai_le, confirme_le, numero_recu, cree_le)
     select $1, $2, f.id, $3 + coalesce($8::int, 0), $3, coalesce($8::int, 0), (select id from public.codes_promo where code = $9), $4, $5, 'mtn', $6::timestamptz,
            case when $4 = 'reussi' then $6::timestamptz end, case when $4 = 'reussi' then $7 end, $6::timestamptz
     from public.formules f where f.code = $10`,
    [paiement, profil, montant, statut, `pay_${paiement.slice(0, 8)}`, quand, `ET-R-${paiement.slice(0, 8)}`, code ? 1000 : null, code ?? null, formule],
  );
  if (abonnement) {
    await banc.db.query(
      "insert into public.abonnements (profil_id, formule_id, paiement_id, debut, fin, cree_le) select $1, f.id, $2, $3, $4, $5 from public.formules f where f.code = $6",
      [profil, paiement, abonnement.debut, abonnement.fin, quand, formule],
    );
  }
}

beforeAll(async () => {
  [banc, vide] = await Promise.all([creerBanc(migrationsJusqua("0062")), creerBanc(migrationsJusqua("0062"))]);
  for (const b of [banc, vide]) await b.creerCompte(S, ["super_admin"]);
  await banc.creerCompte(M);
  await banc.en({ id: S }, "select public.changer_role($1, 'moderateur')", [M]);
  const etudiants: [string, string, string][] = [[E1, "Aïcha", "2026-09-10T10:00:00+01:00"], [E2, "Koffi", "2026-11-03T10:00:00+01:00"], [E3, "Rodrigue", "2026-11-10T10:00:00+01:00"], [E4, "Fifamè", "2026-10-20T10:00:00+01:00"]];
  for (const [id, prenom, cree] of etudiants) {
    await banc.creerCompte(id);
    await banc.db.query("update public.profils set prenom = $2, nom = 'Test', cree_le = $3 where id = $1", [id, prenom, cree]);
  }
  await banc.db.query("update public.profils set cree_le = '2026-01-01' where id in ($1, $2)", [S, M]);
  await banc.db.query("insert into public.codes_promo (code, type, valeur) values ('PROMO', 'montant', 1000)");

  await payer(E4, "standard", 15000, "reussi", "2026-08-19T10:00:00+01:00", { debut: "2026-08-19T10:00:00+01:00", fin: "2026-11-19T10:00:00+01:00" });
  await payer(E1, "standard", 15000, "reussi", "2026-09-12T10:00:00+01:00", { debut: "2026-09-12T10:00:00+01:00", fin: "2026-12-12T10:00:00+01:00" });
  await payer(E2, "basique", 9000, "reussi", "2026-11-04T10:00:00+01:00", { debut: "2026-11-04T10:00:00+01:00", fin: "2027-02-04T10:00:00+01:00" }, "PROMO");
  await payer(E1, "standard", 15000, "reussi", "2026-11-05T10:00:00+01:00", { debut: "2026-12-12T10:00:00+01:00", fin: "2027-03-12T10:00:00+01:00" });
  await payer(E3, "basique", 9000, "echoue", "2026-11-15T08:00:00+01:00");
  await payer(E4, "standard", 15000, "en_attente", "2026-11-15T11:00:00+01:00");

  const f = (await un<{ id: string }>("insert into public.formations (titre, slug, statut) values ('Excel', $1, 'publiee') returning id", [randomUUID()])).id;
  await banc.db.query("insert into public.formations (titre, slug) values ('Brouillon', $1)", [randomUUID()]);
  const m = (await un<{ id: string }>("insert into public.modules (formation_id, titre, ordre) values ($1, 'M', 1) returning id", [f])).id;
  const lecon = async (titre: string, type: string, ordre: number, publiee: boolean) =>
    (await un<{ id: string }>("insert into public.lecons (module_id, titre, type, publiee, ordre) values ($1, $2, $3, $5, $4) returning id", [m, titre, type, ordre, publiee])).id;
  // Le quiz reste non publié (il lui faudrait des questions) : la progression compte les 2 leçons publiées.
  const [L1, L2, Q] = [await lecon("Tableaux", "lecon", 1, true), await lecon("Graphiques", "lecon", 2, true), await lecon("Quiz", "quiz", 3, false)];
  const progression = "insert into public.progression_lecons (profil_id, lecon_id, passages, vue_le, ouverte_le, terminee_le) values ($1, $2, $3::int4multirange, $4, $5, $6)";
  await banc.db.query(progression, [E1, L1, "{[0,120)}", "2026-11-10T10:00:00+01:00", "2026-11-01T10:00:00+01:00", "2026-11-10T10:00:00+01:00"]);
  await banc.db.query(progression, [E1, L2, "{}", "2026-11-10T10:00:00+01:00", "2026-11-02T10:00:00+01:00", "2026-11-10T10:00:00+01:00"]);
  await banc.db.query(progression, [E2, L1, "{[0,60)}", "2026-11-12T10:00:00+01:00", "2026-11-12T10:00:00+01:00", null]);
  // Les deux leçons terminées délivrent le certificat (0033) : sa date est fixée pour le test.
  await banc.db.query(
    `insert into public.certificats (identifiant, profil_id, formation_id, titulaire, formation_titre, delivre_le) values ('ET-1', $1, $2, 'Aïcha', 'Excel', '2026-11-10')
     on conflict on constraint certificats_un_par_formation do update set delivre_le = excluded.delivre_le`,
    [E1, f],
  );
  await banc.db.query("insert into public.tentatives_quiz (profil_id, lecon_id, numero, bonnes, total, score, cree_le) values ($1, $3, 1, 4, 5, 80, '2026-11-08T10:00:00+01:00'), ($2, $3, 1, 2, 4, 50, '2026-11-12T10:00:00+01:00')", [E1, E2, Q]);
  await banc.db.query("insert into public.avis (profil_id, formation_id, note, masque) values ($1, $3, 4, false), ($2, $3, 2, true)", [E1, E2, f]);
  // Relecture : le certificat d'un compte supprimé ne compte pas dans l'achèvement (qui ne dépasse jamais 100 %).
  await banc.db.query("insert into public.certificats (identifiant, profil_id, formation_id, titulaire, formation_titre, delivre_le) values ('ET-2', null, $1, 'Ancien', 'Excel', '2026-09-01')", [f]);
});

describe("Migration 0062 : la vue d'ensemble", () => {
  it("les six indicateurs, les abonnements par mois, les formules", async () => {
    const v = await en<Record<string, unknown>>(banc, S, "select public.vue_ensemble_back_office($1) as r", [MAINTENANT]);
    expect(v).toMatchObject({
      utilisateurs: { total: 6, ce_mois: 2 },
      abonnes: { actifs: 3, mois_precedent: 2 },
      revenus_mois: 24000,
      formations: { total: 2, brouillons: 1 },
      // Tous les certificats délivrés, ceux des comptes supprimés compris (ils restent vérifiables).
      certificats: 2,
      taux_completion: 50,
    });
    expect(v.abonnements_par_mois).toEqual([
      { mois: "2026-06", nouveaux: 0, renouvellements: 0 },
      { mois: "2026-07", nouveaux: 0, renouvellements: 0 },
      { mois: "2026-08", nouveaux: 1, renouvellements: 0 },
      { mois: "2026-09", nouveaux: 1, renouvellements: 0 },
      { mois: "2026-10", nouveaux: 0, renouvellements: 0 },
      { mois: "2026-11", nouveaux: 1, renouvellements: 1 },
    ]);
    expect((v.formules as { code: string; part: number }[]).map((x) => [x.code, x.part])).toEqual([["basique", 33], ["standard", 67], ["premium", 0]]);
  });

  it("à traiter, dernières inscriptions, derniers paiements", async () => {
    const v = await en<Record<string, { nom: string }[] | Record<string, unknown>>>(banc, S, "select public.vue_ensemble_back_office($1) as r", [MAINTENANT]);
    expect(v.a_traiter).toMatchObject({
      a_examiner: 0,
      paiements_echoues: [{ nom: "Rodrigue Test", formule: "Basique" }],
      paiements_en_attente: [{ nom: "Fifamè Test", formule: "Standard" }],
      fins_proches: [{ nom: "Fifamè Test", formule: "Standard", jours: 4 }],
    });
    expect((v.dernieres_inscriptions as { nom: string; formule: string | null }[]).map((i) => [i.nom, i.formule])).toEqual([
      ["Rodrigue Test", null],
      ["Koffi Test", "Basique"],
      ["Fifamè Test", "Standard"],
      ["Aïcha Test", "Standard"],
    ]);
    expect((v.derniers_paiements as { nom: string; statut: string; montant: number }[]).map((p) => [p.nom, p.statut, p.montant])).toEqual([
      ["Fifamè Test", "en_attente", 15000],
      ["Rodrigue Test", "echoue", 9000],
      ["Aïcha Test", "reussi", 15000],
      ["Koffi Test", "reussi", 9000],
      ["Aïcha Test", "reussi", 15000],
    ]);
  });

  it("le modérateur n'a pas les statistiques", async () => {
    await expect(banc.en({ id: M }, "select public.vue_ensemble_back_office()")).rejects.toThrow();
    await expect(banc.en({ id: M }, "select public.statistiques_periode(30)")).rejects.toThrow();
  });
});

describe("Relecture : un compte supprimé", () => {
  it("ses paiements s'affichent « Compte supprimé »", async () => {
    await vide.db.query(
      `insert into public.paiements (profil_id, formule_id, prix_initial, montant, statut, operateur, essai_le, cree_le)
       select null, f.id, 15000, 15000, 'echoue', 'mtn', '2026-11-15T09:00:00+01:00', '2026-11-15T09:00:00+01:00' from public.formules f where f.code = 'standard'`,
    );
    const v = await en<{ derniers_paiements: { nom: string }[]; a_traiter: { paiements_echoues: { nom: string }[] } }>(vide, S, "select public.vue_ensemble_back_office($1) as r", [MAINTENANT]);
    expect(v.derniers_paiements[0].nom).toBe("Compte supprimé");
    expect(v.a_traiter.paiements_echoues[0].nom).toBe("Compte supprimé");
  });
});

describe("Migration 0062 : les statistiques par période", () => {
  it("étudiants sur 30 jours", async () => {
    const s = await en<{ etudiants: Record<string, unknown> }>(banc, S, "select public.statistiques_periode(30, $1) as r", [MAINTENANT]);
    expect(s.etudiants).toEqual({
      inscrits: 3,
      courbe: [
        { debut: "2026-10-12", nombre: 0 },
        { debut: "2026-10-19", nombre: 1 },
        { debut: "2026-10-26", nombre: 0 },
        { debut: "2026-11-02", nombre: 1 },
        { debut: "2026-11-09", nombre: 1 },
      ],
      actifs: 2,
      lecons_terminees: 2,
      formations_terminees: 1,
      quiz: { passes: 2, reussis: 1 },
      exercices_valides: 0,
      secondes_video: 180,
    });
  });

  it("formations et business sur 30 jours", async () => {
    const s = await en<{ formations: Record<string, unknown>[]; business: Record<string, unknown> }>(banc, S, "select public.statistiques_periode(30, $1) as r", [MAINTENANT]);
    expect(s.formations).toEqual([
      expect.objectContaining({ titre: "Excel", statut: "publiee", suiveurs: 2, nouveaux: 2, progression: 50, achevement: 50, secondes_video: 180, note: 4, avis: 1, certificats: 1 }),
    ]);
    expect(s.business).toMatchObject({
      abonnes_actifs: 3,
      nouveaux: 1,
      renouvellements: 1,
      revenus: 24000,
      conversion: 67,
      codes_promo: { utilisations: 1, remise: 1000 },
    });
    expect((s.business.formules as { code: string; nombre: number }[]).map((x) => [x.code, x.nombre])).toEqual([["basique", 1], ["standard", 1], ["premium", 0]]);
    expect(s.business.courbe).toEqual([
      { debut: "2026-10-12", montant: 0 },
      { debut: "2026-10-19", montant: 0 },
      { debut: "2026-10-26", montant: 0 },
      { debut: "2026-11-02", montant: 24000 },
      { debut: "2026-11-09", montant: 0 },
    ]);
  });

  it("12 mois : la courbe par mois ; une période inconnue est refusée", async () => {
    const s = await en<{ etudiants: { courbe: { debut: string; nombre: number }[] } }>(banc, S, "select public.statistiques_periode(365, $1) as r", [MAINTENANT]);
    expect(s.etudiants.courbe).toHaveLength(13);
    expect(s.etudiants.courbe.at(-1)).toEqual({ debut: "2026-11-01", nombre: 2 });
    await expect(banc.en({ id: S }, "select public.statistiques_periode(45)")).rejects.toThrow("Période inconnue.");
  });

  it("Review Focus 4 : une plateforme vide donne des zéros, jamais une division par zéro", async () => {
    const v = await en<Record<string, unknown>>(vide, S, "select public.vue_ensemble_back_office($1) as r", [MAINTENANT]);
    expect(v).toMatchObject({ abonnes: { actifs: 0, mois_precedent: 0 }, revenus_mois: 0, certificats: 0, taux_completion: null });
    const s = await en<{ business: Record<string, unknown>; formations: unknown[] }>(vide, S, "select public.statistiques_periode(90, $1) as r", [MAINTENANT]);
    expect(s.business).toMatchObject({ revenus: 0, conversion: null });
    expect(s.formations).toEqual([]);
  });
});
