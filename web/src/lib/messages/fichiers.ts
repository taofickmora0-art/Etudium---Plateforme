import { ACCEPT_RENDU, formatDeRendu } from "@/lib/exercices/fichiers";

// Les pièces jointes des messages (spec de la fin du lot 5, Q3) : les formats des rendus d'exercice, 10 Mo au plus.
// La migration 0035 applique les mêmes règles (espace « messages », envoyer_message).

/** 10 Mo. */
export const MESSAGE_MAX_OCTETS = 10485760;

/** Pour le sélecteur de fichiers du système. */
export const ACCEPT_MESSAGE = ACCEPT_RENDU;

/** En clair, près du bouton « Joindre un fichier ». */
export const LIBELLE_FORMATS_MESSAGE = "PDF, Word, Excel, PowerPoint, image ou ZIP · 10 Mo maximum";

/** Le type du fichier d'après son extension et ses premiers octets, s'il est accepté ; sinon null. */
export const formatDeMessage = formatDeRendu;
