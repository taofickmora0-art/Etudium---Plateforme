import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { SCRIPT_MENU } from "@/lib/menu-lateral";
import { adresseDuSite } from "@/lib/site/adresse";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  // Adresse du site, pour les liens absolus (image de partage) : NEXT_PUBLIC_SITE_URL, exigée par le build de production.
  metadataBase: new URL(adresseDuSite()),
  title: "Étudium",
  description: "Formation, compétences digitales et accompagnement pour les étudiants et les jeunes diplômés.",
  // Ajoutée à l'écran d'accueil de l'iPhone : s'ouvre comme une appli, sous le nom « Étudium ».
  appleWebApp: { capable: true, title: "Étudium", statusBarStyle: "default" },
};

/** Couleur de la barre du navigateur et de la fenêtre de l'appli installée : le fond des pages. */
export const viewport: Viewport = { themeColor: "#F2F6FD" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning : le script ci-dessous pose data-menu sur <html> avant React (barre latérale réduite).
    <html lang="fr" className={`${inter.variable} h-full`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_MENU }} />
      </head>
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
