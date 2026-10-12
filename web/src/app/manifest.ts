import type { MetadataRoute } from "next";

/**
 * Appli installable (tâche 0.7) : Chrome propose « Installer Étudium ». Sur Android, l'écran de lancement est composé
 * à partir du nom, de la couleur de fond et de l'icône de 512 px.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Étudium",
    short_name: "Étudium",
    description: "Formation, compétences digitales et accompagnement pour les étudiants et les jeunes diplômés.",
    lang: "fr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F2F6FD",
    theme_color: "#F2F6FD",
    icons: [
      { src: "/icons/icone-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icone-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icone-masquable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
