import sharp from "sharp";
import { imageCertificat, TAILLE_CERTIFICAT } from "@/components/certificats/imageCertificat";
import { lireMonCertificat } from "@/lib/certificats/data";
import { pdfDepuisJpeg } from "@/lib/certificats/pdf";

type Contexte = { params: Promise<{ identifiant: string }> };

/** Le certificat en PDF (A4 paysage), pour son titulaire seulement : l'image du certificat, en JPEG, sur une page. */
export async function GET(_requete: Request, { params }: Contexte): Promise<Response> {
  const { identifiant } = await params;
  const certificat = await lireMonCertificat(identifiant).catch(() => null);
  if (!certificat) return new Response("Certificat introuvable", { status: 404 });
  const png = Buffer.from(await imageCertificat(certificat).arrayBuffer());
  const jpeg = await sharp(png).flatten({ background: "#ffffff" }).jpeg({ quality: 90 }).toBuffer();
  const pdf = pdfDepuisJpeg(new Uint8Array(jpeg), TAILLE_CERTIFICAT.width, TAILLE_CERTIFICAT.height);
  return new Response(pdf, {
    headers: {
      "content-type": "application/pdf",
      "cache-control": "private, no-store",
      "content-disposition": `attachment; filename="certificat-${certificat.identifiant}.pdf"`,
    },
  });
}
