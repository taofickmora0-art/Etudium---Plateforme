import { NextResponse } from "next/server";

/**
 * Une redirection vers une page du site par une adresse relative (« /accueil ») : le navigateur reste sur l'adresse par
 * laquelle il est venu (localhost, l'adresse réseau de l'ordinateur pour un téléphone, le domaine en ligne). En
 * développement, `request.url` dit toujours localhost : un téléphone renvoyé là ne trouvait rien. Jamais hors du site.
 */
export function rediriger(chemin: string): NextResponse {
  const surLeSite = chemin.startsWith("/") && !chemin.startsWith("//") && !chemin.startsWith("/\\");
  return new NextResponse(null, { status: 307, headers: { Location: surLeSite ? chemin : "/" } });
}
