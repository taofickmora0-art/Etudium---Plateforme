-- Migration 0047 : plus de formation achetée seule (restructuration validée le 20 octobre 2026, §5.2 ; liste du 31
-- octobre 2026, tâche 13). Les trois abonnements (Basique, Standard, Premium) ouvrent toutes les formations : le réglage
-- « Disponible seule » et le prix d'une formation disparaissent, avec leurs colonnes. Même définition qu'en 0014
-- (formations_formateur), sans ces deux réglages. Rejouable.

begin;

-- Les réglages de l'équipe que le formateur ne touche pas, sans l'achat seul ni le prix.
create or replace function public.formations_formateur()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_fiche uuid;
begin
  -- Publiée (par l'équipe) : l'envoi en relecture et la remarque n'ont plus lieu d'être.
  if tg_op = 'UPDATE' and new.statut = 'publiee' and old.statut is distinct from 'publiee' then
    new.envoyee_le := null;
    new.renvoyee_le := null;
    new.remarque_relecture := null;
  end if;

  if current_user <> 'authenticated' or public.equipe_contenus() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    v_fiche := public.ma_fiche_formateur();
    if v_fiche is null then
      raise exception 'Votre compte n’est pas encore relié à une fiche formateur. Contactez l’équipe Étudium.' using errcode = '42501';
    end if;
    -- Un brouillon, à sa fiche, avec les réglages par défaut : le reste est décidé par l'équipe.
    new.formateur_id := v_fiche;
    new.statut := 'brouillon';
    new.gratuite := false;
    new.badge := null;
    new.seuil_video := 90;
    new.envoyee_le := null;
    new.renvoyee_le := null;
    new.remarque_relecture := null;
    new.modifiee_par_formateur_le := null;
    new.note_moyenne := null;
    new.nb_avis := 0;
    return new;
  end if;

  if new.statut is distinct from old.statut
     or new.formateur_id is distinct from old.formateur_id
     or new.gratuite is distinct from old.gratuite
     or new.badge is distinct from old.badge
     or new.seuil_video is distinct from old.seuil_video
     or new.envoyee_le is distinct from old.envoyee_le
     or new.renvoyee_le is distinct from old.renvoyee_le
     or new.remarque_relecture is distinct from old.remarque_relecture
     or new.modifiee_par_formateur_le is distinct from old.modifiee_par_formateur_le
     or new.note_moyenne is distinct from old.note_moyenne
     or new.nb_avis is distinct from old.nb_avis then
    raise exception 'Ce réglage revient à l’équipe Étudium.';
  end if;

  -- En ligne : l'équipe voit « Modifiée par le formateur le … ».
  if old.publiee_le is not null then
    new.modifiee_par_formateur_le := now();
  end if;
  return new;
end;
$$;

alter table public.formations drop constraint if exists formations_prix_positif;
alter table public.formations drop column if exists achat_separe;
alter table public.formations drop column if exists prix_fcfa;

commit;
