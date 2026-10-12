import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { versMultirange, type Intervalle } from "@/lib/video/suivi";

// Envoi du temps réellement regardé (spec du lot 1, §5) : toutes les 10 s, à la pause et en quittant la page.
// Une route plutôt qu'une action serveur : l'envoi doit survivre à la fermeture de la page (fetch « keepalive »).
// La base vérifie l'accès, la fenêtre de temps et le seuil (migration 0007) ; ici, on filtre ce qui vient d'ailleurs.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SECONDES = z.number().finite().min(0).max(86_400);

const CORPS = z.discriminatedUnion("action", [
  z.object({ action: z.literal("commencer"), lecon: z.string().regex(UUID) }),
  z.object({
    action: z.literal("enregistrer"),
    lecon: z.string().regex(UUID),
    passages: z
      .array(z.tuple([SECONDES, SECONDES]).refine(([debut, fin]) => debut < fin))
      .max(50),
    position: SECONDES,
    duree: SECONDES.nullable().optional(),
  }),
]);

const reponse = (status: number, corps: unknown = {}) => Response.json(corps, { status });

/** Même site seulement : un formulaire ou un script d'ailleurs ne peut pas envoyer de JSON avec notre origine. */
function memeOrigine(request: Request): boolean {
  const origine = request.headers.get("origin");
  const hote = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? new URL(request.url).host;
  if (!origine || !(request.headers.get("content-type") ?? "").startsWith("application/json")) return false;
  try {
    return new URL(origine).host === hote;
  } catch {
    return false;
  }
}

export async function POST(request: Request): Promise<Response> {
  if (!memeOrigine(request)) return reponse(403, { erreur: "Requête refusée." });

  let corps: z.infer<typeof CORPS>;
  try {
    corps = CORPS.parse(await request.json());
  } catch {
    return reponse(400, { erreur: "Requête invalide." });
  }

  const supabase = await createClient();
  const { data: session, error: erreurSession } = await supabase.auth.getUser();
  if (erreurSession || !session?.user) return reponse(401, { erreur: "Connectez-vous pour enregistrer votre progression." });

  if (corps.action === "commencer") {
    const { error } = await supabase.rpc("commencer_visionnage", { p_lecon: corps.lecon });
    return error ? reponse(409, { erreur: "Visionnage refusé." }) : reponse(200);
  }

  const { data, error } = await supabase.rpc("enregistrer_visionnage", {
    p_lecon: corps.lecon,
    p_passages: versMultirange(corps.passages as Intervalle[]),
    p_position: Math.floor(corps.position),
    p_duree_video: corps.duree ? Math.floor(corps.duree) : null,
  });
  if (error || !data) return reponse(409, { erreur: "Passage refusé." });
  const resultat = data as { secondes_vues: number; reference: number; terminee: boolean };
  return reponse(200, { secondesVues: resultat.secondes_vues, reference: resultat.reference, terminee: resultat.terminee });
}
