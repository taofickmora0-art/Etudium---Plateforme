import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { creerBanc, migrationsJusqua, type Banc, type Qui } from "./banc";

// Migration 0081 (demande du 12 novembre 2026) : SasPay en secours de Payiz, pour les pays et les opérateurs que Payiz
// n'encaisse pas. L'identifiant chez SasPay est gardé dans payiz_id, préfixé « softpay: ».
//   - Après un échec, un nouvel essai peut porter un autre identifiant (SasPay crée une demande à chaque essai ; un
//     réessai peut aussi changer de prestataire). Tant qu'une demande attend, l'identifiant ne change pas.
//   - Les notifications de SasPay relisent les paiements SasPay en attente depuis moins de 24 h (jeton du serveur).

const MIGRATION = "supabase/migrations/0081_saspay_secours.sql";

let banc: Banc;
const [E, G] = Array.from({ length: 2 }, () => randomUUID());
const J = "j".repeat(40); // le jeton du serveur
let standard: string;

const rpc = async <T>(qui: Qui, sql: string, params: unknown[] = []) => (await banc.en<{ r: T }>(qui, sql, params))[0].r;
const refus = (p: Promise<unknown>) => p.then(() => "accepté", (e: Error) => e.message);
const paiement = async (profil: string, champs: Record<string, unknown> = {}) => {
  const colonnes = { profil_id: profil, formule_id: standard, prix_initial: 15000, montant: 15000, ...champs };
  const noms = Object.keys(colonnes);
  const { rows } = await banc.db.query<{ id: string }>(
    `insert into public.paiements (${noms.join(", ")}) values (${noms.map((_, i) => `$${i + 1}`).join(", ")}) returning id`,
    Object.values(colonnes),
  );
  return rows[0].id;
};
const noterEssai = (id: string, ref: string) =>
  rpc<{ statut: string; payiz_id: string }>("anon", "select public.noter_essai($1, $2, 'orange_ci', '+225 •• •• •• •• 00', $3, 'CIV', 'Orange Money') as r", [id, ref, J]);
const noterEchec = (id: string) => rpc("anon", "select public.noter_echec($1, 'echoue', 'insufficient_funds', $2) as r", [id, J]);
const enAttente = (jeton = J) => rpc<{ id: string; ref: string; montant: number }[]>("anon", "select public.paiements_softpay_en_attente($1) as r", [jeton]);

beforeAll(async () => {
  banc = await creerBanc(migrationsJusqua("0080"));
  for (const id of [E, G]) await banc.creerCompte(id);
  standard = (await banc.db.query<{ id: string }>("select id from public.formules where code = 'standard'")).rows[0].id;
  await banc.db.query("update public.formules set prix_fcfa = 15000 where code = 'standard'");
  await banc.appliquer(MIGRATION);
  await banc.db.query("update public.reglages_paiement set ouverts = true, empreinte = encode(sha256(convert_to($1::text, 'UTF8')), 'hex')", [J]);
}, 180_000);

describe("Un nouvel essai après un échec", () => {
  it("prend le nouvel identifiant (SasPay, ou changement de prestataire) ; une demande en attente le garde", async () => {
    const id = await paiement(E);
    expect((await noterEssai(id, "softpay:a1")).payiz_id).toBe("softpay:a1");
    // Une demande attend sur le téléphone : pas de seconde demande sur ce paiement.
    expect(await refus(noterEssai(id, "softpay:a2"))).toBe("Paiement Payiz différent.");
    await noterEchec(id);
    const carte = await noterEssai(id, "softpay:a2");
    expect(carte).toMatchObject({ statut: "en_attente", payiz_id: "softpay:a2" });
    // Puis chez Payiz : l'échec d'avant le permet aussi.
    await noterEchec(id);
    expect((await noterEssai(id, "pay_123")).payiz_id).toBe("pay_123");
  });
});

describe("Un échec qui arrive en retard (revue)", () => {
  it("ne touche pas la demande suivante : noter_echec ignore une autre référence que celle notée", async () => {
    const id = await paiement(E);
    await noterEssai(id, "pay_ancien");
    await noterEchec(id);
    await noterEssai(id, "softpay:nouveau");
    // Payiz dit, en retard, que son ancien paiement a expiré : la demande SasPay en cours reste en attente.
    const carte = await rpc<{ statut: string }>("anon", "select public.noter_echec($1, 'expire', null, $2, 'pay_ancien') as r", [id, J]);
    expect(carte.statut).toBe("en_attente");
    // La bonne référence, ou l'ancien appel sans référence (l'appli d'avant cette version) : appliqué.
    expect((await rpc<{ statut: string }>("anon", "select public.noter_echec($1, 'echoue', 'timeout', $2, 'softpay:nouveau') as r", [id, J])).statut).toBe("echoue");
    await noterEssai(id, "softpay:encore");
    expect((await rpc<{ statut: string }>("anon", "select public.noter_echec($1, 'echoue', 'timeout', $2) as r", [id, J])).statut).toBe("echoue");
  });
});

describe("Les paiements SasPay en attente", () => {
  it("ceux de moins de 24 h, de tous les comptes, sans ceux de Payiz ; jamais sans le jeton", async () => {
    const recent = await paiement(G, { payiz_id: "softpay:r1", essai_le: new Date().toISOString() });
    await paiement(G, { payiz_id: "softpay:vieux", essai_le: new Date(Date.now() - 25 * 3600_000).toISOString() });
    await paiement(G, { payiz_id: "pay_payiz", essai_le: new Date().toISOString() });
    await paiement(G, { payiz_id: "softpay:fini", statut: "echoue", essai_le: new Date().toISOString() });
    const liste = await enAttente();
    expect(liste).toContainEqual({ id: recent, ref: "softpay:r1", montant: 15000 });
    expect(liste.some((l) => ["softpay:vieux", "pay_payiz", "softpay:fini"].includes(l.ref))).toBe(false);
    expect(await refus(enAttente("mauvais"))).toMatch(/Jeton/);
  });
});
