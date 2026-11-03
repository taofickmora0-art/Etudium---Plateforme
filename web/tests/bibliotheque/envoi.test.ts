import { describe, expect, it, vi } from "vitest";

// L'envoi d'un fichier du navigateur vers un espace de Supabase, avec la progression (le PDF d'un livre : jusqu'à
// 50 Mo), et la couverture fabriquée à partir de la première page d'un PDF.

vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: { getSession: async () => ({ data: { session: { access_token: "jeton" } } }) } }) }));
const { envoyerFichier } = await import("@/lib/bibliotheque/envoi");
const { couvertureDePremierePage, lirePdfLocal } = await import("@/lib/bibliotheque/pdf-local");

class FauxXhr {
  static dernier: FauxXhr;
  methode = "";
  adresse = "";
  entetes: Record<string, string> = {};
  corps: unknown = null;
  status = 0;
  responseText = "";
  upload: { onprogress: ((e: { lengthComputable: boolean; loaded: number; total: number }) => void) | null } = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor() {
    FauxXhr.dernier = this;
  }
  open(methode: string, adresse: string) {
    this.methode = methode;
    this.adresse = adresse;
  }
  setRequestHeader(nom: string, valeur: string) {
    this.entetes[nom] = valeur;
  }
  send(corps: unknown) {
    this.corps = corps;
  }
}

const ENV = () => ({ supabaseUrl: "https://abcd.supabase.co/", supabaseKey: "sb_publishable_x" });
const deps = { xhr: () => new FauxXhr() as unknown as XMLHttpRequest, env: ENV };

describe("envoyerFichier", () => {
  it("envoie le fichier à l'espace, avec la session, le type et sans écraser ; la progression suit", async () => {
    const etapes: number[] = [];
    const fichier = new Blob(["%PDF-1.7"], { type: "application/pdf" });
    const envoi = envoyerFichier({ espace: "bibliotheque", chemin: "a/b c.pdf", fichier, type: "application/pdf", onProgression: (p) => etapes.push(p) }, deps);
    await vi.waitFor(() => expect(FauxXhr.dernier?.methode).toBe("POST"));
    const x = FauxXhr.dernier;
    expect(x.adresse).toBe("https://abcd.supabase.co/storage/v1/object/bibliotheque/a/b%20c.pdf");
    expect(x.entetes).toMatchObject({ authorization: "Bearer jeton", apikey: "sb_publishable_x", "content-type": "application/pdf", "x-upsert": "false" });
    expect(x.corps).toBe(fichier);
    x.upload.onprogress?.({ lengthComputable: true, loaded: 25, total: 100 });
    x.upload.onprogress?.({ lengthComputable: true, loaded: 100, total: 100 });
    x.status = 200;
    x.onload?.();
    expect(await envoi).toEqual({ ok: true });
    expect(etapes).toEqual([25, 100]);
  });

  it("un refus de l'espace (trop lourd, interdit) ou une coupure donnent un message clair", async () => {
    const essai = async (status: number | "coupure") => {
      const envoi = envoyerFichier({ espace: "bibliotheque", chemin: "a/b.pdf", fichier: new Blob(["x"]), type: "application/pdf" }, deps);
      await vi.waitFor(() => expect(FauxXhr.dernier?.adresse).toContain("a/b.pdf"));
      const x = FauxXhr.dernier;
      FauxXhr.dernier = undefined as unknown as FauxXhr;
      if (status === "coupure") x.onerror?.();
      else {
        x.status = status;
        x.onload?.();
      }
      return envoi;
    };
    expect(await essai(413)).toEqual({ ok: false, message: "Ce fichier dépasse 50 Mo." });
    expect(await essai(403)).toEqual({ ok: false, message: "L’envoi a été refusé. Reconnectez-vous, puis réessayez." });
    expect(await essai(500)).toEqual({ ok: false, message: "L’envoi n’a pas abouti. Réessayez." });
    expect(await essai("coupure")).toEqual({ ok: false, message: "La connexion a été coupée pendant l’envoi. Réessayez." });
  });
});

describe("Le PDF lu dans le navigateur", () => {
  it("lirePdfLocal ouvre le fichier avec pdf.js ; la couverture est la 1re page dessinée, en JPEG", async () => {
    const document = { pages: 42, ratio: 1.41, dessiner: vi.fn(async () => undefined), fermer: vi.fn() };
    const ouvrir = vi.fn(async () => document);
    const lu = await lirePdfLocal(new Blob(["%PDF-1.7"]), ouvrir);
    expect(lu.pages).toBe(42);
    expect(ouvrir).toHaveBeenCalledWith(expect.any(ArrayBuffer));
    const jpeg = new Blob(["jpeg"], { type: "image/jpeg" });
    const canvas = {
      toBlob: (rappel: (b: Blob | null) => void, type: string, qualite: number) => rappel(type === "image/jpeg" && qualite > 0.5 ? jpeg : null),
    };
    expect(await couvertureDePremierePage(document, () => canvas as unknown as HTMLCanvasElement)).toBe(jpeg);
    expect(document.dessiner).toHaveBeenCalledWith(1, canvas, 600);
  });
});
