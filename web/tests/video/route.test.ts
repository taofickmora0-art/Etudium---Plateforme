import { beforeEach, describe, expect, it, vi } from "vitest";
import { fauxSupabase } from "../admin/faux-supabase";
import { id } from "../lecon/donnees";

const faux = fauxSupabase();
let compte: { id: string } | null = { id: "compte-1" };
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ ...faux.client, auth: { getUser: async () => ({ data: { user: compte }, error: null }) } }),
}));

const { POST } = await import("@/app/api/visionnage/route");

const ADRESSE = "http://localhost:3000/api/visionnage";
const requete = (corps: unknown, entetes: Record<string, string> = { origin: "http://localhost:3000", "content-type": "application/json" }) =>
  new Request(ADRESSE, { method: "POST", headers: { host: "localhost:3000", ...entetes }, body: typeof corps === "string" ? corps : JSON.stringify(corps) });
const ENREGISTRER = { action: "enregistrer", lecon: id(1), passages: [[0, 40], [60, 90]], position: 90.4, duree: 370.2 };

describe("Route d'envoi du temps regardé", () => {
  beforeEach(() => {
    faux.vider();
    compte = { id: "compte-1" };
  });

  it("une requête d'un autre site, ou qui n'est pas du JSON, est refusée sans rien enregistrer", async () => {
    expect((await POST(requete(ENREGISTRER, { origin: "https://pirate.example", "content-type": "application/json" }))).status).toBe(403);
    expect((await POST(requete(ENREGISTRER, { "content-type": "application/json" }))).status).toBe(403);
    expect((await POST(requete("action=enregistrer", { origin: "http://localhost:3000", "content-type": "application/x-www-form-urlencoded" }))).status).toBe(403);
    expect(faux.appels).toEqual([]);
  });

  it("un corps invalide est refusé", async () => {
    for (const corps of [
      { ...ENREGISTRER, lecon: "abc" },
      { ...ENREGISTRER, passages: Array.from({ length: 51 }, (_, i) => [i * 2, i * 2 + 1]) },
      { ...ENREGISTRER, passages: [[40, 10]] },
      { ...ENREGISTRER, passages: [[-5, 10]] },
      { action: "effacer", lecon: id(1) },
    ]) {
      expect((await POST(requete(corps))).status).toBe(400);
    }
    expect((await POST(requete("{pas du json"))).status).toBe(400);
    expect(faux.appels).toEqual([]);
  });

  it("sans compte, rien n'est enregistré", async () => {
    compte = null;
    expect((await POST(requete(ENREGISTRER))).status).toBe(401);
    expect(faux.appels).toEqual([]);
  });

  it("« commencer » ouvre le visionnage", async () => {
    const reponse = await POST(requete({ action: "commencer", lecon: id(1) }));
    expect(reponse.status).toBe(200);
    expect(faux.de("rpc", "commencer_visionnage")[0].valeurs).toEqual({ p_lecon: id(1) });
  });

  it("« enregistrer » envoie les passages à la base et rend le temps vu", async () => {
    faux.repondre("rpc.enregistrer_visionnage", { data: { secondes_vues: 70, reference: 370, terminee: false } });
    const reponse = await POST(requete(ENREGISTRER));
    expect(reponse.status).toBe(200);
    expect(await reponse.json()).toEqual({ secondesVues: 70, reference: 370, terminee: false });
    expect(faux.de("rpc", "enregistrer_visionnage")[0].valeurs).toEqual({
      p_lecon: id(1),
      p_passages: "{[0,40),[60,90)}",
      p_position: 90,
      p_duree_video: 370,
    });
  });

  it("un refus de la base (passage trop long, leçon fermée…) répond 409", async () => {
    faux.repondre("rpc.enregistrer_visionnage", { error: { code: "22023", message: "Passage plus long que le temps écoulé." } });
    expect((await POST(requete(ENREGISTRER))).status).toBe(409);
    faux.repondre("rpc.commencer_visionnage", { error: { code: "42501", message: "Leçon inaccessible." } });
    expect((await POST(requete({ action: "commencer", lecon: id(1) }))).status).toBe(409);
  });
});
