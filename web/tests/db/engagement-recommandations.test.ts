import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { abonner } from "./abonner";
import { creerBanc, type Banc } from "./banc";
import { creerFormation, creerParcours, MIGRATIONS_ENGAGEMENT, poserCertificat, type FormationTest } from "./engagement-banc";

// Migration 0063, partie 3 (lot 6 B, Q7 ; critère 6.5) : après une formation terminée, une suite logique est proposée ;
// puis la formation Business qui valorise une compétence commencée, les formations de ses parcours (populaires puis
// nouvelles), et le catalogue. Jamais une formation déjà commencée.

let banc: Banc;
const [E1, E2, E3, E4, E5, E6, E7, E8, E9, E10, S1, S2, ADMIN] = Array.from({ length: 13 }, () => randomUUID());
const f: Record<string, FormationTest> = {};

type Reco = { id: string; slug: string; titre: string; motif: string; message: string | null };
const recos = async (qui: string, nombre = 3) => (await banc.en<{ r: Reco[] }>({ id: qui }, "select public.recommandations_pour_moi($1) as r", [nombre]))[0].r;
const ouvrir = (qui: string, formation: FormationTest) =>
  banc.db.query("insert into public.progression_lecons (profil_id, lecon_id) values ($1, $2) on conflict do nothing", [qui, formation.lecons[0]]);

beforeAll(async () => {
  banc = await creerBanc(MIGRATIONS_ENGAGEMENT);
  for (const id of [E1, E2, E3, E4, E5, E6, E7, E8, E9, E10, S1, S2]) await banc.creerCompte(id);
  await banc.creerCompte(ADMIN, ["admin"]);
  const P = await creerParcours(banc, "Réussite académique");
  const D = await creerParcours(banc, "Compétences digitales", "digital");
  const BU = await creerParcours(banc, "Business", "business");
  const Q = await creerParcours(banc, "Méthodologie");
  const options = { quiz: false, exercice: null } as const;
  f.A = await creerFormation(banc, "Word", { ...options, parcours: [P], ordre: 1 });
  f.B = await creerFormation(banc, "Zotero", { ...options, parcours: [P], ordre: 2 });
  f.C = await creerFormation(banc, "Mémoire", { ...options, parcours: [P], ordre: 3 });
  f.W1 = await creerFormation(banc, "Brouillon", { ...options, parcours: [P], ordre: 4, statut: "brouillon" });
  f.W2 = await creerFormation(banc, "Archivée", { ...options, parcours: [P], ordre: 5, statut: "archivee" });
  f.W3 = await creerFormation(banc, "Désactivée", { ...options, parcours: [P], ordre: 6, statut: "desactivee" });
  f.K = await creerFormation(banc, "Canva", { ...options, parcours: [D] });
  f.K2 = await creerFormation(banc, "Figma", { ...options, parcours: [D] });
  f.Z = await creerFormation(banc, "Vendre ses visuels", { ...options, parcours: [BU] });
  f.K3 = await creerFormation(banc, "CapCut", { ...options, parcours: [D] });
  f.Z2 = await creerFormation(banc, "Lancer son activité", { ...options, parcours: [BU], ordre: 1 });
  f.Z4 = await creerFormation(banc, "Accompagner ses clients", { ...options, parcours: [BU], ordre: 5 });
  f.Z3 = await creerFormation(banc, "Vendre ses maquettes", { ...options, parcours: [BU] });
  await banc.db.query("insert into public.formations_monetisation (business_id, competence_id) values ($1, $2), ($3, $4)", [f.Z.id, f.K.id, f.Z3.id, f.K2.id]);
  // Un parcours dont la première formation a un quiz : ses leçons terminées ne suffisent pas au certificat.
  const P2 = await creerParcours(banc, "Méthodes de travail");
  f.A2 = await creerFormation(banc, "Organisation", { quiz: true, exercice: null, parcours: [P2], ordre: 1 });
  f.B2 = await creerFormation(banc, "Prise de notes", { ...options, parcours: [P2], ordre: 2 });
  // Un parcours désactivé : il ne sert plus de suite ni de « ses parcours ».
  const PI = await creerParcours(banc, "Ancien parcours");
  await banc.db.query("update public.parcours set actif = false where id = $1", [PI]);
  f.AI = await creerFormation(banc, "Ancienne base", { ...options, parcours: [PI], ordre: 1 });
  f.BI = await creerFormation(banc, "Ancienne suite", { ...options, parcours: [PI], ordre: 2 });
  // Une formation payante, avec une leçon d'aperçu.
  f.PAY = await creerFormation(banc, "Payante", { ...options, gratuite: false, apercu: true });
  f.Q1 = await creerFormation(banc, "Problématique", { ...options, parcours: [Q] });
  f.Q2 = await creerFormation(banc, "Plan", { ...options, parcours: [Q], publieeLe: "now() - interval '60 days'" });
  f.Q3 = await creerFormation(banc, "Rédaction", { ...options, parcours: [Q], publieeLe: "now()" });
  f.Q4 = await creerFormation(banc, "Soutenance", { ...options, parcours: [Q], publieeLe: "now() - interval '30 days'" });
  // Popularité : deux étudiants ont commencé Q2 ; seul un admin a commencé Q3 (il ne compte pas).
  for (const qui of [S1, S2]) await ouvrir(qui, f.Q2);
  await ouvrir(ADMIN, f.Q3);
  // La popularité est calculée une fois par jour (tâche planifiée) ; ici, tout de suite.
  await banc.db.query("select public.rafraichir_popularite()");
  for (const qui of [E4, E9]) await abonner(banc, qui);
}, 60_000);

describe("Migration 0063 : les recommandations", () => {
  it("après une formation terminée : la suivante du parcours, avec son message", async () => {
    await poserCertificat(banc, E1, f.A);
    const [premiere, deuxieme] = await recos(E1);
    expect(premiere).toEqual({ id: f.B.id, slug: f.B.slug, titre: "Zotero", motif: "suite", message: "Vous avez terminé « Word ». Découvrez maintenant « Zotero »." });
    expect(deuxieme).toMatchObject({ id: f.C.id, motif: "parcours", message: null });
  });

  it("la suivante déjà commencée : celle d'après", async () => {
    await ouvrir(E1, f.B);
    const [premiere] = await recos(E1);
    expect(premiere).toMatchObject({ id: f.C.id, motif: "suite", message: "Vous avez terminé « Word ». Découvrez maintenant « Mémoire »." });
  });

  it("toutes les leçons terminées, même sans le certificat (quiz pas encore réussi) : la suite est proposée", async () => {
    for (const lecon of f.A2.lecons) {
      await banc.db.query("insert into public.progression_lecons (profil_id, lecon_id, terminee_le) values ($1, $2, now())", [E7, lecon]);
    }
    expect((await banc.db.query("select 1 from public.certificats where profil_id = $1", [E7])).rows).toEqual([]);
    const [premiere] = await recos(E7);
    expect(premiere).toMatchObject({ id: f.B2.id, motif: "suite", message: "Vous avez terminé « Organisation ». Découvrez maintenant « Prise de notes »." });
  });

  it("une compétence digitale commencée : seulement la formation Business liée ; les autres Business ne prennent pas sa place", async () => {
    await ouvrir(E2, f.K);
    const liste = await recos(E2, 12);
    expect(liste.filter((r) => r.motif === "monetisation").map((r) => r.titre)).toEqual(["Vendre ses visuels"]);
    expect(liste[0].titre).toBe("Vendre ses visuels");
    for (const autre of [f.Z2, f.Z3, f.Z4]) expect(liste.find((r) => r.id === autre.id)?.motif).not.toBe("monetisation");
  });

  it("une compétence sans formation Business liée : une seule formation « pour toutes les compétences », la première du parcours Business", async () => {
    await ouvrir(E6, f.K3);
    const liste = await recos(E6, 12);
    expect(liste.filter((r) => r.motif === "monetisation").map((r) => r.titre)).toEqual(["Lancer son activité"]);
    // Les deux autres places restent à son parcours (Compétences digitales).
    expect((await recos(E6)).map((r) => r.motif)).toEqual(["monetisation", "parcours", "parcours"]);
  });

  it("ses parcours : les plus suivies par les étudiants d'abord, puis les plus récentes", async () => {
    await ouvrir(E3, f.Q1);
    expect((await recos(E3)).map((r) => [r.titre, r.motif])).toEqual([
      ["Plan", "parcours"],
      ["Rédaction", "parcours"],
      ["Soutenance", "parcours"],
    ]);
  });

  it("le catalogue complète ; jamais une formation commencée, en brouillon, archivée ou désactivée, ni deux fois la même", async () => {
    const liste = await recos(E3, 12);
    const ids = liste.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const exclue of [f.Q1, f.W1, f.W2, f.W3]) expect(ids).not.toContain(exclue.id);
    expect(liste.slice(3).every((r) => r.motif === "catalogue")).toBe(true);
    expect(liste.length).toBe(12);
  });

  it("un parcours désactivé : ni suite, ni « ses parcours »", async () => {
    await poserCertificat(banc, E10, f.AI);
    const liste = await recos(E10, 12);
    expect(liste.find((r) => r.id === f.BI.id)?.motif).toBe("catalogue");
    expect(liste.some((r) => r.motif === "suite" || r.motif === "parcours")).toBe(false);
  });

  it("sans abonnement, une formation payante seulement entrevue (aperçu) reste recommandée ; pour un abonné, elle est commencée", async () => {
    await ouvrir(E8, f.PAY);
    expect((await recos(E8, 12)).map((r) => r.id)).toContain(f.PAY.id);
    await ouvrir(E9, f.PAY);
    expect((await recos(E9, 12)).map((r) => r.id)).not.toContain(f.PAY.id);
  });

  it("la popularité est celle du dernier calcul (une fois par jour), et personne ne la recalcule depuis l'appli", async () => {
    // Q4 devient la plus suivie, mais le classement attend le prochain calcul.
    const [T1, T2, T3] = [randomUUID(), randomUUID(), randomUUID()];
    for (const qui of [T1, T2, T3]) {
      await banc.creerCompte(qui);
      await ouvrir(qui, f.Q4);
    }
    expect((await recos(E3)).map((r) => r.titre)).toEqual(["Plan", "Rédaction", "Soutenance"]);
    await banc.db.query("select public.rafraichir_popularite()");
    expect((await recos(E3)).map((r) => r.titre)).toEqual(["Soutenance", "Plan", "Rédaction"]);
    await expect(banc.en({ id: E3 }, "select public.rafraichir_popularite()")).rejects.toThrow(/permission denied/);
  });

  it("tout est commencé : aucune recommandation", async () => {
    await banc.db.query(
      `insert into public.progression_lecons (profil_id, lecon_id)
       select $1, l.id from public.lecons l join public.modules m on m.id = l.module_id join public.formations fo on fo.id = m.formation_id
       where fo.statut = 'publiee' and l.ordre = 1`,
      [E4],
    );
    expect(await recos(E4)).toEqual([]);
  });

  it("entre 1 et 12 recommandations ; sans compte : refusé", async () => {
    expect(await recos(E5, 0)).toHaveLength(1);
    expect(await recos(E5, 50)).toHaveLength(12);
    await expect(banc.en("anon", "select public.recommandations_pour_moi(3)")).rejects.toThrow();
  });
});
