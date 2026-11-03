import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// L'analyse automatique d'un message de groupe (migration 0075) : le message a déjà paru ; le serveur le fait analyser
// par le mécanisme des publications (analyserPublication), puis transmet le verdict à la base avec le jeton et la
// version du message. Sans configuration, rien ne part (l'équipe le verra dans la file au bout de 5 minutes).

const { analyserMessage } = await import("@/lib/groupes/moderation");

const rpc = vi.fn(async () => ({ data: { decision: "bloquer" }, error: null }));
const supabase = { rpc, storage: { from: () => ({ download: vi.fn() }) } } as unknown as Parameters<typeof analyserMessage>[0];
const MESSAGE = { id: "m1", texte: "Gagnez 500 000 FCFA par jour", image: null, version: 2, groupe: "Général" };
const reponseIA = (input: unknown) =>
  vi.fn(async () => new Response(JSON.stringify({ stop_reason: "tool_use", content: [{ type: "tool_use", name: "rendre_verdict", input }] }), { status: 200 })) as unknown as typeof fetch;

beforeEach(() => {
  rpc.mockClear();
  process.env.ANTHROPIC_API_KEY = "cle-de-test";
  process.env.MODERATION_JETON = "jeton-de-test";
});
afterEach(() => {
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.MODERATION_JETON;
});

describe("L'analyse d'un message de groupe", () => {
  it("le verdict de l'IA part à la base avec le jeton et la version du message", async () => {
    const f = reponseIA({ decision: "bloquer", categorie: "arnaque", raison: "Promesse de gain" });
    await analyserMessage(supabase, MESSAGE, f);
    const [, init] = vi.mocked(f).mock.calls[0] as unknown as [string, RequestInit];
    const corps = JSON.parse(String(init.body));
    expect(JSON.stringify(corps.messages)).toContain("Gagnez 500 000 FCFA par jour");
    expect(rpc).toHaveBeenCalledWith("verdict_message_groupe", {
      p_message: "m1",
      p_analyse: { jeton: "jeton-de-test", decision: "bloquer", categorie: "arnaque", raison: "Promesse de gain", version: 2 },
    });
  });

  it("aucun verdict de l'IA (clé refusée) : « echec », l'équipe l'examinera", async () => {
    const f = vi.fn(async () => new Response("{}", { status: 401 })) as unknown as typeof fetch;
    await analyserMessage(supabase, MESSAGE, f);
    expect(rpc).toHaveBeenCalledWith("verdict_message_groupe", expect.objectContaining({ p_analyse: expect.objectContaining({ decision: "echec", version: 2 }) }));
  });

  it("sans la clé de l'IA ou le jeton : rien ne part", async () => {
    delete process.env.MODERATION_JETON;
    const f = vi.fn() as unknown as typeof fetch;
    await analyserMessage(supabase, MESSAGE, f);
    expect(f).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });
});
