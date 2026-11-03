import { randomUUID } from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { creerBanc, migrationsJusqua, type Banc, type Qui } from "./banc";

// Migration 0073 : un code promo valable seulement pour les abonnements choisis (demande du 3 novembre 2026).
//   - Une table de liaison codes_promo_formules ; les codes d'avant valent pour tous les abonnements.
//   - « Appliquer » et la préparation du paiement refusent un abonnement non coché, en le nommant.
//   - enregistrer_code_promo reçoit la liste des abonnements et refuse une liste vide ; l'appli d'avant (8 paramètres)
//     marche encore : un nouveau code vaut pour tous, une modification garde ceux du code.
//   - codes_promo_equipe renvoie les abonnements de chaque code.

const MIGRATION = "supabase/migrations/0073_codes_promo_formules.sql";

let banc: Banc;
const [A, M, E, G] = Array.from({ length: 4 }, () => randomUUID());
// A : admin ; M : modérateur ; E : étudiante ; G : étudiant.
const formules: Record<string, string> = {};
let ancien: string;

type Champs = { id?: string | null; code: string; valeur?: number; actif?: boolean };
type CodeEquipe = { id: string; code: string; formules: { id: string; code: string; nom: string; duree_mois: number }[] };

const rpc = async <T>(qui: Qui, sql: string, params: unknown[] = []) => (await banc.en<{ r: T }>(qui, sql, params))[0].r;
const champs = (c: Champs) => [c.id ?? null, c.code, "pourcentage", c.valeur ?? 20, null, null, null, c.actif ?? true];
/** L'appli d'avant cette version : 8 paramètres, sans les abonnements. */
const enregistrerAvant = (qui: string, c: Champs) =>
  rpc<string>({ id: qui }, "select public.enregistrer_code_promo($1, $2, $3, $4, $5, $6, $7, $8) as r", champs(c));
const enregistrer = (qui: string, c: Champs, abonnements: string[]) =>
  rpc<string>({ id: qui }, "select public.enregistrer_code_promo($1, $2, $3, $4, $5, $6, $7, $8, $9::uuid[]) as r", [...champs(c), abonnements]);
const essayer = (qui: string, code: string, formule: string) =>
  rpc<{ ok: boolean; message?: string; remise?: number; montant?: number }>({ id: qui }, "select public.essayer_code($1, $2) as r", [code, formule]);
const preparer = (qui: string, formule: string, code: string) =>
  rpc<{ montant: number }>({ id: qui }, "select public.preparer_paiement($1, $2) as r", [formule, code]);
const codesEquipe = () => rpc<CodeEquipe[]>({ id: A }, "select public.codes_promo_equipe() as r");
const abonnementsDe = async (code: string) => (await codesEquipe()).find((c) => c.code === code)?.formules.map((f) => f.code);

beforeAll(async () => {
  banc = await creerBanc(migrationsJusqua("0072"));
  for (const [id, roles] of [[A, ["admin"]], [M, ["moderateur"]], [E, []], [G, []]] as const) await banc.creerCompte(id, [...roles]);
  for (const { id, code } of (await banc.db.query<{ id: string; code: string }>("select id, code from public.formules")).rows) formules[code] = id;
  await banc.db.query("update public.formules set prix_fcfa = case code when 'basique' then 9000 when 'standard' then 15000 else 25000 end");

  // Avant la 0073 : un code créé par le back-office d'alors.
  ancien = await enregistrerAvant(A, { code: "ANCIEN", valeur: 10 });
  await banc.appliquer(MIGRATION);
});

// La limite d'essais de codes (10 par 10 minutes, 0053) ne doit pas gêner les tests.
beforeEach(async () => {
  await banc.db.query("delete from public.essais_codes");
});

describe("Les codes d'avant", () => {
  it("valent pour les trois abonnements, comme avant", async () => {
    expect(await abonnementsDe("ANCIEN")).toEqual(["basique", "standard", "premium"]);
    expect(await essayer(E, "ANCIEN", formules.basique)).toMatchObject({ ok: true, remise: 900, montant: 8100 });
    expect(await essayer(E, "ANCIEN", formules.standard)).toMatchObject({ ok: true, remise: 1500, montant: 13500 });
    expect(await essayer(E, "ANCIEN", formules.premium)).toMatchObject({ ok: true, remise: 2500, montant: 22500 });
  });
});

describe("Un code pour les abonnements choisis", () => {
  it("restreint à Basique : refusé pour Standard, avec le nom de l'abonnement ; accepté pour Basique", async () => {
    await enregistrer(A, { code: "BASIQUE10", valeur: 10 }, [formules.basique]);
    expect(await essayer(E, "BASIQUE10", formules.standard)).toMatchObject({ ok: false, message: "Ce code ne s’applique pas à l’abonnement Standard." });
    expect(await essayer(E, "basique10", formules.premium)).toMatchObject({ ok: false, message: "Ce code ne s’applique pas à l’abonnement Premium." });
    expect(await essayer(E, "BASIQUE10", formules.basique)).toMatchObject({ ok: true, remise: 900, montant: 8100 });
  });

  it("le refus dit qu'un autre abonnement peut convenir (l'écran revérifie au changement d'abonnement)", async () => {
    expect(await essayer(E, "BASIQUE10", formules.standard)).toMatchObject({ ok: false, motif: "abonnement" });
    expect(await essayer(E, "INCONNU", formules.standard)).not.toHaveProperty("motif");
  });

  it("la préparation du paiement refuse aussi, avec le même message", async () => {
    await expect(preparer(G, formules.standard, "BASIQUE10")).rejects.toThrow("Ce code ne s’applique pas à l’abonnement Standard.");
    const { rows } = await banc.db.query("select 1 from public.paiements where profil_id = $1", [G]);
    expect(rows).toHaveLength(0);
  });

  it("plusieurs abonnements : chacun dans son ordre, les autres refusés", async () => {
    await enregistrer(A, { code: "DEUX" }, [formules.premium, formules.basique, formules.premium]);
    expect(await abonnementsDe("DEUX")).toEqual(["basique", "premium"]);
    expect(await essayer(G, "DEUX", formules.premium)).toMatchObject({ ok: true });
    expect(await essayer(G, "DEUX", formules.standard)).toMatchObject({ ok: false, message: "Ce code ne s’applique pas à l’abonnement Standard." });
  });
});

describe("Enregistrer un code", () => {
  it("au moins un abonnement, et des abonnements connus", async () => {
    await expect(enregistrer(A, { code: "AUCUN" }, [])).rejects.toThrow("Choisissez au moins un abonnement.");
    await expect(enregistrer(A, { code: "INCONNU" }, [randomUUID()])).rejects.toThrow("Abonnement inconnu.");
    const { rows } = await banc.db.query("select 1 from public.codes_promo where code in ('AUCUN', 'INCONNU')");
    expect(rows).toHaveLength(0);
  });

  it("seuls les administrateurs", async () => {
    await expect(enregistrer(M, { code: "MODO" }, [formules.basique])).rejects.toThrow("Réservé aux administrateurs.");
    await expect(enregistrer(E, { code: "ETUDIANTE" }, [formules.basique])).rejects.toThrow();
  });

  it("modifier remplace ses abonnements ; une liste vide est refusée et ne change rien", async () => {
    const id = await enregistrer(A, { code: "CHANGE" }, [formules.basique]);
    expect(await enregistrer(A, { id, code: "CHANGE" }, [formules.standard, formules.premium])).toBe(id);
    expect(await abonnementsDe("CHANGE")).toEqual(["standard", "premium"]);
    await expect(enregistrer(A, { id, code: "CHANGE", valeur: 50 }, [])).rejects.toThrow("Choisissez au moins un abonnement.");
    expect(await abonnementsDe("CHANGE")).toEqual(["standard", "premium"]);
    const { rows } = await banc.db.query<{ valeur: number }>("select valeur from public.codes_promo where id = $1", [id]);
    expect(rows[0].valeur).toBe(20);
  });

  it("l'appli d'avant (sans la liste) : un nouveau code vaut pour tous, une modification garde ses abonnements", async () => {
    await enregistrerAvant(A, { code: "DEPUIS_AVANT" });
    expect(await abonnementsDe("DEPUIS_AVANT")).toEqual(["basique", "standard", "premium"]);
    const id = await enregistrer(A, { code: "GARDE" }, [formules.premium]);
    await enregistrerAvant(A, { id, code: "GARDE", actif: false });
    expect(await abonnementsDe("GARDE")).toEqual(["premium"]);
  });
});

describe("La table des abonnements d'un code", () => {
  it("lue par l'équipe seulement ; personne n'y écrit directement", async () => {
    expect(await banc.en({ id: E }, "select * from public.codes_promo_formules")).toEqual([]);
    expect((await banc.en({ id: A }, "select * from public.codes_promo_formules where code_id = $1", [ancien])).length).toBe(3);
    await expect(banc.en({ id: A }, "insert into public.codes_promo_formules (code_id, formule_id) values ($1, $2)", [ancien, formules.basique])).rejects.toThrow();
    await expect(banc.en({ id: A }, "delete from public.codes_promo_formules where code_id = $1", [ancien])).rejects.toThrow();
  });

  it("un code supprimé emporte ses abonnements", async () => {
    const id = await enregistrer(A, { code: "EPHEMERE" }, [formules.basique]);
    await banc.db.query("delete from public.codes_promo where id = $1", [id]);
    const { rows } = await banc.db.query("select 1 from public.codes_promo_formules where code_id = $1", [id]);
    expect(rows).toHaveLength(0);
  });
});

describe("Rejouable", () => {
  it("une seconde application ne change rien : un code restreint le reste", async () => {
    const lire = async () => (await banc.db.query("select code_id, formule_id from public.codes_promo_formules order by code_id, formule_id")).rows;
    const avant = await lire();
    await banc.appliquer(MIGRATION);
    expect(await lire()).toEqual(avant);
    expect(await abonnementsDe("BASIQUE10")).toEqual(["basique"]);
    expect(await essayer(E, "BASIQUE10", formules.standard)).toMatchObject({ ok: false, message: "Ce code ne s’applique pas à l’abonnement Standard." });
  });
});
