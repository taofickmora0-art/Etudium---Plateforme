import type { CarteCatalogue, ParcoursCatalogue } from "@/lib/catalogue/types";

// Les 10 formations du catalogue du design (NdCatalogue), comme les rendrait listCatalogue().

export const PARCOURS_DESIGN: ParcoursCatalogue[] = [
  { slug: "reussite-academique", nom: "Réussite académique", nomCourt: "Académique", couleur: "academique", ordre: 1 },
  { slug: "competences-digitales", nom: "Compétences digitales", nomCourt: "Digital", couleur: "digital", ordre: 2 },
  { slug: "business-revenus-en-ligne", nom: "Business & revenus en ligne", nomCourt: "Business", couleur: "business", ordre: 3 },
];
const [ACA, DIG, BUS] = PARCOURS_DESIGN;

const carte = (
  slug: string,
  titre: string,
  resume: string,
  parcours: ParcoursCatalogue,
  position: number,
  champs: Partial<CarteCatalogue>,
): CarteCatalogue => ({
  id: slug,
  slug,
  titre,
  resume,
  niveau: "debutant",
  gratuite: false,
  badge: null,
  publieeLe: "2026-08-01T00:00:00Z",
  dureeSecondes: 3600,
  nbLecons: 6,
  parcours: [{ ...parcours, position }],
  note: null,
  nbAvis: 0,
  couverture: null,
  ...champs,
});

export const CARTES_DESIGN: CarteCatalogue[] = [
  carte("maitriser-microsoft-excel", "Maîtriser Microsoft Excel", "Formules, tableaux croisés dynamiques et graphiques pour analyser vos données.", ACA, 2, {
    niveau: "intermediaire",
    badge: "populaire",
    dureeSecondes: 22800,
    nbLecons: 12,
    publieeLe: "2026-08-13T00:00:00Z",
  }),
  carte("microsoft-word-travaux-universitaires", "Microsoft Word pour vos travaux universitaires", "Styles, sommaire automatique et mise en page du mémoire, étape par étape.", ACA, 1, {
    dureeSecondes: 15000,
    publieeLe: "2026-08-18T00:00:00Z",
  }),
  carte("zotero-gerer-ses-references", "Zotero : gérer ses références", "Collectez vos sources et générez citations et bibliographie sans erreur.", ACA, 4, {
    gratuite: true,
    dureeSecondes: 8400,
    publieeLe: "2026-08-23T00:00:00Z",
  }),
  carte("powerpoint-reussir-sa-soutenance", "PowerPoint : réussir sa soutenance", "Structurez vos diapositives et présentez avec assurance le jour de la soutenance.", ACA, 3, {
    dureeSecondes: 11700,
    publieeLe: "2026-08-28T00:00:00Z",
  }),
  carte("methodologie-du-memoire", "Méthodologie du mémoire", "De la problématique à la rédaction : la méthode pour avancer sans vous perdre.", ACA, 5, {
    niveau: "intermediaire",
    badge: "populaire",
    dureeSecondes: 27900,
    publieeLe: "2026-09-02T00:00:00Z",
  }),
  carte("canva-debutant-a-expert", "Canva, de débutant à expert", "Créez affiches, présentations et visuels soignés, même sans base en design.", DIG, 1, {
    gratuite: true,
    dureeSecondes: 18600,
    publieeLe: "2026-09-07T00:00:00Z",
  }),
  carte("intelligence-artificielle-etudes", "L’intelligence artificielle au service de vos études", "Utilisez l’IA pour réviser, résumer et rédiger, en gardant un regard critique.", DIG, 2, {
    badge: "nouveau",
    dureeSecondes: 12600,
    publieeLe: "2026-10-07T00:00:00Z",
  }),
  carte("montage-video-smartphone", "Montage vidéo sur smartphone", "Tournez, montez et exportez des vidéos propres avec votre seul téléphone.", DIG, 3, {
    niveau: "intermediaire",
    dureeSecondes: 17400,
    publieeLe: "2026-09-17T00:00:00Z",
  }),
  carte("marketing-digital-debutants", "Marketing digital pour débutants", "Les bases pour trouver vos premiers clients en ligne : réseaux, contenu, publicité.", BUS, 1, {
    dureeSecondes: 30600,
    publieeLe: "2026-09-22T00:00:00Z",
  }),
  carte("lancer-son-activite-freelance", "Lancer son activité de freelance", "Offre, tarifs, premiers clients : les étapes pour démarrer une activité en ligne.", BUS, 2, {
    niveau: "intermediaire",
    badge: "populaire",
    dureeSecondes: 21600,
    publieeLe: "2026-09-27T00:00:00Z",
  }),
];

export const parSlug = (slug: string) => CARTES_DESIGN.find((c) => c.slug === slug)!;
