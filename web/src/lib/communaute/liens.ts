// Les liens d'une publication (spec du fil « Actualités », §3). Règles pures : le serveur et les écrans s'en servent.

/** L'aperçu de la première adresse d'une publication : une vidéo YouTube, ou la carte d'un site. */
export type Apercu = { type: "youtube"; id: string } | { type: "lien"; url: string; titre: string; description: string; image: string | null };

const ADRESSE = /https?:\/\/[^\s<>"']+/gi;
const PONCTUATION_FINALE = /[.,;:!?»”’'"]$/;
const ID_YOUTUBE = /^[A-Za-z0-9_-]{11}$/;

const compter = (texte: string, c: string) => texte.split(c).length - 1;

/** Retire de la fin d'une adresse la ponctuation de la phrase et une parenthèse fermante qui n'est pas à elle. */
function nettoyer(adresse: string): string {
  let a = adresse;
  for (;;) {
    if (PONCTUATION_FINALE.test(a)) a = a.slice(0, -1);
    else if (a.endsWith(")") && compter(a, ")") > compter(a, "(")) a = a.slice(0, -1);
    else if (a.endsWith("]") && compter(a, "]") > compter(a, "[")) a = a.slice(0, -1);
    else return a;
  }
}

/** La première adresse web du texte, ou null. */
export function premiereAdresse(texte: string): string | null {
  const m = texte.match(new RegExp(ADRESSE.source, "i"));
  return m ? nettoyer(m[0]) : null;
}

/** Le texte découpé en morceaux de texte et en liens ; la ponctuation qui suit un lien reste dans le texte. */
export function decouperLiens(texte: string): ({ texte: string } | { lien: string })[] {
  const morceaux: ({ texte: string } | { lien: string })[] = [];
  let position = 0;
  for (const m of texte.matchAll(new RegExp(ADRESSE.source, "gi"))) {
    const lien = nettoyer(m[0]);
    const debut = m.index ?? 0;
    if (debut > position) morceaux.push({ texte: texte.slice(position, debut) });
    morceaux.push({ lien });
    position = debut + lien.length;
  }
  if (position < texte.length) morceaux.push({ texte: texte.slice(position) });
  return morceaux.length > 0 ? morceaux : [{ texte }];
}

/** L'identifiant d'une vidéo YouTube (watch, youtu.be, shorts, embed, live), ou null. */
export function idYoutube(adresse: string): string | null {
  let url: URL;
  try {
    url = new URL(adresse);
  } catch {
    return null;
  }
  const hote = url.hostname.replace(/^(www|m)\./, "");
  let id: string | null = null;
  if (hote === "youtu.be") id = url.pathname.split("/")[1] ?? null;
  else if (hote === "youtube.com" || hote === "youtube-nocookie.com") {
    if (url.pathname === "/watch") id = url.searchParams.get("v");
    else {
      const [, genre, valeur] = url.pathname.split("/");
      if (["shorts", "embed", "live"].includes(genre ?? "")) id = valeur ?? null;
    }
  }
  return id && ID_YOUTUBE.test(id) ? id : null;
}

/** Le nom du site tiré de l'adresse, sans « www. » : jamais une donnée de la page. */
export function domaine(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
