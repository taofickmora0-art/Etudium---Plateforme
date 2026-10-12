import type { FicheFormation, LeconFiche } from "@/lib/catalogue/types";
import { parSlug } from "../catalogue/cartes-design";

// Programme d'Excel des données d'exemple (supabase/exemples/lot-1.sql) : 4 modules, 12 leçons, 2 aperçus.

/** Identifiants au format UUID (la page refuse les autres). */
export const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

type Options = { apercu?: boolean; titreCourt?: string | null; accessible?: boolean };
const lecon = (n: number, titre: string, dureeSecondes: number, { apercu = false, titreCourt = null, accessible = apercu }: Options = {}): LeconFiche => ({
  id: id(n),
  titre,
  titreCourt,
  dureeSecondes,
  apercu,
  accessible,
});

/** Excel vue par un visiteur ou un compte gratuit : seuls les deux aperçus sont ouverts. */
export const EXCEL: FicheFormation = {
  ...parSlug("maitriser-microsoft-excel"),
  dureeSecondes: 8407,
  nbLecons: 12,
  description: "Des formules aux tableaux croisés dynamiques.",
  objectifs: [],
  competences: [],
  formateur: { nom: "Dr Mireille Adjovi", titre: "Enseignante en statistiques appliquées", domaine: "Statistiques", presentation: "" },
  modules: [
    {
      id: id(101),
      titre: "Bases d’Excel",
      lecons: [
        lecon(1, "Découvrir l’interface", 370, { apercu: true }),
        lecon(2, "Saisir et mettre en forme des données", 750, { apercu: true, titreCourt: "Saisir et mettre en forme" }),
        lecon(3, "Les formules essentielles", 845),
        lecon(4, "Références relatives et absolues", 640, { titreCourt: "Références relatives" }),
      ],
    },
    {
      id: id(102),
      titre: "Formules et fonctions",
      lecons: [lecon(5, "SI, ET, OU", 800), lecon(6, "RECHERCHEX", 900), lecon(7, "Fonctions de texte et de date", 705)],
    },
    {
      id: id(103),
      titre: "Analyse de données",
      lecons: [
        lecon(8, "Trier et filtrer", 492),
        lecon(9, "Les tableaux croisés dynamiques", 760, { titreCourt: "Tableaux croisés dynamiques" }),
        lecon(10, "Les graphiques avancés", 605),
      ],
    },
    { id: id(104), titre: "Automatisation", lecons: [lecon(11, "Mise en forme conditionnelle", 570), lecon(12, "Introduction aux macros", 970)] },
  ],
};

/** La même formation, toutes leçons ouvertes (équipe, ou abonnement au lot 2). */
export const EXCEL_OUVERTE: FicheFormation = { ...EXCEL, modules: EXCEL.modules.map((m) => ({ ...m, lecons: m.lecons.map((l) => ({ ...l, accessible: true })) })) };

/** Zotero, gratuite, vue par un visiteur : aucune leçon d'aperçu, donc tout est fermé sans compte. */
export const ZOTERO: FicheFormation = {
  ...parSlug("zotero-gerer-ses-references"),
  dureeSecondes: 900,
  nbLecons: 2,
  description: "",
  objectifs: [],
  competences: [],
  formateur: null,
  modules: [{ id: id(201), titre: "Premiers pas", lecons: [lecon(21, "Installer Zotero", 420), lecon(22, "Importer ses références", 480)] }],
};
