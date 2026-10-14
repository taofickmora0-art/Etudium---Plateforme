import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { Apercu } from "./liens";

// L'aperçu d'un lien, lu par le serveur au moment de publier (spec du fil « Actualités », §3). Serveur seulement :
// jamais une adresse privée, locale ou réservée (vérifiée sur chaque adresse IP du nom et à chaque redirection),
// 3 redirections, 4 secondes et 512 Ko au plus, une page HTML seulement. Un échec : pas d'aperçu.
// Limite connue : entre la vérification du nom et la connexion, le DNS pourrait répondre autrement (rebinding) ; la page
// n'est que lue pour en tirer trois balises, jamais renvoyée telle quelle.

const DELAI_MS = 4_000;
const TAILLE_MAX = 524_288;
const REDIRECTIONS_MAX = 3;

type Outils = { fetch?: typeof fetch; resoudre?: (hote: string) => Promise<string[]> };

function ipv4Privee(ip: string): boolean {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b, c] = p;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

/** Une adresse IP qu'on ne lit jamais : privée, locale, réservée, multidiffusion, ou illisible. */
export function adressePrivee(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return ipv4Privee(ip);
  if (version !== 6) return true;
  const x = ip.toLowerCase();
  const mappee = x.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mappee) return ipv4Privee(mappee[1]);
  if (x === "::" || x === "::1" || x.startsWith("::ffff:") || x.startsWith("64:ff9b:")) return true;
  const premier = parseInt(x.split(":")[0] || "0", 16);
  return (premier & 0xfe00) === 0xfc00 || (premier & 0xffc0) === 0xfe80 || (premier & 0xff00) === 0xff00;
}

const resoudreDns = async (hote: string) => (await lookup(hote, { all: true, verbatim: true })).map((a) => a.address);

/** Le nom et le port d'une adresse sont-ils sûrs à lire ? */
async function adresseSure(url: URL, resoudre: (hote: string) => Promise<string[]>): Promise<boolean> {
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  if (url.port && url.port !== "80" && url.port !== "443") return false;
  const hote = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(hote)) return !adressePrivee(hote);
  if (hote === "localhost" || /\.(localhost|local|internal)$/i.test(hote)) return false;
  const ips = await resoudre(hote);
  return ips.length > 0 && ips.every((ip) => !adressePrivee(ip));
}

/** Les 512 premiers Ko du corps, au plus. */
async function lireCorps(reponse: Response): Promise<string> {
  const lecteur = reponse.body?.getReader();
  if (!lecteur) return "";
  const morceaux: Uint8Array[] = [];
  let total = 0;
  while (total < TAILLE_MAX) {
    const { done, value } = await lecteur.read();
    if (done || !value) break;
    morceaux.push(value);
    total += value.byteLength;
  }
  await lecteur.cancel().catch(() => undefined);
  const octets = new Uint8Array(Math.min(total, TAILLE_MAX));
  let position = 0;
  for (const m of morceaux) {
    const part = m.subarray(0, Math.max(0, octets.length - position));
    octets.set(part, position);
    position += part.byteLength;
    if (position >= octets.length) break;
  }
  return new TextDecoder("utf-8").decode(octets);
}

const ENTITES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const decoder = (texte: string) =>
  texte.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (tout, code: string) => {
    if (code[0] === "#") {
      const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : "";
    }
    return ENTITES[code.toLowerCase()] ?? tout;
  });

function attributs(balise: string): Record<string, string> {
  const resultat: Record<string, string> = {};
  for (const m of balise.matchAll(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g)) {
    resultat[m[1].toLowerCase()] = m[3] ?? m[4] ?? m[5] ?? "";
  }
  return resultat;
}

const propre = (texte: string, max: number) => decoder(texte).replace(/\s+/g, " ").trim().slice(0, max);

/** Les balises og (à défaut twitter, puis <title>) ; l'image résolue sur l'adresse finale. Rien de lisible : null. */
function extraire(html: string, base: URL, adresse: string): Apercu | null {
  const metas = new Map<string, string>();
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const a = attributs(m[0]);
    const cle = (a.property ?? a.name ?? "").toLowerCase();
    if (cle && a.content !== undefined && !metas.has(cle)) metas.set(cle, a.content);
  }
  const titre = propre(metas.get("og:title") ?? metas.get("twitter:title") ?? html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? "", 200);
  const description = propre(metas.get("og:description") ?? metas.get("twitter:description") ?? metas.get("description") ?? "", 300);
  let image: string | null = null;
  const brute = decoder(metas.get("og:image") ?? metas.get("twitter:image") ?? "").trim();
  if (brute) {
    try {
      const u = new URL(brute, base);
      if ((u.protocol === "http:" || u.protocol === "https:") && u.toString().length <= 1000) image = u.toString();
    } catch {
      image = null;
    }
  }
  if (!titre && !description && !image) return null;
  return { type: "lien", url: adresse, titre, description, image };
}

/** L'aperçu d'une adresse, ou null. L'adresse rendue est celle du texte, que la base retrouve dans la publication. */
export async function lireApercu(adresse: string, outils: Outils = {}): Promise<Apercu | null> {
  const f = outils.fetch ?? fetch;
  const resoudre = outils.resoudre ?? resoudreDns;
  const minuterie = new AbortController();
  const delai = setTimeout(() => minuterie.abort(), DELAI_MS);
  try {
    let url = new URL(adresse);
    for (let saut = 0; saut <= REDIRECTIONS_MAX; saut++) {
      if (!(await adresseSure(url, resoudre))) return null;
      const reponse = await f(url.toString(), {
        redirect: "manual",
        signal: minuterie.signal,
        headers: { accept: "text/html", "user-agent": "Mozilla/5.0 (compatible; EtudiumApercu/1.0)" },
      });
      if (reponse.status >= 300 && reponse.status < 400) {
        const vers = reponse.headers.get("location");
        if (!vers) return null;
        url = new URL(vers, url);
        continue;
      }
      if (!reponse.ok || !(reponse.headers.get("content-type") ?? "").toLowerCase().includes("text/html")) return null;
      return extraire(await lireCorps(reponse), url, adresse);
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(delai);
  }
}
