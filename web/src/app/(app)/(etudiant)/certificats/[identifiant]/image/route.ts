import { imageCertificat } from "@/components/certificats/imageCertificat";
import { lireMonCertificat } from "@/lib/certificats/data";

type Contexte = { params: Promise<{ identifiant: string }> };

/**
 * L'image du certificat (PNG), générée à la demande pour son titulaire seulement ; « ?telecharger=1 » la propose au
 * téléchargement. Le partage passe par l'adresse de vérification, pas par ce fichier.
 */
export async function GET(requete: Request, { params }: Contexte): Promise<Response> {
  const { identifiant } = await params;
  const certificat = await lireMonCertificat(identifiant).catch(() => null);
  if (!certificat) return new Response("Certificat introuvable", { status: 404 });
  const png = new Uint8Array(await imageCertificat(certificat).arrayBuffer());
  const telecharger = new URL(requete.url).searchParams.has("telecharger");
  return new Response(png, {
    headers: {
      "content-type": "image/png",
      "cache-control": "private, no-store",
      ...(telecharger ? { "content-disposition": `attachment; filename="certificat-${certificat.identifiant}.png"` } : {}),
    },
  });
}
