import { TexteMisEnForme } from "@/components/communaute/TexteMisEnForme";
import type { DocumentLecon as Doc } from "@/lib/lecon/document";
import { DocumentLecon } from "./DocumentLecon";

/** Le contenu écrit d'une leçon ou d'une consigne : le document riche (fin du lot 4), sinon le texte ancien mis en forme. */
export function ContenuEcrit({ document, images, texte, className }: { document?: Doc | null; images?: Record<string, string>; texte: string; className?: string }) {
  if (document) return <DocumentLecon document={document} images={images ?? {}} className={className} />;
  return texte ? <TexteMisEnForme texte={texte} className={className ?? "text-[15px] leading-6 text-texte max-sm:text-sm max-sm:leading-[22px]"} /> : null;
}

/** Une leçon ou une consigne a-t-elle un contenu écrit ? */
export const aUnContenuEcrit = (c: { document?: Doc | null; texte: string }) => Boolean(c.document || c.texte);
