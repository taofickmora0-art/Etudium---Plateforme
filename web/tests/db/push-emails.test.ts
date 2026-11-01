import { randomUUID } from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { abonner } from "./abonner";
import { creerBanc, migrationsJusqua, type Banc, type Qui } from "./banc";

// Migration 0058 : les notifications push et les e-mails importants (lot 5, étape B). Une file d'envoi : le push suit
// les notifications de l'appli (pour qui a un appareil) ; l'e-mail part pour ce qui est important (abonnement,
// paiement, compte), même si l'appli est coupée. Le serveur prend la file avec un jeton, puis termine chaque envoi.

let banc: Banc;
let JETON: string;
const S = randomUUID(); // super admin
const A = randomUUID();
const B = randomUUID();
const C = randomUUID();
const E = randomUUID();

type Envoi = { id: string; canal: string; destinataire: string; titre: string; texte: string; lien: string | null; statut: string; essais: number };
type Pris = { id: number; prise: string; cree_le: string; canal: string; titre: string; email: string | null; appareils: { adresse: string; p256dh: string; auth: string }[] };

const envois = async () => (await banc.db.query<Envoi>("select id, canal, destinataire, titre, texte, lien, statut, essais from public.envois order by id")).rows;
const appareil = (qui: string, adresse: string) =>
  banc.en({ id: qui }, "select public.enregistrer_appareil($1, $2, $3)", [adresse, "B" + "x".repeat(86), "a".repeat(22)]);
const notifier = (qui: string[], categorie: string, titre: string, lien = "/accueil") =>
  banc.db.query("select public.notifier($1::uuid[], $2, $3, 'Texte', $4, true)", [qui, categorie, titre, lien]);
const prendre = async (qui: Qui, jeton: string, canaux: string[], limite = 20) =>
  (await banc.en<{ r: Pris[] }>(qui, "select public.prendre_envois($1, $2, $3) as r", [jeton, canaux, limite]))[0].r;
const terminer = (e: Pris, reussi: boolean, erreur: string | null = null, disparus: string[] = []) =>
  banc.en("anon", "select public.terminer_envoi($1, $2, $3, $4, $5, $6)", [JETON, e.id, e.prise, reussi, erreur, disparus]);

beforeAll(async () => {
  banc = await creerBanc(migrationsJusqua("0058"));
  for (const [id, roles] of [[S, ["super_admin"]], [A, []], [B, []], [C, []], [E, []]] as const) await banc.creerCompte(id, [...roles]);
  await banc.db.query("update public.profils set prenom = 'Aïcha' where id = $1", [E]);
  JETON = (await banc.db.query<{ j: string }>("select public.nouveau_jeton_envois() as j")).rows[0].j;
});
beforeEach(async () => {
  await banc.db.query("delete from public.envois");
});

describe("Migration 0058 : push et e-mails", () => {
  it("le jeton : 64 caractères, seule son empreinte est gardée ; personne ne l'appelle depuis l'appli", async () => {
    expect(JETON).toMatch(/^[0-9a-f]{64}$/);
    const { empreinte } = (await banc.db.query<{ empreinte: string }>("select empreinte from public.reglages_envois")).rows[0];
    expect(empreinte).not.toContain(JETON);
    await expect(banc.en({ id: S }, "select public.nouveau_jeton_envois()")).rejects.toThrow(/permission/);
  });

  it("appareils : enregistrer ; une adresse reprise par un autre compte ; 10 au plus ; chacun retire les siens", async () => {
    await appareil(A, "https://fcm.googleapis.com/fcm/send/a1");
    await appareil(B, "https://fcm.googleapis.com/fcm/send/a1");
    const proprietaire = async (adresse: string) =>
      (await banc.db.query<{ profil_id: string }>("select profil_id from public.appareils_push where adresse = $1", [adresse])).rows[0]?.profil_id;
    expect(await proprietaire("https://fcm.googleapis.com/fcm/send/a1")).toBe(B);
    for (let i = 0; i < 11; i++) await appareil(A, `https://fcm.googleapis.com/fcm/send/a-${i}`);
    expect((await banc.db.query("select 1 from public.appareils_push where profil_id = $1", [A])).rows).toHaveLength(10);
    await banc.en({ id: A }, "select public.retirer_appareil($1)", ["https://fcm.googleapis.com/fcm/send/a1"]);
    expect(await proprietaire("https://fcm.googleapis.com/fcm/send/a1")).toBe(B);
    await expect(appareil(A, "http://pas-https.exemple/x")).rejects.toThrow();
    // Relecture (4) : une adresse qui n'est pas celle d'un service de push (serveur interne…) est refusée.
    await expect(appareil(A, "https://intranet.exemple/x")).rejects.toThrow();
    await expect(appareil(A, "https://fcm.googleapis.com.ailleurs.exemple/x")).rejects.toThrow();
    for (const adresse of ["https://updates.push.services.mozilla.com/wpush/v2/x", "https://web.push.apple.com/x", "https://wns2-par02p.notify.windows.com/w/?token=x"]) {
      await appareil(C, adresse);
    }
    await banc.db.query("delete from public.appareils_push where profil_id = $1", [C]);
    expect(await banc.en({ id: C }, "select adresse from public.appareils_push")).toEqual([]);
    await banc.db.query("delete from public.appareils_push");
  });

  it("push (Review Focus 1) : une notification pour 3 comptes, dont 1 avec un appareil → 1 envoi ; push coupé → aucun", async () => {
    await appareil(B, "https://fcm.googleapis.com/fcm/send/b1");
    await notifier([A, B, C], "messages", "Nouveau message");
    expect((await envois()).map((e) => [e.canal, e.destinataire, e.titre])).toEqual([["push", B, "Nouveau message"]]);
    await banc.db.query(`update public.profils set preferences_notifications = preferences_notifications || '{"canal_push": false}' where id = $1`, [B]);
    await notifier([B], "messages", "Encore un");
    expect(await envois()).toHaveLength(1);
    await banc.db.query(`update public.profils set preferences_notifications = preferences_notifications - 'canal_push' where id = $1`, [B]);
  });

  it("e-mail : un rappel d'abonnement part même si l'appli est coupée ; une notification ordinaire, non", async () => {
    await banc.db.query(`update public.profils set preferences_notifications = preferences_notifications || '{"canal_appli": false}' where id = $1`, [C]);
    await notifier([C], "expiration_renouvellement", "Votre abonnement expire demain", "/abonnement/souscrire");
    await notifier([C], "messages", "Nouveau message", "/messages");
    expect((await envois()).map((e) => [e.canal, e.titre, e.lien])).toEqual([["email", "Votre abonnement expire demain", "/abonnement/souscrire"]]);
    expect((await banc.db.query("select 1 from public.notifications where destinataire = $1 and titre = 'Votre abonnement expire demain'", [C])).rows).toHaveLength(0);
    // Une notification de service qui mène à l'abonnement est importante ; une autre, non.
    await notifier([A], "service", "Votre abonnement est annulé", "/abonnement");
    await notifier([A], "service", "Votre formation est publiée", "/formateur/formations");
    expect((await envois()).filter((e) => e.destinataire === A).map((e) => e.titre)).toEqual(["Votre abonnement est annulé"]);
  });

  it("Paiement reçu : un paiement en ligne confirmé crée la notification et l'e-mail ; un abonnement manuel, non", async () => {
    await abonner(banc, E);
    const notif = (await banc.db.query<{ titre: string; texte: string; lien: string }>("select titre, texte, lien from public.notifications where destinataire = $1", [E])).rows;
    expect(notif).toHaveLength(1);
    expect(notif[0].titre).toBe("Paiement reçu : votre abonnement Standard est actif");
    expect(notif[0].texte).toMatch(/^Jusqu’au .+\. Votre reçu : ET-R-TEST-/);
    expect(notif[0].lien).toMatch(/^\/abonnement\/recus\/ET-R-TEST-/);
    expect((await envois()).filter((e) => e.destinataire === E).map((e) => e.canal)).toEqual(["email"]);
    // Un abonnement attribué à la main a déjà sa notification (0054) : pas de « Paiement reçu ».
    await banc.db.query("delete from public.notifications where destinataire = $1", [E]);
    const formule = (await banc.db.query<{ id: string }>("select id from public.formules where code = 'standard'")).rows[0].id;
    const manuel = (await banc.db.query<{ id: string }>(
      `insert into public.paiements (profil_id, formule_id, prix_initial, montant, statut, source, moyen_manuel, confirme_le, numero_recu)
       values ($1, $2, 15000, 15000, 'reussi', 'manuel', 'especes', now(), 'ET-R-MANUEL-1') returning id`,
      [E, formule],
    )).rows[0].id;
    await banc.db.query("insert into public.abonnements (profil_id, formule_id, paiement_id, debut, fin) values ($1, $2, $3, now(), now() + interval '30 days')", [E, formule, manuel]);
    expect((await banc.db.query("select 1 from public.notifications where destinataire = $1", [E])).rows).toHaveLength(0);
  });

  it("suspension et réactivation : un e-mail chaque fois", async () => {
    await banc.db.query("insert into public.suspensions (profil_id, par) values ($1, $2)", [A, S]);
    await banc.db.query("delete from public.suspensions where profil_id = $1", [A]);
    expect((await envois()).filter((e) => e.canal === "email" && e.destinataire === A).map((e) => [e.titre, e.texte, e.lien])).toEqual([
      // Relecture (5) : un compte suspendu n'ouvre plus l'appli ; il répond à l'e-mail.
      ["Votre compte Étudium est suspendu", "Pour en savoir plus, répondez à cet e-mail : l’équipe Étudium vous lira.", null],
      ["Votre compte Étudium est réactivé", "Vous retrouvez tous vos accès.", "/accueil"],
    ]);
  });

  it("relecture (2) : supprimer un compte suspendu (tableau de bord Supabase) n'est pas bloqué par son e-mail", async () => {
    const X = randomUUID();
    await banc.creerCompte(X, []);
    await banc.db.query("insert into public.suspensions (profil_id, par) values ($1, $2)", [X, S]);
    await banc.db.query("delete from auth.users where id = $1", [X]);
    expect((await banc.db.query("select 1 from public.profils where id = $1", [X])).rows).toHaveLength(0);
    expect((await envois()).filter((e) => e.destinataire === X).map((e) => e.titre)).toEqual([]);
  });

  it("relecture (3) : une fin tardive (réservation expirée, envoi repris et fait ailleurs) ne change rien", async () => {
    await appareil(B, "https://fcm.googleapis.com/fcm/send/b3");
    await notifier([B], "messages", "Une seule fois");
    const [premier] = await prendre("anon", JETON, ["push"]);
    // Le premier serveur dépasse ses 2 minutes : un second reprend l'envoi et le réussit.
    await banc.db.query("update public.envois set pris_le = now() - interval '3 minutes' where id = $1", [premier.id]);
    const [second] = await prendre("anon", JETON, ["push"]);
    expect(second.id).toBe(premier.id);
    expect(second.prise).not.toBe(premier.prise);
    await terminer(second, true);
    await terminer(premier, false, "Délai dépassé");
    const ligne = (await banc.db.query<{ statut: string; erreur: string | null }>("select statut, erreur from public.envois where id = $1", [premier.id])).rows[0];
    expect(ligne).toEqual({ statut: "envoye", erreur: null });
    await banc.db.query("delete from public.appareils_push where adresse = 'https://fcm.googleapis.com/fcm/send/b3'");
  });

  it("prendre_envois : jeton faux refusé ; seulement les canaux demandés ; deux prises ne prennent pas les mêmes envois (Review Focus 2)", async () => {
    await appareil(B, "https://fcm.googleapis.com/fcm/send/b1");
    await notifier([B], "messages", "Push 1");
    await notifier([A, B], "expiration_renouvellement", "Rappel", "/abonnement/souscrire");
    await expect(prendre("anon", "faux", ["email"])).rejects.toThrow(/Jeton d’envoi non reconnu/);
    const emails = await prendre("anon", JETON, ["email"], 1);
    expect(emails).toHaveLength(1);
    expect(emails[0]).toMatchObject({ canal: "email", titre: "Rappel" });
    expect(emails[0].email).toMatch(/@exemple\.com$/);
    const suite = await prendre("anon", JETON, ["email"], 5);
    expect(suite.map((e) => e.id)).not.toContain(emails[0].id);
    expect(suite).toHaveLength(1);
    expect(await prendre("anon", JETON, ["email"], 5)).toEqual([]);
    const push = await prendre({ id: A }, JETON, ["push"], 5);
    expect(push.map((p) => p.titre).sort()).toEqual(["Push 1", "Rappel"]);
    expect(push[0].appareils).toEqual([{ adresse: "https://fcm.googleapis.com/fcm/send/b1", p256dh: "B" + "x".repeat(86), auth: "a".repeat(22) }]);
  });

  it("terminer_envoi : envoyé ; échec puis nouvel essai à 1 min ; abandon au 4e échec ; appareils disparus retirés ; plus de 24 h abandonné", async () => {
    await appareil(B, "https://fcm.googleapis.com/fcm/send/b2");
    await notifier([B], "messages", "Essais");
    const reprendre = async () => {
      await banc.db.query("update public.envois set prochain_essai = now() - interval '1 second'");
      return prendre("anon", JETON, ["push"]);
    };
    let [e] = await reprendre();
    await terminer(e, false, "Service indisponible");
    const apres = (await banc.db.query<{ statut: string; ecart: number; erreur: string }>(
      "select statut, extract(epoch from prochain_essai - now())::int as ecart, erreur from public.envois where id = $1",
      [e.id],
    )).rows[0];
    expect(apres).toMatchObject({ statut: "a_envoyer", erreur: "Service indisponible" });
    expect(apres.ecart).toBeGreaterThan(50);
    expect(apres.ecart).toBeLessThanOrEqual(60);
    for (let i = 0; i < 3; i++) {
      [e] = await reprendre();
      await terminer(e, false, "Encore");
    }
    expect((await envois()).find((x) => x.titre === "Essais")?.statut).toBe("abandonne");

    await notifier([B], "messages", "Réussi");
    const [r] = await reprendre();
    await terminer(r, true, null, ["https://fcm.googleapis.com/fcm/send/b2"]);
    expect((await envois()).find((x) => x.titre === "Réussi")?.statut).toBe("envoye");
    expect((await banc.db.query("select 1 from public.appareils_push where adresse = 'https://fcm.googleapis.com/fcm/send/b2'")).rows).toHaveLength(0);

    await banc.db.query("insert into public.envois (canal, destinataire, titre, cree_le) values ('email', $1, 'Vieux', now() - interval '25 hours')", [A]);
    await prendre("anon", JETON, ["email"]);
    expect((await envois()).find((x) => x.titre === "Vieux")?.statut).toBe("abandonne");
  });
});
