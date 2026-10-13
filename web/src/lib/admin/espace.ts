// L'éditeur de formation sert à deux espaces (spec de l'espace formateur, §6) : le back-office de l'équipe et l'espace
// formateur. Les adresses vers lesquelles il renvoie suivent l'espace où l'on se trouve.

export type EspaceEdition = "admin" | "formateur";

export const baseFormations = (espace: EspaceEdition) => (espace === "formateur" ? "/formateur/formations" : "/admin/formations");

/** L'espace transmis par un formulaire (champ caché « espace ») ; toute autre valeur vaut le back-office. */
export const espaceDe = (fd: FormData): EspaceEdition => (fd.get("espace") === "formateur" ? "formateur" : "admin");
