import type { JSONContent } from "@tiptap/react";

// Le texte mis en forme d'une publication (spec mise en forme et vidéo, §2). Il reste dans `publications.texte`, en
// Markdown restreint : `# `, `## `, `### ` (titres), `**gras**`, `_italique_`, `++souligné++`, `~~barré~~`, `- ` et `1. `
// (listes), `> ` (citation), `[texte](https://…)` (lien) ; une ligne vide sépare les paragraphes, `\` protège une marque.
// Une marque différente par style : aucune ambiguïté de lecture. Ce module ne produit jamais de HTML : l'affichage construit
// lui-même ses éléments, et un lien n'accepte qu'une adresse http ou https.

export type Marque = "gras" | "italique" | "souligne" | "barre";
/** `lien` : l'adresse (http ou https) d'un texte rendu cliquable. */
export type Segment = { texte: string; marques: Marque[]; lien?: string } | { saut: true };
export type Bloc =
  | { type: "paragraphe"; segments: Segment[] }
  | { type: "titre"; niveau: 1 | 2 | 3; segments: Segment[] }
  | { type: "puces"; elements: Segment[][] }
  | { type: "numeros"; debut: number; elements: Segment[][] }
  | { type: "citation"; segments: Segment[] };

const ECHAPPABLES = new Set(["\\", "*", "_", "+", "~", "#", ">", "-", ".", "[", "]"]);
const DOUBLES: Record<string, Marque> = { "*": "gras", "+": "souligne", "~": "barre" };
const SYMBOLE: Record<Marque, string> = { gras: "**", italique: "_", souligne: "++", barre: "~~" };
const ORDRE: Marque[] = ["gras", "italique", "souligne", "barre"];
const TIPTAP: Record<Marque, string> = { gras: "bold", italique: "italic", souligne: "underline", barre: "strike" };
const DEPUIS_TIPTAP: Record<string, Marque> = { bold: "gras", italic: "italique", underline: "souligne", strike: "barre" };
// Au-delà, les marques restent du texte : un texte forgé ne fait pas exploser la lecture.
const PROFONDEUR_MAX = 8;

const alnum = (c: string | undefined) => c !== undefined && /[\p{L}\p{N}]/u.test(c);
const espace = (c: string | undefined) => c === undefined || /\s/.test(c);
const ADRESSE = /https?:\/\/[^\s<>"']+/y;

/** La fin d'une adresse web qui commence en `i` (hors d'un mot), ou -1. `marquesFinales` : les marques collées à la fin
 * (« **https://…** ») ne font pas partie de l'adresse. Une adresse n'est jamais lue comme des marques ni échappée. */
function finAdresse(s: string, i: number, marquesFinales: boolean): number {
  if (s[i] !== "h" || alnum(s[i - 1])) return -1;
  ADRESSE.lastIndex = i;
  const m = ADRESSE.exec(s);
  if (!m) return -1;
  let fin = i + m[0].length;
  if (marquesFinales) while (fin > i && "*+~_".includes(s[fin - 1])) fin--;
  return fin > i ? fin : -1;
}

/** Une adresse de lien acceptée : http ou https, sans espace ni guillemet, parenthèses équilibrées. */
export function adresseDeLien(adresse: string): boolean {
  if (!/^https?:\/\/[^\s<>"']+$/i.test(adresse) || adresse.length > 1000) return false;
  let niveau = 0;
  for (const c of adresse) {
    if (c === "(") niveau++;
    else if (c === ")" && --niveau < 0) return false;
  }
  return niveau === 0;
}

/** Le lien `[texte](adresse)` qui commence en `i` : la fin du texte, l'adresse et la fin ; null sinon (crochets imbriqués,
 * adresse absente, pas http ou https, parenthèse non fermée). */
function lienEn(s: string, i: number): { finTexte: number; adresse: string; fin: number } | null {
  for (let j = i + 1; j < s.length; j++) {
    if (s[j] === "\\" && ECHAPPABLES.has(s[j + 1] ?? "")) {
      j++;
      continue;
    }
    if (s[j] === "[" || s[j] === "\n") return null;
    if (s[j] !== "]") continue;
    if (j === i + 1 || s[j + 1] !== "(") return null;
    let niveau = 0;
    for (let k = j + 2; k < s.length; k++) {
      const c = s[k];
      if (/[\s<>"']/.test(c)) return null;
      if (c === "(") niveau++;
      else if (c === ")") {
        if (niveau === 0) {
          const adresse = s.slice(j + 2, k);
          return adresseDeLien(adresse) ? { finTexte: j, adresse, fin: k + 1 } : null;
        }
        niveau--;
      }
    }
    return null;
  }
  return null;
}

const longueurSuite = (s: string, i: number) => {
  let k = 0;
  while (s[i + k] === s[i]) k++;
  return k;
};

/** La marque qui s'ouvre en `i`, ou null. Gras, souligné, barré : deux caractères suivis d'un non-espace ; italique : `_`
 * hors d'un mot, suivi d'un non-espace. */
function ouverture(s: string, i: number): { nom: Marque; symbole: string } | null {
  const c = s[i];
  if (DOUBLES[c] && s[i + 1] === c && !espace(s[i + 2])) return { nom: DOUBLES[c], symbole: c + c };
  if (c === "_" && !alnum(s[i - 1]) && !espace(s[i + 1])) return { nom: "italique", symbole: "_" };
  return null;
}

/** La position de la fermeture, ou null : précédée d'un non-espace, après un contenu non vide. */
function fermeture(s: string, debut: number, symbole: string): number | null {
  for (let j = debut; j < s.length; j++) {
    if (s[j] === "\\" && ECHAPPABLES.has(s[j + 1] ?? "")) {
      j++;
      continue;
    }
    const adresse = finAdresse(s, j, true);
    if (adresse > 0) {
      j = adresse - 1;
      continue;
    }
    if (s[j] !== symbole[0]) continue;
    if (symbole.length === 2) {
      const k = longueurSuite(s, j);
      // Une suite plus longue (« a*** ») : la fermeture en prend les deux derniers.
      const p = j + k - 2;
      if (k >= 2 && p > debut && !espace(s[p - 1])) return p;
      j += k - 1;
    } else if (j > debut && !espace(s[j - 1]) && !alnum(s[j + 1])) {
      return j;
    }
  }
  return null;
}

function fusionner(segments: Segment[]): Segment[] {
  const out: Segment[] = [];
  for (const s of segments) {
    const avant = out.at(-1);
    if (avant && "texte" in avant && "texte" in s && avant.marques.join() === s.marques.join() && avant.lien === s.lien) avant.texte += s.texte;
    else out.push("texte" in s ? { texte: s.texte, marques: [...s.marques], ...(s.lien ? { lien: s.lien } : {}) } : s);
  }
  return out;
}

function enLigne(s: string, marques: Marque[], profondeur: number, lien?: string): Segment[] {
  const out: Segment[] = [];
  let tampon = "";
  const vider = () => {
    if (tampon) out.push({ texte: tampon, marques, ...(lien ? { lien } : {}) });
    tampon = "";
  };
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === "\\" && ECHAPPABLES.has(s[i + 1] ?? "")) {
      tampon += s[i + 1];
      i += 2;
      continue;
    }
    if (c === "\n") {
      vider();
      out.push({ saut: true });
      i++;
      continue;
    }
    const adresse = finAdresse(s, i, true);
    if (adresse > 0) {
      tampon += s.slice(i, adresse);
      i = adresse;
      continue;
    }
    // Un lien dans un lien n'existe pas : dedans, un crochet est du texte.
    const unLien = c === "[" && !lien && profondeur < PROFONDEUR_MAX ? lienEn(s, i) : null;
    if (unLien) {
      vider();
      out.push(...enLigne(s.slice(i + 1, unLien.finTexte), marques, profondeur + 1, unLien.adresse));
      i = unLien.fin;
      continue;
    }
    const marque = profondeur < PROFONDEUR_MAX ? ouverture(s, i) : null;
    const fin = marque ? fermeture(s, i + marque.symbole.length, marque.symbole) : null;
    if (marque && fin !== null) {
      vider();
      out.push(...enLigne(s.slice(i + marque.symbole.length, fin), [...marques, marque.nom], profondeur + 1, lien));
      i = fin + marque.symbole.length;
      continue;
    }
    tampon += c;
    i++;
  }
  vider();
  return out;
}

const segments = (texte: string) => fusionner(enLigne(texte, [], 0));

type EnCours =
  | { type: "paragraphe"; lignes: string[] }
  | { type: "citation"; lignes: string[] }
  | { type: "puces"; debut: number; elements: string[] }
  | { type: "numeros"; debut: number; elements: string[] };

/** Les blocs d'un texte ; une marque sans fermeture, ou un texte d'avant la mise en forme, reste du texte. */
export function analyser(markdown: string): Bloc[] {
  const blocs: Bloc[] = [];
  let courant: EnCours | null = null;
  const fermer = () => {
    if (!courant) return;
    if (courant.type === "paragraphe" || courant.type === "citation") {
      const s = segments(courant.lignes.join("\n"));
      if (s.length) blocs.push({ type: courant.type, segments: s });
    } else if (courant.type === "puces") {
      blocs.push({ type: "puces", elements: courant.elements.map(segments) });
    } else {
      blocs.push({ type: "numeros", debut: courant.debut, elements: courant.elements.map(segments) });
    }
    courant = null;
  };
  for (const ligne of markdown.replace(/\r\n?/g, "\n").split("\n")) {
    let m: RegExpMatchArray | null;
    if (!ligne.trim()) {
      fermer();
    } else if ((m = ligne.match(/^(#{1,3}) (.*)$/))) {
      fermer();
      const s = segments(m[2]);
      if (s.length) blocs.push({ type: "titre", niveau: m[1].length as 1 | 2 | 3, segments: s });
    } else if ((m = ligne.match(/^- (.*)$/))) {
      if (courant?.type !== "puces") {
        fermer();
        courant = { type: "puces", debut: 1, elements: [] };
      }
      courant.elements.push(m[1]);
    } else if ((m = ligne.match(/^(\d{1,9})\. (.*)$/))) {
      if (courant?.type !== "numeros") {
        fermer();
        courant = { type: "numeros", debut: Number(m[1]), elements: [] };
      }
      courant.elements.push(m[2]);
    } else if ((m = ligne.match(/^> ?(.*)$/))) {
      if (courant?.type !== "citation") {
        fermer();
        courant = { type: "citation", lignes: [] };
      }
      courant.lignes.push(m[1]);
    } else {
      if (courant?.type !== "paragraphe") {
        fermer();
        courant = { type: "paragraphe", lignes: [] };
      }
      courant.lignes.push(ligne);
    }
  }
  fermer();
  return blocs;
}

const texteDe = (s: Segment[]) => s.map((x) => ("saut" in x ? "\n" : x.texte)).join("");

/** Le texte sans marques : pour les extraits et la recherche du premier lien. */
export function texteBrut(markdown: string): string {
  return analyser(markdown)
    .map((b) => (b.type === "puces" || b.type === "numeros" ? b.elements.map(texteDe).join("\n") : texteDe(b.segments)))
    .join("\n");
}

// ─── Vers l'éditeur ─────────────────────────────────────────────────────────────────────────────────

function noeuds(s: Segment[]): JSONContent[] {
  return s.map((x) =>
    "saut" in x
      ? { type: "hardBreak" }
      : {
          type: "text",
          text: x.texte,
          ...(x.marques.length || x.lien
            ? { marks: [...x.marques.map((m) => ({ type: TIPTAP[m] })), ...(x.lien ? [{ type: "link", attrs: { href: x.lien } }] : [])] }
            : {}),
        },
  );
}

const avecContenu = (type: string, s: Segment[], attrs?: Record<string, unknown>): JSONContent => {
  const contenu = noeuds(s);
  return { type, ...(attrs ? { attrs } : {}), ...(contenu.length ? { content: contenu } : {}) };
};
const element = (s: Segment[]): JSONContent => ({ type: "listItem", content: [avecContenu("paragraph", s)] });

/** Le document de l'éditeur (Tiptap) d'un texte. */
export function versDocument(markdown: string): JSONContent {
  const contenu = analyser(markdown).map((b): JSONContent => {
    switch (b.type) {
      case "paragraphe":
        return avecContenu("paragraph", b.segments);
      case "titre":
        return avecContenu("heading", b.segments, { level: b.niveau });
      case "puces":
        return { type: "bulletList", content: b.elements.map(element) };
      case "numeros":
        return { type: "orderedList", attrs: { start: b.debut }, content: b.elements.map(element) };
      case "citation":
        return { type: "blockquote", content: [avecContenu("paragraph", b.segments)] };
    }
  });
  return { type: "doc", content: contenu.length ? contenu : [{ type: "paragraph" }] };
}

// ─── Depuis l'éditeur ───────────────────────────────────────────────────────────────────────────────

/** Protège ce qui serait lu comme une marque : `\` devant une marque, `**`, `++`, `~~`, et `_` en bord de mot. Une
 * adresse web reste telle quelle : l'aperçu de son lien la retrouve dans le texte enregistré. */
function echapper(texte: string): string {
  let r = "";
  for (let i = 0; i < texte.length; i++) {
    const adresse = finAdresse(texte, i, false);
    if (adresse > 0) {
      r += texte.slice(i, adresse);
      i = adresse - 1;
      continue;
    }
    const c = texte[i];
    const avant = texte[i - 1];
    const apres = texte[i + 1];
    if (c === "\\") r += apres === undefined || ECHAPPABLES.has(apres) ? "\\\\" : "\\";
    else if ((c === "*" || c === "+" || c === "~") && (avant === c || apres === c)) r += `\\${c}`;
    else if (c === "_" && (!alnum(avant) || !alnum(apres))) r += "\\_";
    else if (c === "[" || c === "]") r += `\\${c}`;
    else r += c;
  }
  return r;
}

/** Le texte en ligne d'un bloc : les marques s'ouvrent dans un ordre fixe et restent ouvertes tant qu'elles servent ; les
 * espaces en bord de marque restent dehors. `sautEnEspace` : dans un titre ou une liste, un retour à la ligne devient un espace. */
function enLigneMd(contenu: JSONContent[] = [], sautEnEspace = false): string {
  let sortie = "";
  let enAttente = "";
  const ouvertes: Marque[] = [];
  const fermerJusqua = (n: number) => {
    while (ouvertes.length > n) sortie += SYMBOLE[ouvertes.pop()!];
  };
  const lienDe = (n: JSONContent) => {
    const href = n.type === "text" ? n.marks?.find((m) => m.type === "link")?.attrs?.href : undefined;
    return typeof href === "string" && adresseDeLien(href) ? href : null;
  };
  for (let indice = 0; indice < contenu.length; indice++) {
    const n = contenu[indice];
    // Un lien : ses nœuds consécutifs de même adresse, mis en forme entre crochets ; les marques ouvertes se ferment avant.
    const href = lienDe(n);
    if (href) {
      const groupe: JSONContent[] = [];
      while (indice < contenu.length && lienDe(contenu[indice]) === href) {
        const x = contenu[indice];
        groupe.push({ ...x, marks: (x.marks ?? []).filter((m) => m.type !== "link") });
        indice++;
      }
      indice--;
      fermerJusqua(0);
      sortie += enAttente + `[${enLigneMd(groupe, sautEnEspace)}](${href})`;
      enAttente = "";
      continue;
    }
    if (n.type === "hardBreak") {
      fermerJusqua(0);
      sortie += enAttente + (sautEnEspace ? " " : "\n");
      enAttente = "";
      continue;
    }
    const texte = n.type === "text" ? (n.text ?? "") : texteNoeud(n);
    if (!texte) continue;
    const marques = n.type === "text" ? ORDRE.filter((m) => (n.marks ?? []).some((x) => DEPUIS_TIPTAP[x.type] === m)) : [];
    const tete = texte.match(/^\s*/)?.[0] ?? "";
    const queue = texte.slice(tete.length).match(/\s*$/)?.[0] ?? "";
    const coeur = texte.slice(tete.length, texte.length - queue.length);
    if (!coeur) {
      enAttente += texte;
      continue;
    }
    let commun = 0;
    while (commun < ouvertes.length && ouvertes[commun] === marques[commun]) commun++;
    fermerJusqua(commun);
    sortie += enAttente + tete;
    enAttente = "";
    for (const m of marques.slice(commun)) {
      sortie += SYMBOLE[m];
      ouvertes.push(m);
    }
    sortie += echapper(sautEnEspace ? coeur.replace(/\n/g, " ") : coeur);
    enAttente = queue;
  }
  fermerJusqua(0);
  return sortie + enAttente;
}

/** Le texte d'un nœud quelconque (liste imbriquée, nœud inconnu). */
function texteNoeud(n: JSONContent): string {
  if (n.type === "text") return n.text ?? "";
  if (n.type === "hardBreak") return " ";
  return (n.content ?? []).map(texteNoeud).join(n.type === "paragraph" ? "" : " ");
}

/** Une ligne de paragraphe qui serait lue comme un titre, une liste ou une citation est protégée. */
const protegerDebut = (ligne: string) =>
  /^#{1,3} /.test(ligne) || /^- /.test(ligne) || /^>/.test(ligne) ? `\\${ligne}` : ligne.replace(/^(\d{1,9})\. /, "$1\\. ");

/** Le texte en ligne d'un élément de liste : ses paragraphes (et listes imbriquées) mis bout à bout. */
function elementMd(item: JSONContent): string {
  return (item.content ?? [])
    .map((b) => (b.type === "paragraph" || b.type === "heading" ? enLigneMd(b.content, true) : echapper(texteNoeud(b))))
    .filter(Boolean)
    .join(" ");
}

function blocMd(b: JSONContent): string {
  switch (b.type) {
    case "paragraph":
      return enLigneMd(b.content).split("\n").map(protegerDebut).join("\n");
    case "heading": {
      const niveau = Math.min(Math.max(Number(b.attrs?.level) || 1, 1), 3);
      const texte = enLigneMd(b.content, true).trim();
      return texte ? `${"#".repeat(niveau)} ${texte}` : "";
    }
    case "bulletList":
      return (b.content ?? []).map(elementMd).filter(Boolean).map((t) => `- ${t}`).join("\n");
    case "orderedList": {
      const debut = Math.max(Number(b.attrs?.start) || 1, 0);
      return (b.content ?? []).map(elementMd).filter(Boolean).map((t, i) => `${debut + i}. ${t}`).join("\n");
    }
    case "blockquote":
      return (b.content ?? [])
        .map((p) => (p.type === "paragraph" ? enLigneMd(p.content) : echapper(texteNoeud(p))))
        .filter(Boolean)
        .join("\n")
        .split("\n")
        .map((l) => `> ${l}`)
        .join("\n");
    default:
      return echapper(texteNoeud(b));
  }
}

/** Le texte enregistré d'un document de l'éditeur ; les paragraphes vides disparaissent. */
export function versMarkdown(doc: JSONContent): string {
  return (doc.content ?? [])
    .map(blocMd)
    .filter((b) => b.trim())
    .join("\n\n");
}
