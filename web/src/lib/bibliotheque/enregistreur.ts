// L'enregistrement de la page lue, côté navigateur (lecteur de la Bibliothèque). noter_lecture accepte 60 appels par
// minute et par compte (migration 0074) : la page part tout de suite la première fois, puis au plus une fois toutes les
// 3 secondes, la dernière page l'emportant ; `vider` envoie sans attendre la page en attente (fermeture du lecteur,
// onglet caché). Revenir à la page déjà notée n'envoie rien.

/** 3 secondes : au plus 20 appels par minute, bien sous la limite de la base, même en tournant les pages très vite. */
export const DELAI_ENREGISTREMENT = 3000;

export type Enregistreur = {
  /** La page affichée a changé. */
  noter(page: number): void;
  /** Envoie tout de suite la page en attente, s'il y en a une. */
  vider(): void;
  /** Abandonne la page en attente (sans l'envoyer). */
  arreter(): void;
};

export function creerEnregistreur(envoyer: (page: number) => void, delai = DELAI_ENREGISTREMENT, maintenant: () => number = () => Date.now()): Enregistreur {
  let envoyee: number | null = null;
  let enAttente: number | null = null;
  let dernierEnvoi = -Infinity;
  let minuterie: ReturnType<typeof setTimeout> | null = null;

  const effacer = () => {
    if (minuterie !== null) clearTimeout(minuterie);
    minuterie = null;
  };
  const partir = () => {
    effacer();
    const page = enAttente;
    enAttente = null;
    if (page === null || page === envoyee) return;
    envoyee = page;
    dernierEnvoi = maintenant();
    envoyer(page);
  };

  return {
    noter(page) {
      enAttente = page;
      if (minuterie !== null) return;
      if (page === envoyee) {
        enAttente = null;
        return;
      }
      const attente = dernierEnvoi + delai - maintenant();
      // Rien d'envoyé depuis 3 secondes : tout de suite ; sinon, à la fin des 3 secondes.
      if (attente <= 0) partir();
      else minuterie = setTimeout(partir, attente);
    },
    vider: partir,
    arreter() {
      effacer();
      enAttente = null;
    },
  };
}
