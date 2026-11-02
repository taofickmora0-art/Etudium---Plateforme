// Les en-têtes de sécurité de toutes les pages (spec de la mise en ligne, §1.2), posés par next.config.ts.
// Pas de Content-Security-Policy complète au lancement (lecteurs vidéo, pdf.js, Supabase temps réel : à faire ensuite,
// en mode rapport d'abord) : seulement l'interdiction d'afficher le site dans un cadre d'un autre site.
// Caméra, micro et géolocalisation : aucune fonction de l'appli ne s'en sert (un dépôt de fichier passe par le sélecteur
// du téléphone, pas par la caméra du navigateur) ; les lecteurs vidéo intégrés ne les demandent pas non plus.

export type EnteteHttp = { key: string; value: string };

/** `production` : le site en ligne, servi en https (HSTS n'a de sens que là). */
export function entetesDeSecurite({ production }: { production: boolean }): EnteteHttp[] {
  return [
    // Contre le « clickjacking » : le site ne s'affiche dans aucun cadre (ancienne et nouvelle forme).
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
    // Le navigateur s'en tient au type annoncé (un fichier déposé ne devient pas un script).
    { key: "X-Content-Type-Options", value: "nosniff" },
    // Vers un autre site, seule l'origine part (jamais le chemin, qui peut porter un identifiant).
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    // Deux ans de https obligatoire, sous-domaines compris ; « preload » : inscriptible dans la liste des navigateurs.
    ...(production ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }] : []),
  ];
}
