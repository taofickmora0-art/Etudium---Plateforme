import { beforeEach, describe, expect, it, vi } from "vitest";

// Compte suspendu (spec des utilisateurs, §4) : la fonction compte_suspendu() de la migration 0013, lue par
// l'application ; la route /auth/suspendu déconnecte le compte et l'envoie à la connexion.

const auth = { signOut: vi.fn() };
const rpc = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth, rpc }) }));

const { estSuspendu, MESSAGE_SUSPENDU, ADRESSE_SUSPENDU } = await import("@/lib/auth/suspension");
const { GET: routeSuspendu } = await import("@/app/auth/suspendu/route");

describe("estSuspendu", () => {
  beforeEach(() => {
    rpc.mockReset();
    vi.restoreAllMocks();
  });

  it("vrai seulement si la base répond vrai", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    expect(await estSuspendu({ rpc })).toBe(true);
    expect(rpc).toHaveBeenCalledWith("compte_suspendu");
    rpc.mockResolvedValue({ data: false, error: null });
    expect(await estSuspendu({ rpc })).toBe(false);
  });

  it("avant la migration 0013 (fonction absente), le compte n'est pas suspendu, sans bruit", async () => {
    const erreur = vi.spyOn(console, "error").mockImplementation(() => {});
    rpc.mockResolvedValue({ data: null, error: { code: "PGRST202", message: "Could not find the function" } });
    expect(await estSuspendu({ rpc })).toBe(false);
    expect(erreur).not.toHaveBeenCalled();
  });

  it("un autre incident ne bloque personne, mais il est consigné", async () => {
    const erreur = vi.spyOn(console, "error").mockImplementation(() => {});
    rpc.mockResolvedValue({ data: null, error: { code: "500", message: "panne" } });
    expect(await estSuspendu({ rpc })).toBe(false);
    rpc.mockRejectedValue(new Error("réseau"));
    expect(await estSuspendu({ rpc })).toBe(false);
    expect(erreur).toHaveBeenCalledTimes(2);
  });

  it("le message et l'adresse de la spec", () => {
    expect(MESSAGE_SUSPENDU).toBe("Ce compte est suspendu. Pour en savoir plus, contactez l’équipe Étudium.");
    expect(ADRESSE_SUSPENDU).toBe("/auth/suspendu");
  });
});

describe("Route /auth/suspendu", () => {
  beforeEach(() => {
    rpc.mockReset();
    auth.signOut.mockReset();
  });

  it("déconnecte un compte suspendu et l'envoie à la connexion avec le message", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    const reponse = await routeSuspendu(new Request("http://localhost:3000/auth/suspendu") as never);
    expect(auth.signOut).toHaveBeenCalled();
    expect(reponse.headers.get("location")).toBe("http://localhost:3000/connexion?erreur=suspendu");
  });

  it("ne déconnecte jamais un compte actif (un lien ne suffit pas à déconnecter quelqu'un)", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    const reponse = await routeSuspendu(new Request("http://localhost:3000/auth/suspendu") as never);
    expect(auth.signOut).not.toHaveBeenCalled();
    expect(reponse.headers.get("location")).toBe("http://localhost:3000/accueil");
  });
});
