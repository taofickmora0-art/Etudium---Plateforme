import { notFound } from "next/navigation";
import { connection } from "next/server";
import { BandeauIndisponible } from "@/components/ui/BandeauIndisponible";
import { canAccess } from "@/lib/auth/permissions";
import type { EtatsCartes } from "@/lib/catalogue/types";
import { compteConnecte } from "@/lib/catalogue/visiteur";
import { lireFormateurPublic } from "@/lib/formateurs/data";
import { lireApprenants } from "@/lib/inscriptions/data";
import { lireSuiviDuCompte } from "@/lib/mes-formations/data";
import { ProfilFormateur } from "./ProfilFormateur";

/** Ce qui accompagne les cartes (apprenants, inscription, favoris) n'empêche jamais le profil de s'afficher. */
async function ouRien<T>(lire: () => Promise<T>, quoi: string): Promise<T | null> {
  try {
    return await lire();
  } catch (erreur) {
    console.error(`Lecture ${quoi} impossible :`, erreur instanceof Error ? erreur.message : erreur);
    return null;
  }
}

/**
 * Le profil public d'un formateur (/formateurs/[id] ; spec du 2 novembre 2026, §6), pour un visiteur ou un compte
 * connecté. Fiche introuvable (ou identifiant invalide) : 404 ; sans la migration 0070 : un bandeau neutre. Un compte formateur
 * le voit comme un visiteur : ni progression, ni cœur, ni « Message ».
 */
export async function PageProfilFormateur({ params }: { params: Promise<{ id: string }> }) {
  const [compte, { id }] = await Promise.all([compteConnecte(), params]);
  const formateur = await lireFormateurPublic(id);
  if (formateur === "absente") {
    return <BandeauIndisponible />;
  }
  if (!formateur) notFound();
  // Un formateur n'a pas l'espace étudiant (restructuration R1) ; l'équipe le garde.
  const etudiant = compte !== null && canAccess("etudiant", compte.roles);
  const [apprenants, suivi] = await Promise.all([
    ouRien(lireApprenants, "du nombre d'apprenants"),
    etudiant ? ouRien(lireSuiviDuCompte, "des formations suivies") : Promise.resolve(null),
  ]);
  const etats: EtatsCartes = { apprenants, inscrites: suivi?.inscrites ?? {}, favoris: suivi?.favoris ?? null };
  await connection(); // l'heure de la visite (« A rejoint : il y a … »), jamais celle de la compilation
  return (
    <ProfilFormateur
      formateur={formateur}
      peutEcrire={etudiant && formateur.peutEcrire}
      variante={compte ? "connecte" : "public"}
      etats={etats}
      maintenant={new Date()}
    />
  );
}
