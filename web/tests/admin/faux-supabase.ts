// Faux client Supabase pour les tests du back-office : il enregistre chaque requête (table, opération, valeurs, filtres)
// et rend la réponse préparée pour « table.opération » (ou « rpc.nom », « storage.espace.méthode »).

export type Erreur = { code?: string; message?: string };
export type Reponse = { data?: unknown; error?: Erreur | null; count?: number | null };
export type Appel = { table: string; op: string; valeurs?: unknown; filtres: [string, ...unknown[]][]; options?: unknown };

type Preparee = Reponse | ((appel: Appel) => Reponse);

const MUTATIONS = ["insert", "update", "delete", "upsert"];
const FILTRES = ["eq", "neq", "in", "is", "gt", "gte", "lt", "lte", "like", "ilike", "match", "order", "limit", "range", "not", "or"];

export function fauxSupabase() {
  const appels: Appel[] = [];
  const reponses = new Map<string, Preparee>();

  const resoudre = (cle: string, appel: Appel): Reponse => {
    const preparee = reponses.get(cle);
    const reponse = typeof preparee === "function" ? preparee(appel) : preparee;
    return { data: null, error: null, count: null, ...reponse };
  };

  function from(table: string) {
    const appel: Appel = { table, op: "select", filtres: [] };
    let enregistre = false;
    const executer = () => {
      if (!enregistre) {
        appels.push(appel);
        enregistre = true;
      }
      return resoudre(`${table}.${appel.op}`, appel);
    };
    const requete: Record<string, unknown> = {};
    requete.select = (colonnes?: string, options?: unknown) => {
      if (!MUTATIONS.includes(appel.op)) {
        appel.valeurs = colonnes;
        appel.options = options;
      }
      return requete;
    };
    for (const op of MUTATIONS) {
      requete[op] = (valeurs?: unknown, options?: unknown) => {
        appel.op = op;
        appel.valeurs = valeurs;
        appel.options = options;
        return requete;
      };
    }
    for (const filtre of FILTRES) {
      requete[filtre] = (...args: unknown[]) => {
        appel.filtres.push([filtre, ...args]);
        return requete;
      };
    }
    requete.single = async () => executer();
    requete.maybeSingle = async () => executer();
    requete.then = (ok: (r: Reponse) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(executer()).then(ok, ko);
    return requete;
  }

  const rpc = async (nom: string, args?: unknown) => {
    const appel: Appel = { table: "rpc", op: nom, valeurs: args, filtres: [] };
    appels.push(appel);
    return resoudre(`rpc.${nom}`, appel);
  };

  const storage = {
    from: (espace: string) => {
      const methode =
        (nom: string) =>
        async (...args: unknown[]) => {
          const appel: Appel = { table: `storage.${espace}`, op: nom, valeurs: args, filtres: [] };
          appels.push(appel);
          return resoudre(`storage.${espace}.${nom}`, appel);
        };
      return { upload: methode("upload"), remove: methode("remove"), list: methode("list"), createSignedUrl: methode("createSignedUrl"), createSignedUrls: methode("createSignedUrls"), download: methode("download") };
    },
  };

  return {
    client: { from, rpc, storage },
    appels,
    /** Prépare la réponse de « table.op », « rpc.nom » ou « storage.espace.méthode ». */
    repondre: (cle: string, reponse: Preparee) => reponses.set(cle, reponse),
    /** Appels d'une table (et d'une opération) dans l'ordre. */
    de: (table: string, op?: string) => appels.filter((a) => a.table === table && (!op || a.op === op)),
    vider: () => {
      appels.length = 0;
      reponses.clear();
    },
  };
}
