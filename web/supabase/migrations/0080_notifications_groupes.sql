-- Migration 0080 : une notification à chaque message d'un groupe (ta demande du 11 novembre 2026).
--   - Chaque nouveau message d'un groupe prévient ses membres : la cloche (avec son son, site ouvert), le téléphone (s'il
--     a activé les notifications) ; un clic mène au groupe, sur le message.
--   - Ni l'auteur, ni ceux qui ont coupé le groupe (« Couper les notifications »), ni l'auteur du message cité : il reçoit
--     déjà « Nouvelle réponse » (0075).
--   - Une seule notification non lue par groupe et par compte : la précédente laisse sa place à la nouvelle.
--   - Un message que l'IA doit encore relire n'est pas cité dans la notification.
-- À appliquer après la 0076 (après la 0079 si tu l'appliques aussi). Rejouable.

begin;

-- ─── Les membres d'un groupe ────────────────────────────────────────────────────────────────────────
-- La règle de peut_lire_groupe, vue pour chaque compte (comme compter_membres_groupe, 0075).
create or replace function public.comptes_du_groupe(p_groupe uuid)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id
  from public.groupes g
  cross join public.profils p
  where g.id = p_groupe
    and not exists (select 1 from public.suspensions s where s.profil_id = p.id)
    and (
      (g.parcours_id is null and g.formation_id is null)
      or exists (select 1 from public.roles r where r.profil_id = p.id and 'communaute' = any (public.domaines_role(r.role::text)))
      or (g.parcours_id is not null and (
        public.abonne(p.id)
        or exists (
          select 1
          from public.formations_parcours fp
          join public.formations f on f.id = fp.formation_id
          join public.formateurs fo on fo.id = f.formateur_id
          where fp.parcours_id = g.parcours_id and fo.compte_id = p.id
            and exists (select 1 from public.roles r where r.profil_id = p.id and r.role = 'formateur')
        )
        or exists (
          select 1
          from public.inscriptions_formations i
          join public.formations_parcours fp on fp.formation_id = i.formation_id
          where fp.parcours_id = g.parcours_id and i.profil_id = p.id
        )
      ))
      or (g.formation_id is not null and (
        exists (
          select 1 from public.formations f
          join public.formateurs fo on fo.id = f.formateur_id
          where f.id = g.formation_id and fo.compte_id = p.id
            and exists (select 1 from public.roles r where r.profil_id = p.id and r.role = 'formateur')
        )
        or exists (
          select 1 from public.inscriptions_formations i
          join public.formations f on f.id = i.formation_id
          where i.formation_id = g.formation_id and i.profil_id = p.id and f.statut in ('publiee', 'archivee')
        )
      ))
    );
$$;

-- ─── La notification d'un nouveau message ───────────────────────────────────────────────────────────
create or replace function public.notifier_message_groupe()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_groupe public.groupes%rowtype;
  v_cite uuid;
  v_titre text;
  v_texte text;
  v_envoi record;
begin
  if new.supprime_le is not null or new.moderation <> 'visible' then
    return null;
  end if;
  select * into v_groupe from public.groupes where id = new.groupe_id;
  if not found or not v_groupe.actif then
    return null;
  end if;
  select m.auteur_id into v_cite from public.messages_groupes m where m.id = new.reponse_a;
  v_titre := left('Nouveau message dans le groupe ' || v_groupe.nom, 200);
  v_texte := coalesce((select public.nom_avis(p.prenom, p.nom) from public.profils p where p.id = new.auteur_id), 'Un membre') || ' : '
    || case
         when new.duree_ms is not null then 'Note vocale'
         when new.analyse_attendue then 'nouveau message'
         else '« ' || public.extrait_message_groupe(new.texte, new.image is not null) || ' »'
       end;
  -- Le lien dépend du compte (l'espace formateur pour un formateur sans espace étudiant) : un envoi par lien.
  for v_envoi in
    select public.lien_groupe(d.compte, v_groupe.slug, new.id) as lien, array_agg(d.compte) as comptes
    from (
      select m.compte
      from public.comptes_du_groupe(new.groupe_id) as m(compte)
      where m.compte <> new.auteur_id
        and m.compte is distinct from v_cite
        and not exists (select 1 from public.groupes_coupes c where c.groupe_id = new.groupe_id and c.profil_id = m.compte)
    ) d
    group by 1
  loop
    -- Une seule notification non lue par groupe : la précédente laisse sa place.
    delete from public.notifications n
    where n.destinataire = any (v_envoi.comptes) and n.lue_le is null and n.titre = v_titre;
    perform public.notifier(v_envoi.comptes, 'communaute', v_titre, v_texte, v_envoi.lien, false);
  end loop;
  return null;
end;
$$;

drop trigger if exists messages_groupes_notifier on public.messages_groupes;
create trigger messages_groupes_notifier
  after insert on public.messages_groupes
  for each row execute function public.notifier_message_groupe();

revoke execute on function public.comptes_du_groupe(uuid) from public, anon, authenticated;
revoke execute on function public.notifier_message_groupe() from public, anon, authenticated;

commit;
