import { adresseDeLien, texteBrut, versDocument } from "@/lib/communaute/mise-en-forme";
import { FOURNISSEURS } from "@/lib/video/plateformes";

// Le contenu riche d'une leçon (fin du lot 4, spec §1.1) : le document de l'éditeur (Tiptap), dans une liste fermée de
// blocs et de marques. Le serveur le vérifie à chaque enregistrement ; l'affichage ne construit que ces éléments. Les
// attributs que l'éditeur ajoute de lui-même (cible d'un lien, type d'une liste) sont retirés ; tout le reste d'inconnu
// est refusé.

export type TonEncadre = "info" | "astuce" | "attention" | "retenir";
export type MarqueDoc = { type: "bold" | "italic" | "underline" | "strike" } | { type: "link"; attrs: { href: string } };
export type NoeudDoc = { type: string; attrs?: Record<string, unknown>; content?: NoeudDoc[]; text?: string; marks?: MarqueDoc[] };
export type DocumentLecon = { type: "doc"; content: NoeudDoc[] };

export const TONS_ENCADRE: readonly TonEncadre[] = ["info", "astuce", "attention", "retenir"];
export const LIMITES = { caracteres: 20_000, octets: 307_200, images: 40, tableaux: 10 } as const;
/** Une image de l'espace `images_lecons` : `{formation}/{uuid}.{jpg|png|webp}`. */
export const CHEMIN_IMAGE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;

const INCONNU = "Le contenu contient un élément non reconnu.";
const LIEN = "Un lien doit commencer par http:// ou https://.";

class Refus extends Error {}
/** Un attribut vérifié : sa valeur gardée, `undefined` pour l'omettre ; une valeur refusée lève `Refus`. */
type Attribut = (valeur: unknown) => unknown;

const refuser = (message = INCONNU): never => {
  throw new Refus(message);
};
const texteBorne = (max: number): Attribut => (v) => (v === undefined || v === null ? "" : typeof v === "string" && v.length <= max ? v : refuser());
const parmi = (valeurs: readonly unknown[]): Attribut => (v) => (valeurs.includes(v) ? v : refuser());
const fixe = (valeur: unknown): Attribut => (v) => (v === undefined || v === valeur ? valeur : refuser());

const INLINE = ["text", "hardBreak"] as const;
const LISTES = ["bulletList", "orderedList"] as const;
const BLOCS = ["paragraph", "heading", ...LISTES, "blockquote", "encadre", "imageLecon", "table", "videoLecon", "horizontalRule"] as const;
const CELLULE = { colspan: fixe(1), rowspan: fixe(1), colwidth: fixe(null) };

type Regle = {
  attrs?: Record<string, Attribut>;
  /** Ajoutés par l'éditeur, sans effet ici : retirés sans refus. */
  ignores?: string[];
  /** Les enfants permis ; absent : aucun enfant. */
  enfants?: readonly string[];
  /** Au moins un enfant. */
  plein?: boolean;
};

const REGLES: Record<string, Regle> = {
  paragraph: { enfants: INLINE },
  heading: { attrs: { level: parmi([2, 3]) }, enfants: INLINE },
  bulletList: { enfants: ["listItem"], plein: true },
  orderedList: {
    attrs: { start: (v) => (v === undefined ? undefined : Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 10_000 ? v : refuser()) },
    ignores: ["type"],
    enfants: ["listItem"],
    plein: true,
  },
  listItem: { enfants: ["paragraph"], plein: true },
  blockquote: { enfants: ["paragraph"], plein: true },
  encadre: { attrs: { ton: parmi(TONS_ENCADRE) }, enfants: ["paragraph", ...LISTES], plein: true },
  imageLecon: {
    attrs: { chemin: (v) => (typeof v === "string" && CHEMIN_IMAGE.test(v) ? v : refuser()), alt: texteBorne(200), legende: texteBorne(300) },
  },
  videoLecon: {
    attrs: {
      fournisseur: parmi(FOURNISSEURS),
      id: (v) => (typeof v === "string" && v.length > 0 && v.length <= 200 && !/[\s"'<>]/.test(v) ? v : refuser()),
    },
  },
  horizontalRule: {},
  table: { enfants: ["tableRow"], plein: true },
  tableRow: { enfants: ["tableHeader", "tableCell"], plein: true },
  tableHeader: { attrs: CELLULE, enfants: ["paragraph"], plein: true },
  tableCell: { attrs: CELLULE, enfants: ["paragraph"], plein: true },
  hardBreak: {},
};

const CLES_NOEUD = new Set(["type", "attrs", "content", "text", "marks"]);
const estObjet = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function marques(brut: unknown): MarqueDoc[] {
  if (!Array.isArray(brut)) return refuser();
  return brut.map((m): MarqueDoc => {
    if (!estObjet(m) || Object.keys(m).some((k) => k !== "type" && k !== "attrs")) return refuser();
    if (m.type === "bold" || m.type === "italic" || m.type === "underline" || m.type === "strike") {
      if (m.attrs !== undefined && !(estObjet(m.attrs) && Object.keys(m.attrs).length === 0)) return refuser();
      return { type: m.type };
    }
    if (m.type === "link" && estObjet(m.attrs)) {
      const { href, ...reste } = m.attrs;
      if (Object.keys(reste).some((k) => !["target", "rel", "class"].includes(k))) return refuser();
      if (typeof href !== "string" || !adresseDeLien(href)) return refuser(LIEN);
      return { type: "link", attrs: { href } };
    }
    return refuser();
  });
}

function noeud(brut: unknown, permis: readonly string[], compte: { images: number; tableaux: number }): NoeudDoc {
  if (!estObjet(brut) || typeof brut.type !== "string" || !permis.includes(brut.type)) return refuser();
  if (Object.keys(brut).some((k) => !CLES_NOEUD.has(k))) return refuser();
  if (brut.type === "text") {
    if (typeof brut.text !== "string" || brut.text.length === 0 || brut.attrs !== undefined || brut.content !== undefined) return refuser();
    return brut.marks === undefined ? { type: "text", text: brut.text } : { type: "text", text: brut.text, marks: marques(brut.marks) };
  }
  const regle = REGLES[brut.type];
  if (brut.text !== undefined || brut.marks !== undefined) return refuser();
  if (brut.type === "imageLecon") compte.images++;
  if (brut.type === "table") compte.tableaux++;

  const sortie: NoeudDoc = { type: brut.type };
  if (brut.attrs !== undefined && !estObjet(brut.attrs)) return refuser();
  const attrsBruts = (brut.attrs ?? {}) as Record<string, unknown>;
  for (const cle of Object.keys(attrsBruts)) if (!regle.attrs?.[cle] && !regle.ignores?.includes(cle)) return refuser();
  if (regle.attrs) {
    const attrs: Record<string, unknown> = {};
    for (const [cle, verifier] of Object.entries(regle.attrs)) {
      const valeur = verifier(attrsBruts[cle]);
      if (valeur !== undefined) attrs[cle] = valeur;
    }
    if (Object.keys(attrs).length > 0) sortie.attrs = attrs;
  }

  if (brut.content !== undefined) {
    if (!regle.enfants || !Array.isArray(brut.content)) return refuser();
    if (brut.content.length > 0) sortie.content = brut.content.map((e) => noeud(e, regle.enfants!, compte));
  }
  if (regle.plein && !sortie.content) return refuser();
  return sortie;
}

/** Vérifie et normalise un document reçu ; le premier refus donne son message. */
export function validerDocument(brut: unknown): { ok: true; document: DocumentLecon } | { ok: false; message: string } {
  try {
    if (!estObjet(brut) || brut.type !== "doc" || !Array.isArray(brut.content) || brut.content.length === 0) return refuser();
    if (Object.keys(brut).some((k) => k !== "type" && k !== "content")) return refuser();
    const compte = { images: 0, tableaux: 0 };
    const document: DocumentLecon = { type: "doc", content: brut.content.map((n) => noeud(n, BLOCS, compte)) };
    if (texteDuDocument(document).length > LIMITES.caracteres) return refuser("Le texte dépasse 20 000 caractères.");
    if (compte.images > LIMITES.images) return refuser("40 images au plus par leçon.");
    if (compte.tableaux > LIMITES.tableaux) return refuser("10 tableaux au plus par leçon.");
    if (new TextEncoder().encode(JSON.stringify(document)).length > LIMITES.octets) return refuser("Le contenu est trop lourd (300 Ko au plus).");
    return { ok: true, document };
  } catch (e) {
    if (e instanceof Refus) return { ok: false, message: e.message };
    throw e;
  }
}

const enLigne = (n: NoeudDoc): string => (n.content ?? []).map((e) => (e.type === "hardBreak" ? "\n" : (e.text ?? ""))).join("");

function lignes(n: NoeudDoc): string[] {
  switch (n.type) {
    case "paragraph":
    case "heading":
      return [enLigne(n)];
    case "bulletList":
    case "orderedList":
    case "listItem":
    case "blockquote":
    case "encadre":
      return (n.content ?? []).flatMap(lignes);
    case "table":
      return (n.content ?? []).map((rangee) => (rangee.content ?? []).map((c) => (c.content ?? []).flatMap(lignes).join(" ")).join("\t"));
    default:
      return [];
  }
}

/** Le texte brut : un bloc par ligne, les cellules d'une rangée séparées par une tabulation. */
export function texteDuDocument(doc: DocumentLecon): string {
  return doc.content.flatMap(lignes).join("\n");
}

const niveauDeux = (n: NoeudDoc): NoeudDoc =>
  n.type === "heading" ? { ...n, attrs: { level: n.attrs?.level === 3 ? 3 : 2 } } : n;

/** Le document d'une leçon ancienne (Markdown restreint de la communauté) ; un titre de niveau 1 devient de niveau 2. */
export function depuisMarkdown(markdown: string): DocumentLecon {
  const converti = versDocument(markdown) as DocumentLecon;
  const r = validerDocument({ type: "doc", content: converti.content.map(niveauDeux) });
  if (r.ok) return r.document;
  const brut = texteBrut(markdown).trim();
  return { type: "doc", content: [brut ? { type: "paragraph", content: [{ type: "text", text: brut.slice(0, LIMITES.caracteres) }] } : { type: "paragraph" }] };
}

/** Les chemins des images du document, dans l'ordre. */
export function cheminsImages(doc: DocumentLecon): string[] {
  const chemins: string[] = [];
  const parcourir = (n: NoeudDoc) => {
    if (n.type === "imageLecon" && typeof n.attrs?.chemin === "string") chemins.push(n.attrs.chemin);
    n.content?.forEach(parcourir);
  };
  doc.content.forEach(parcourir);
  return chemins;
}

/** Rien d'écrit : que des paragraphes vides. */
export function documentVide(doc: DocumentLecon): boolean {
  return doc.content.every((n) => n.type === "paragraph" && !n.content?.length);
}
