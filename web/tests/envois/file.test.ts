import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { configurationEnvois } from "@/lib/envois/config";
import { envoyerPush } from "@/lib/envois/push";
import { viderFile } from "@/lib/envois/file";

// Vider la file d'envoi (lot 5, étape B) : le serveur prend les envois prêts avec son jeton, envoie (push ou e-mail),
// puis termine chacun. Sans jeton, rien ; sans les clés d'un canal, ce canal n'est pas pris ; jamais d'exception.

const CLES = {
  ENVOIS_JETON: "j".repeat(64),
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: "BPub",
  VAPID_PRIVATE_KEY: "priv",
  VAPID_SUJET: "mailto:equipe@etudium.app",
  RESEND_API_KEY: "re_test",
  EMAIL_EXPEDITEUR: "Étudium <onboarding@resend.dev>",
  NEXT_PUBLIC_SITE_URL: "https://etudium.app",
};

function fauxClient(pris: unknown[] | { error: unknown }) {
  const rpc = vi.fn<(nom: string, args?: unknown) => Promise<{ data: unknown; error: unknown }>>(async (nom) => {
    if (nom === "prendre_envois") return Array.isArray(pris) ? { data: pris, error: null } : { data: null, error: pris.error };
    return { data: null, error: null };
  });
  return { client: { rpc } as unknown as SupabaseClient, rpc };
}
const PRISE = "11111111-2222-4333-8444-555555555555";
const CREE = "2026-11-01T10:00:00.123+00:00";
const terminaisons = (rpc: ReturnType<typeof fauxClient>["rpc"]) => rpc.mock.calls.filter((c) => c[0] === "terminer_envoi").map((c) => c[1]);

describe("La configuration", () => {
  it("sans jeton : rien ; chaque canal selon ses clés ; le site par défaut en local", () => {
    expect(configurationEnvois({})).toBeNull();
    expect(configurationEnvois({ ENVOIS_JETON: "court" })).toBeNull();
    expect(configurationEnvois({ ENVOIS_JETON: "j".repeat(64), RESEND_API_KEY: "re", EMAIL_EXPEDITEUR: "É <a@b.c>" })).toEqual({
      jeton: "j".repeat(64),
      push: null,
      email: { cle: "re", expediteur: "É <a@b.c>", reponse: null },
      site: "http://localhost:3000",
    });
    // Relecture (5) : l'adresse de l'équipe reçoit les réponses (un compte suspendu répond à l'e-mail).
    expect(configurationEnvois({ ...CLES, EMAIL_REPONSE: " equipe@etudium.app " })?.email?.reponse).toBe("equipe@etudium.app");
    expect(configurationEnvois(CLES)?.push).toEqual({ publique: "BPub", privee: "priv", sujet: "mailto:equipe@etudium.app" });
  });
});

describe("Vider la file", () => {
  it("sans jeton : aucun appel", async () => {
    const f = fauxClient([]);
    expect(await viderFile({ client: f.client, config: null })).toEqual({ envoyes: 0, echecs: 0 });
    expect(f.rpc).not.toHaveBeenCalled();
  });

  it("Review Focus 4 : sans les clés du push, seuls les e-mails sont pris", async () => {
    const f = fauxClient([]);
    await viderFile({ client: f.client, config: configurationEnvois({ ...CLES, VAPID_PRIVATE_KEY: "" }) });
    expect(f.rpc).toHaveBeenCalledWith("prendre_envois", { p_jeton: CLES.ENVOIS_JETON, p_canaux: ["email"], p_limite: 10 });
  });

  it("un e-mail envoyé, un e-mail refusé : chacun terminé avec son résultat", async () => {
    const f = fauxClient([
      { id: 1, prise: PRISE, cree_le: CREE, canal: "email", titre: "Paiement reçu", texte: "Jusqu’au…", lien: "/abonnement", email: "a@exemple.com", prenom: "Aïcha", appareils: [] },
      { id: 2, prise: PRISE, cree_le: CREE, canal: "email", titre: "Rappel", texte: "", lien: null, email: "b@exemple.com", prenom: null, appareils: [] },
    ]);
    const envoyerEmail = vi.fn().mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: false, erreur: "Adresse refusée" });
    expect(await viderFile({ client: f.client, config: configurationEnvois(CLES), envoyerEmail })).toEqual({ envoyes: 1, echecs: 1 });
    // Relecture : la clé d'idempotence est propre à cette base (le numéro seul se répète d'une base à l'autre).
    expect(envoyerEmail.mock.calls[0][1]).toMatchObject({ a: "a@exemple.com", sujet: "Paiement reçu", idempotence: `envoi-1-${Date.parse(CREE)}` });
    expect(envoyerEmail.mock.calls[0][1].html).toContain('href="https://etudium.app/abonnement"');
    expect(terminaisons(f.rpc)).toEqual([
      { p_jeton: CLES.ENVOIS_JETON, p_id: 1, p_prise: PRISE, p_reussi: true, p_erreur: null, p_disparus: [] },
      { p_jeton: CLES.ENVOIS_JETON, p_id: 2, p_prise: PRISE, p_reussi: false, p_erreur: "Adresse refusée", p_disparus: [] },
    ]);
  });

  it("Review Focus 3 : un push vers un appareil disparu le retire, l'envoi est fait", async () => {
    const appareils = [{ adresse: "https://push.exemple/1", p256dh: "k", auth: "a" }];
    const f = fauxClient([{ id: 3, prise: PRISE, cree_le: CREE, canal: "push", titre: "Nouveau message", texte: "Bonjour", lien: "/messages", email: null, prenom: null, appareils }]);
    const envoyerPushFaux = vi.fn().mockResolvedValue({ ok: true, disparus: ["https://push.exemple/1"] });
    await viderFile({ client: f.client, config: configurationEnvois(CLES), envoyerPush: envoyerPushFaux });
    expect(envoyerPushFaux.mock.calls[0][2]).toEqual({ titre: "Nouveau message", texte: "Bonjour", lien: "/messages" });
    expect(terminaisons(f.rpc)).toEqual([{ p_jeton: CLES.ENVOIS_JETON, p_id: 3, p_prise: PRISE, p_reussi: true, p_erreur: null, p_disparus: ["https://push.exemple/1"] }]);
  });

  it("relecture (3) : au-delà de 90 secondes, plus rien ne part (la réservation dure 2 minutes) ; le reste attend sa reprise", async () => {
    const envoi = (id: number) => ({ id, prise: PRISE, cree_le: CREE, canal: "email", titre: "T", texte: "", lien: null, email: "a@exemple.com", prenom: null, appareils: [] });
    const f = fauxClient([envoi(1), envoi(2), envoi(3)]);
    const horloge = vi.fn().mockReturnValueOnce(0).mockReturnValueOnce(1_000).mockReturnValue(95_000);
    const envoyerEmail = vi.fn().mockResolvedValue({ ok: true });
    expect(await viderFile({ client: f.client, config: configurationEnvois(CLES), envoyerEmail, maintenant: horloge })).toEqual({ envoyes: 1, echecs: 0 });
    expect(terminaisons(f.rpc).map((t) => (t as { p_id: number }).p_id)).toEqual([1]);
  });

  it("points reportés : sans les clés des e-mails, seul le push est pris ; un jeton sans aucune clé ne prend rien", async () => {
    const f = fauxClient([]);
    await viderFile({ client: f.client, config: configurationEnvois({ ...CLES, RESEND_API_KEY: "" }) });
    expect(f.rpc).toHaveBeenCalledWith("prendre_envois", { p_jeton: CLES.ENVOIS_JETON, p_canaux: ["push"], p_limite: 10 });
    const g = fauxClient([]);
    expect(await viderFile({ client: g.client, config: configurationEnvois({ ENVOIS_JETON: CLES.ENVOIS_JETON }) })).toEqual({ envoyes: 0, echecs: 0 });
    expect(g.rpc).not.toHaveBeenCalled();
  });

  it("une base qui refuse (jeton faux, migration absente) : rien ne lève", async () => {
    const f = fauxClient({ error: { code: "42501", message: "Jeton d’envoi non reconnu." } });
    expect(await viderFile({ client: f.client, config: configurationEnvois(CLES) })).toEqual({ envoyes: 0, echecs: 0 });
  });
});

describe("Envoyer un push", () => {
  const config = { publique: "BPub", privee: "priv", sujet: "mailto:e@e.e" };
  const appareil = (n: number) => ({ adresse: `https://push.exemple/${n}`, p256dh: "k", auth: "a" });
  const charge = { titre: "T", texte: "X", lien: "/accueil" };

  it("un appareil reçoit, un autre a disparu (410) : réussi, l'appareil disparu est rendu", async () => {
    const envoi = vi.fn().mockResolvedValueOnce({ statusCode: 201 }).mockRejectedValueOnce(Object.assign(new Error("Gone"), { statusCode: 410 }));
    expect(await envoyerPush(config, [appareil(1), appareil(2)], charge, envoi)).toEqual({ ok: true, disparus: ["https://push.exemple/2"] });
    expect(JSON.parse(envoi.mock.calls[0][1])).toEqual(charge);
    // Relecture (3, 4) : un service qui ne répond pas ne bloque pas la file.
    expect(envoi.mock.calls[0][2]).toMatchObject({ TTL: 86_400, timeout: 10_000 });
  });

  it("point reporté : un appareil qui répond 404 a disparu aussi ; l'envoi est fait", async () => {
    const envoi = vi.fn().mockRejectedValue(Object.assign(new Error("Not Found"), { statusCode: 404 }));
    expect(await envoyerPush(config, [appareil(1)], charge, envoi)).toEqual({ ok: true, disparus: ["https://push.exemple/1"] });
  });

  it("une panne du service de push : échec, avec son message ; aucun appareil : rien à faire", async () => {
    const envoi = vi.fn().mockRejectedValue(Object.assign(new Error("Service indisponible"), { statusCode: 503 }));
    expect(await envoyerPush(config, [appareil(1)], charge, envoi)).toEqual({ ok: false, disparus: [], erreur: "Service indisponible" });
    expect(await envoyerPush(config, [], charge, envoi)).toEqual({ ok: true, disparus: [] });
  });
});
