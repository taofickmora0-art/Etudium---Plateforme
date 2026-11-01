import { randomUUID } from "node:crypto";
import type { Banc } from "./banc";

// Aide des tests du lot 2 : un abonnement posé directement en base (superutilisateur), sans passer par Payiz. Les dates
// sont des expressions SQL libres (« now() - interval '1 day' »), écrites par les tests eux-mêmes.

export type OptionsAbonnement = {
  formule?: "basique" | "standard" | "premium";
  debut?: string;
  fin?: string;
  annule?: boolean;
};

/** Un paiement réussi et son abonnement ; renvoie l'identifiant de l'abonnement. */
export async function abonner(banc: Banc, profilId: string, options: OptionsAbonnement = {}): Promise<string> {
  const { formule = "standard", debut = "now() - interval '1 day'", fin = "now() + interval '30 days'", annule = false } = options;
  const paiement = randomUUID();
  await banc.db.query(
    `insert into public.paiements (id, profil_id, formule_id, prix_initial, montant, statut, payiz_id, operateur, telephone_masque, essai_le, confirme_le, numero_recu)
     select $1, $2, f.id, 15000, 15000, 'reussi', $3, 'mtn', '+229 01 •• •• •• 00', now(), now(), $4
     from public.formules f where f.code = $5`,
    [paiement, profilId, `pay_${paiement.slice(0, 8)}`, `ET-R-TEST-${paiement.slice(0, 8)}`, formule],
  );
  const { rows } = await banc.db.query<{ id: string }>(
    `insert into public.abonnements (profil_id, formule_id, paiement_id, debut, fin, annule_le, motif_annulation)
     select $1, f.id, $2, ${debut}, ${fin}, case when $3 then now() end, case when $3 then 'Test' end
     from public.formules f where f.code = $4
     returning id`,
    [profilId, paiement, annule, formule],
  );
  return rows[0].id;
}
