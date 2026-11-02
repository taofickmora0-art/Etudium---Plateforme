import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/** ma_progression_jeu (0063), lue une seule fois par requête : l'en-tête et le profil la partagent. */
export const lireJeuBrut = cache(async () => (await createClient()).rpc("ma_progression_jeu"));
