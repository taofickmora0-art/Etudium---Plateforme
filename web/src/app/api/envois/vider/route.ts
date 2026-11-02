import { createHash, timingSafeEqual } from "node:crypto";
import { connection } from "next/server";
import { viderFile } from "@/lib/envois/file";

// La tâche planifiée de Vercel (web/vercel.json, chaque jour) vide la file des envois (migration 0058) : les e-mails et
// notifications produits sans visite (rappels d'abonnement, séries de la nuit) partent sans attendre la prochaine page.
// Vercel appelle cette adresse avec « Authorization: Bearer <CRON_SECRET> » : sans CRON_SECRET posée, ou avec un autre
// en-tête, rien ne part (401). Chaque passage de viderFile prend au plus 10 envois : on recommence tant qu'il en reste,
// dans le temps permis. Ce qui n'a pas pu partir est repris au passage suivant (une page, un message, demain).

// Sous Node, le runtime par défaut (node:crypto) : avec Cache Components, ni « runtime » ni « dynamic » ne se déclarent
// (le build les refuse). Offre Hobby de Vercel : 60 secondes au plus pour une fonction (sans « Fluid compute »).
export const maxDuration = 60;

/** Au plus 20 passages (200 envois), et aucun nouveau passage après 30 s : le dernier a le temps de finir. */
const PASSAGES_MAX = 20;
const BUDGET_MS = 30_000;

const empreinte = (texte: string) => createHash("sha256").update(texte).digest();

/** L'en-tête attendu, comparé à temps constant (empreintes de même longueur) ; jamais sans CRON_SECRET. */
function autorise(entete: string | null, secret: string | undefined): boolean {
  if (!secret?.trim()) return false;
  return timingSafeEqual(empreinte(entete ?? ""), empreinte(`Bearer ${secret}`));
}

export async function GET(request: Request): Promise<Response> {
  // Toujours à la requête, jamais pré-rendue (le réglage « dynamic » n'existe plus avec Cache Components).
  await connection();
  if (!autorise(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return Response.json({ erreur: "Non autorisé." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const debut = Date.now();
  const bilan = { envoyes: 0, echecs: 0, passages: 0 };
  while (bilan.passages < PASSAGES_MAX && Date.now() - debut < BUDGET_MS) {
    // viderFile ne lève jamais : sans clés d'envoi ou sans jeton reconnu par la base, il rend { 0, 0 }.
    const passage = await viderFile();
    bilan.passages++;
    bilan.envoyes += passage.envoyes;
    bilan.echecs += passage.echecs;
    if (passage.envoyes + passage.echecs === 0) break;
  }
  return Response.json(bilan, { headers: { "Cache-Control": "no-store" } });
}
