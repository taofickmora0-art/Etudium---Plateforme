import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// La tâche planifiée de Vercel (vercel.json, chaque jour) vide la file des envois : les e-mails produits la nuit
// (rappels d'abonnement, séries) partent sans attendre une visite. Vercel envoie « Authorization: Bearer <CRON_SECRET> ».
const viderFile = vi.hoisted(() => vi.fn());
const connection = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("@/lib/envois/file", () => ({ viderFile }));
// connection() marque la route « à la requête » ; hors d'une requête de Next (ici), elle lèverait.
vi.mock("next/server", async (original) => ({ ...(await original<typeof import("next/server")>()), connection }));

const route = await import("@/app/api/envois/vider/route");

const SECRET = "secret-de-test-0123456789abcdef";
const ADRESSE = "https://etudium.online/api/envois/vider";
const appel = (autorisation?: string) => route.GET(new Request(ADRESSE, { headers: autorisation === undefined ? {} : { authorization: autorisation } }));

beforeEach(() => {
  viderFile.mockReset();
  viderFile.mockResolvedValue({ envoyes: 0, echecs: 0 });
  vi.stubEnv("CRON_SECRET", SECRET);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /api/envois/vider", () => {
  it("401 sans en-tête Authorization", async () => {
    const reponse = await appel();
    expect(reponse.status).toBe(401);
    expect(viderFile).not.toHaveBeenCalled();
  });

  it("401 avec un mauvais en-tête", async () => {
    // (Les espaces autour d'une valeur d'en-tête sont retirés par HTTP lui-même : « Bearer <secret> » suivi d'un espace passe.)
    for (const mauvais of ["Bearer autre-secret", SECRET, `Bearer ${SECRET}x`, `Bearer ${SECRET.slice(0, -1)}`, `bearer${SECRET}`, "Bearer "]) {
      expect((await appel(mauvais)).status).toBe(401);
    }
    expect(viderFile).not.toHaveBeenCalled();
  });

  it("401 quand CRON_SECRET n'est pas posée, même avec un en-tête vide ou « undefined »", async () => {
    vi.stubEnv("CRON_SECRET", "");
    for (const essai of ["Bearer ", "Bearer undefined", "Bearer"]) {
      expect((await appel(essai)).status).toBe(401);
    }
    expect(viderFile).not.toHaveBeenCalled();
  });

  it("200 avec le bon en-tête : la file est vidée, passage après passage, jusqu'à ce qu'elle soit vide", async () => {
    viderFile
      .mockResolvedValueOnce({ envoyes: 10, echecs: 0 })
      .mockResolvedValueOnce({ envoyes: 2, echecs: 1 })
      .mockResolvedValueOnce({ envoyes: 0, echecs: 0 });
    const reponse = await appel(`Bearer ${SECRET}`);
    expect(reponse.status).toBe(200);
    expect(reponse.headers.get("cache-control")).toContain("no-store");
    expect(await reponse.json()).toEqual({ envoyes: 12, echecs: 1, passages: 3 });
    expect(viderFile).toHaveBeenCalledTimes(3);
    // Jamais pré-rendue : rendue à chaque appel.
    expect(connection).toHaveBeenCalled();
  });

  it("une file déjà vide (ou sans clés d'envoi) : un seul passage", async () => {
    const reponse = await appel(`Bearer ${SECRET}`);
    expect(await reponse.json()).toEqual({ envoyes: 0, echecs: 0, passages: 1 });
  });

  it("le nombre de passages est borné, même si la file ne se vide jamais", async () => {
    viderFile.mockResolvedValue({ envoyes: 10, echecs: 0 });
    const bilan = await (await appel(`Bearer ${SECRET}`)).json();
    expect(bilan.passages).toBeGreaterThan(1);
    expect(bilan.passages).toBeLessThanOrEqual(20);
    expect(viderFile).toHaveBeenCalledTimes(bilan.passages);
  });

  it("tourne sous Node (runtime par défaut), dans la limite de l'offre Hobby", () => {
    // Avec Cache Components, le build refuse « export const runtime » : Node est le runtime par défaut.
    expect("runtime" in route).toBe(false);
    expect(route.maxDuration).toBeGreaterThan(0);
    expect(route.maxDuration).toBeLessThanOrEqual(60);
  });
});
