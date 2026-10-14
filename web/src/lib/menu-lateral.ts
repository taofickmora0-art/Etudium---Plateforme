// La barre latérale repliable (grand écran) : le choix « réduite » vit sur l'élément <html> (data-menu="reduit"), que
// la feuille de style lit, et se mémorise sur l'appareil. Un petit script le remet en place avant le premier affichage.

export const CLE_MENU = "etudium:menu";
const EVENEMENT = "etudium:menu";

/** Exécuté dans <head> avant l'affichage : pas de barre qui s'ouvre puis se referme au chargement. */
export const SCRIPT_MENU = `try{if(localStorage.getItem("${CLE_MENU}")==="reduit")document.documentElement.dataset.menu="reduit"}catch(e){}`;

export const menuReduit = () => document.documentElement.dataset.menu === "reduit";

/** Réduit ou rouvre la barre, mémorise le choix, et prévient les boutons. */
export function reduireMenu(reduit: boolean) {
  if (reduit) document.documentElement.dataset.menu = "reduit";
  else delete document.documentElement.dataset.menu;
  try {
    localStorage.setItem(CLE_MENU, reduit ? "reduit" : "ouvert");
  } catch {
    // Stockage bloqué (navigation privée) : le choix vaut pour la page.
  }
  window.dispatchEvent(new Event(EVENEMENT));
}

/** Pour useSyncExternalStore : le bouton suit le choix, y compris fait dans un autre onglet. */
export function abonnerMenu(signaler: () => void) {
  const autreOnglet = (e: StorageEvent) => {
    if (e.key !== CLE_MENU) return;
    if (e.newValue === "reduit") document.documentElement.dataset.menu = "reduit";
    else delete document.documentElement.dataset.menu;
    signaler();
  };
  window.addEventListener(EVENEMENT, signaler);
  window.addEventListener("storage", autreOnglet);
  return () => {
    window.removeEventListener(EVENEMENT, signaler);
    window.removeEventListener("storage", autreOnglet);
  };
}
