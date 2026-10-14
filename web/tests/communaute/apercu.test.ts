import { afterEach, describe, expect, it, vi } from "vitest";
import { adressePrivee, lireApercu } from "@/lib/communaute/apercu";

// La lecture d'une page par le serveur pour l'aperçu d'un lien (spec du fil Actualités, §3) : jamais une adresse privée.

const PUBLIQUE = "93.184.216.34";
const page = (html: string, type = "text/html; charset=utf-8") => new Response(html, { status: 200, headers: { "content-type": type } });
const redirection = (vers: string) => new Response(null, { status: 302, headers: { location: vers } });

function outils(reponses: Response[], ips: Record<string, string[]> = {}) {
  const appels: string[] = [];
  const f = vi.fn(async (url: string | URL | Request) => {
    appels.push(String(url));
    const r = reponses.shift();
    if (!r) throw new Error("plus de réponse");
    return r;
  });
  const resoudre = vi.fn(async (hote: string) => ips[hote] ?? [PUBLIQUE]);
  return { fetch: f as unknown as typeof fetch, resoudre, appels };
}

afterEach(() => vi.useRealTimers());

describe("adressePrivee", () => {
  it("les plages privées, locales et réservées ; les adresses publiques passent", () => {
    for (const ip of ["10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "127.0.0.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "224.0.0.1", "255.255.255.255", "::1", "::", "fc00::1", "fd12::1", "fe80::1", "::ffff:10.0.0.1", "::ffff:127.0.0.1", "pas une ip"]) {
      expect(adressePrivee(ip), ip).toBe(true);
    }
    for (const ip of ["8.8.8.8", "172.32.0.1", "93.184.216.34", "2001:4860:4860::8888", "::ffff:8.8.8.8"]) {
      expect(adressePrivee(ip), ip).toBe(false);
    }
  });
});

describe("lireApercu", () => {
  it("les balises og, l'image relative résolue, les entités HTML ; l'adresse rendue est celle du texte", async () => {
    const o = outils([
      page(
        `<html><head><meta property="og:title" content="Google Meet &amp; vous"><meta content="Réunions vidéo en temps réel" property="og:description"><meta property="og:image" content="/images/meet.png"></head></html>`,
      ),
    ]);
    expect(await lireApercu("https://meet.google.com/coj-aymk-rwe", o)).toEqual({
      type: "lien",
      url: "https://meet.google.com/coj-aymk-rwe",
      titre: "Google Meet & vous",
      description: "Réunions vidéo en temps réel",
      image: "https://meet.google.com/images/meet.png",
    });
  });

  it("à défaut : twitter:*, puis <title> ; rien de lisible : pas d'aperçu", async () => {
    const twitter = outils([page(`<head><meta name="twitter:title" content="Zoom"><meta name="twitter:image" content="https://zoom.us/i.png"></head>`)]);
    expect(await lireApercu("https://zoom.us/j/1", twitter)).toMatchObject({ titre: "Zoom", image: "https://zoom.us/i.png" });
    const titre = outils([page("<html><head><title> Mon portfolio </title></head></html>")]);
    expect(await lireApercu("https://exemple.com/p", titre)).toMatchObject({ titre: "Mon portfolio", description: "", image: null });
    expect(await lireApercu("https://exemple.com/vide", outils([page("<html><body>Rien</body></html>")]))).toBeNull();
  });

  it("refus : schéma, port, nom qui résout une adresse privée, adresse privée écrite telle quelle", async () => {
    const o = outils([page("<title>x</title>")], { "interne.exemple": ["10.0.0.5"] });
    expect(await lireApercu("ftp://exemple.com/x", o)).toBeNull();
    expect(await lireApercu("https://exemple.com:8443/x", o)).toBeNull();
    expect(await lireApercu("https://interne.exemple/x", o)).toBeNull();
    expect(await lireApercu("http://127.0.0.1/admin", o)).toBeNull();
    expect(await lireApercu("http://[::1]/", o)).toBeNull();
    expect(o.appels).toEqual([]);
  });

  it("redirections : suivies et revérifiées ; vers une adresse privée ou plus de 3 : refus", async () => {
    const suivie = outils([redirection("/nouvelle"), page("<title>Arrivée</title>")]);
    expect(await lireApercu("https://exemple.com/ancienne", suivie)).toMatchObject({ titre: "Arrivée", url: "https://exemple.com/ancienne" });
    expect(suivie.appels).toEqual(["https://exemple.com/ancienne", "https://exemple.com/nouvelle"]);
    const privee = outils([redirection("http://169.254.169.254/latest/meta-data/")]);
    expect(await lireApercu("https://exemple.com/piege", privee)).toBeNull();
    expect(privee.appels).toHaveLength(1);
    const boucle = outils([redirection("/1"), redirection("/2"), redirection("/3"), redirection("/4"), page("<title>Trop loin</title>")]);
    expect(await lireApercu("https://exemple.com/0", boucle)).toBeNull();
    expect(boucle.appels).toHaveLength(4);
  });

  it("une page non HTML, une erreur, un corps trop long, un délai dépassé : pas d'aperçu", async () => {
    expect(await lireApercu("https://exemple.com/doc.pdf", outils([page("%PDF", "application/pdf")]))).toBeNull();
    expect(await lireApercu("https://exemple.com/absente", outils([new Response("non", { status: 404, headers: { "content-type": "text/html" } })]))).toBeNull();
    expect(await lireApercu("https://exemple.com/x", outils([]))).toBeNull();
    // Le titre n'arrive qu'après 600 Ko : la lecture s'arrête à 512 Ko.
    expect(await lireApercu("https://exemple.com/longue", outils([page(`${"x".repeat(600_000)}<title>Trop tard</title>`)]))).toBeNull();

    vi.useFakeTimers();
    const lent = vi.fn(
      (_url: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_ok, ko) => init?.signal?.addEventListener("abort", () => ko(new DOMException("Délai", "AbortError")))),
    ) as unknown as typeof fetch;
    const enCours = lireApercu("https://exemple.com/lente", { fetch: lent, resoudre: async () => [PUBLIQUE] });
    await vi.advanceTimersByTimeAsync(4_000);
    expect(await enCours).toBeNull();
  });
});
