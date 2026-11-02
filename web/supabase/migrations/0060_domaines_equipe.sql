-- Migration 0060 : les domaines du back-office par rôle (lot 6, partie A ; spec du 2 novembre 2026, §1).
-- Rôles fixes : le modérateur gère la communauté ; l'admin, tout sauf les rôles et le journal ; le super admin, tout.
-- Un compte suspendu n'a plus aucun domaine. La même table existe dans l'appli (src/lib/auth/domaines.ts), comparée
-- à celle-ci par un test.
--
-- equipe_contenus() passe aux admins : toutes les règles des contenus, des paiements et des comptes qui l'appellent se
-- ferment aux modérateurs. La communauté passe par equipe_communaute() : ses fonctions sont redéfinies à l'identique,
-- recopiées depuis leur dernière définition (seul l'appel change). Les lectures des paiements qui passaient par
-- exiger_equipe_moderation() passent par exiger_equipe_admin().
-- Rejouable.

begin;

-- ─── Les domaines ───────────────────────────────────────────────────────────────────────────────────
create or replace function public.domaines_role(p_role text)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select case p_role
    when 'moderateur' then array['communaute']
    when 'admin' then array['communaute', 'contenus', 'utilisateurs', 'paiements', 'statistiques']
    when 'super_admin' then array['communaute', 'contenus', 'utilisateurs', 'paiements', 'statistiques', 'roles', 'journal']
    else array[]::text[]
  end;
$$;

-- Le compte appelant a-t-il ce domaine ? Jamais pour un compte suspendu.
create or replace function public.a_domaine(p_domaine text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not public.compte_suspendu() and exists (
    select 1 from public.roles r
    where r.profil_id = (select auth.uid()) and p_domaine = any (public.domaines_role(r.role::text))
  );
$$;

-- L'équipe de la communauté : modérateurs, admins, super admins (l'ancien sens de equipe_contenus()).
create or replace function public.equipe_communaute()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.a_domaine('communaute');
$$;

-- L'équipe des contenus (et du reste du back-office) : admins et super admins.
create or replace function public.equipe_contenus()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.a_domaine('contenus');
$$;

create or replace function public.exiger_equipe_moderation()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.exiger_compte_actif();
  if not public.equipe_communaute() then
    raise exception 'Réservé à l’équipe.' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.exiger_equipe_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.exiger_compte_actif();
  if not public.equipe_contenus() then
    raise exception 'Réservé aux administrateurs.' using errcode = '42501';
  end if;
end;
$$;

revoke execute on function public.domaines_role(text) from public, anon;
revoke execute on function public.a_domaine(text) from public, anon;
revoke execute on function public.equipe_communaute() from public;
revoke execute on function public.exiger_equipe_admin() from public, anon;
grant execute on function public.domaines_role(text) to authenticated;
grant execute on function public.a_domaine(text) to authenticated;
-- Les règles des tables et des fichiers l'appellent aussi sans compte, comme equipe_contenus() (0004).
grant execute on function public.equipe_communaute() to anon, authenticated;
grant execute on function public.exiger_equipe_admin() to authenticated;

-- ─── La communauté et les lectures des paiements, redéfinies à l'identique ──────────────────────────

-- carte_publication : dernière définition en 0046_replays.sql
create or replace function public.carte_publication(p public.publications)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p.id,
    'auteur', jsonb_build_object('prenom', coalesce(pr.prenom, ''), 'nom', coalesce(pr.nom, ''), 'role', public.role_communaute(p.auteur), 'photo', pr.photo_url),
    'est_moi', p.auteur = (select auth.uid()),
    'espace', case when p.replay then jsonb_build_object('id', 'replays', 'nom', 'Replays de live')
      else jsonb_build_object('id', p.parcours_id, 'nom', public.nom_espace_communaute(p.parcours_id)) end,
    'titre', p.titre,
    'texte', p.texte,
    'piece_jointe', p.piece_jointe,
    'cree_le', p.cree_le,
    'modifiee', p.modifiee,
    'statut', p.statut,
    'apercu', p.apercu,
    'video', p.video,
    -- Programmée : vue par son auteur (onglet « Programmées ») et l'équipe seulement.
    'programmee', p.cree_le > now(),
    'sondage', public.bloc_sondage(p.id),
    -- Le bloc d'une session programmée (jamais son lien, réservé à sa fenêtre de 10 min).
    'session', (
      select jsonb_build_object(
        'id', s.id, 'debut', s.debut, 'duree_minutes', s.duree_minutes, 'plateforme', public.plateforme_session(s.lien),
        'animateur', public.animateur_session(s.formateur_id), 'statut', s.statut,
        'inscriptions', (select count(*)::int from public.inscriptions_sessions i where i.session_id = s.id),
        'inscrit', exists (select 1 from public.inscriptions_sessions i where i.session_id = s.id and i.profil_id = (select auth.uid()))
      )
      from public.sessions_live s where s.id = p.session_id
    ),
    'enregistree', exists (
      select 1 from public.publications_enregistrees e where e.publication_id = p.id and e.profil_id = (select auth.uid())
    ),
    'aimee_par', coalesce((
      select jsonb_agg(jsonb_build_object('initiales', public.initiales_avis(pr2.prenom, pr2.nom), 'photo', pr2.photo_url) order by d.cree_le desc, d.profil_id)
      from (
        select r.profil_id, r.cree_le from public.reactions_publications r
        where r.publication_id = p.id
        order by r.cree_le desc, r.profil_id
        limit 3
      ) d
      join public.profils pr2 on pr2.id = d.profil_id
    ), '[]'::jsonb),
    'reactions', (select count(*)::int from public.reactions_publications r where r.publication_id = p.id),
    'j_aime', exists (select 1 from public.reactions_publications r where r.publication_id = p.id and r.profil_id = (select auth.uid())),
    'reponses', (select count(*)::int from public.commentaires_publications c where c.publication_id = p.id),
    'dernieres_reponses', coalesce((
      select jsonb_agg(public.carte_reponse(d) order by d.cree_le, d.id)
      from (
        select c.* from public.commentaires_publications c
        where c.publication_id = p.id and c.parent_id is null
        order by c.cree_le desc, c.id desc
        limit 2
      ) d
    ), '[]'::jsonb),
    'peut_supprimer', p.auteur = (select auth.uid()) or public.equipe_communaute(),
    'peut_signaler', p.statut = 'publiee' and p.auteur <> (select auth.uid()) and not public.equipe_communaute()
  )
  from public.profils pr
  where pr.id = p.auteur;
$$;

-- carte_reponse : dernière définition en 0038_photos_communaute.sql
create or replace function public.carte_reponse(c public.commentaires_publications)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', c.id,
    'auteur', jsonb_build_object('prenom', coalesce(pr.prenom, ''), 'nom_court', public.nom_avis(pr.prenom, pr.nom), 'photo', pr.photo_url),
    'est_moi', c.auteur = (select auth.uid()),
    'texte', c.texte,
    'cree_le', c.cree_le,
    'parent_id', c.parent_id,
    'modifie', c.modifie_le is not null,
    'reactions', (select count(*)::int from public.reactions_commentaires r where r.commentaire_id = c.id),
    'j_aime', exists (select 1 from public.reactions_commentaires r where r.commentaire_id = c.id and r.profil_id = (select auth.uid())),
    'peut_modifier', c.auteur = (select auth.uid()) or public.equipe_communaute(),
    'peut_supprimer', c.auteur = (select auth.uid()) or public.equipe_communaute(),
    'peut_signaler', c.auteur <> (select auth.uid()) and not public.equipe_communaute()
  )
  from public.profils pr
  where pr.id = c.auteur;
$$;

-- carte_commentaire_lecon : dernière définition en 0038_photos_communaute.sql
create or replace function public.carte_commentaire_lecon(c public.commentaires_lecons)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', c.id,
    'auteur', jsonb_build_object('prenom', coalesce(pr.prenom, ''), 'nom_court', public.nom_avis(pr.prenom, pr.nom), 'photo', pr.photo_url),
    'est_moi', c.auteur = (select auth.uid()),
    'texte', c.texte,
    'cree_le', c.cree_le,
    'parent_id', c.parent_id,
    'modifie', c.modifie_le is not null,
    'reactions', (select count(*)::int from public.reactions_commentaires_lecons r where r.commentaire_id = c.id),
    'j_aime', exists (select 1 from public.reactions_commentaires_lecons r where r.commentaire_id = c.id and r.profil_id = (select auth.uid())),
    'peut_modifier', c.auteur = (select auth.uid()),
    'peut_supprimer', c.auteur = (select auth.uid()) or public.equipe_communaute() or public.formateur_de(public.formation_de_la_lecon(c.lecon_id)),
    'peut_signaler', c.auteur <> (select auth.uid()) and not public.equipe_communaute(),
    -- L'étiquette « Formateur » : l'auteur est le formateur de la formation.
    'formateur', exists (
      select 1 from public.formations f join public.formateurs fo on fo.id = f.formateur_id
      where f.id = public.formation_de_la_lecon(c.lecon_id) and fo.compte_id = c.auteur
    )
  )
  from public.profils pr
  where pr.id = c.auteur;
$$;

-- supprimer_publication : dernière définition en 0019_communaute.sql
create or replace function public.supprimer_publication(p_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.publications%rowtype;
begin
  perform public.exiger_compte_actif();
  select * into v from public.publications where id = p_id for update;
  if not found or not public.peut_lire_espace(v.parcours_id) then
    raise exception 'Cette publication n’existe plus.';
  end if;
  if v.auteur <> (select auth.uid()) and not public.equipe_communaute() then
    raise exception 'Cette publication n’est pas la vôtre.' using errcode = '42501';
  end if;
  delete from public.publications where id = p_id;
  return v.piece_jointe ->> 'chemin';
end;
$$;

-- supprimer_commentaire : dernière définition en 0025_communaute_commentaires.sql
create or replace function public.supprimer_commentaire(p_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.commentaires_publications%rowtype;
  v_nombre integer;
begin
  perform public.exiger_compte_actif();
  select * into v from public.commentaires_publications where id = p_id;
  if not found then
    return 0;
  end if;
  perform public.publication_ouverte(v.publication_id);
  if v.auteur <> (select auth.uid()) and not public.equipe_communaute() then
    raise exception 'Cette réponse n’est pas la vôtre.' using errcode = '42501';
  end if;
  select count(*) + 1 into v_nombre from public.commentaires_publications where parent_id = p_id;
  delete from public.commentaires_publications where id = p_id;
  return v_nombre;
end;
$$;

-- supprimer_commentaire_lecon : dernière définition en 0028_discussions_lecons.sql
create or replace function public.supprimer_commentaire_lecon(p_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.commentaires_lecons%rowtype;
  v_nombre integer;
begin
  perform public.exiger_compte_actif();
  select * into v from public.commentaires_lecons where id = p_id;
  if not found then
    return 0;
  end if;
  if v.auteur <> (select auth.uid()) and not public.equipe_communaute() and not public.formateur_de(public.formation_de_la_lecon(v.lecon_id)) then
    raise exception 'Ce commentaire n’est pas le vôtre.' using errcode = '42501';
  end if;
  select count(*) + 1 into v_nombre from public.commentaires_lecons where parent_id = p_id;
  delete from public.commentaires_lecons where id = p_id;
  return v_nombre;
end;
$$;

-- modifier_commentaire : dernière définition en 0025_communaute_commentaires.sql
create or replace function public.modifier_commentaire(p_id uuid, p_texte text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.commentaires_publications%rowtype;
  v_texte text := regexp_replace(coalesce(p_texte, ''), '^\s+|\s+$', '', 'g');
begin
  perform public.exiger_compte_actif();
  select * into v from public.commentaires_publications where id = p_id for update;
  if not found then
    raise exception 'Ce commentaire n’existe plus.';
  end if;
  perform public.publication_ouverte(v.publication_id);
  if v.auteur <> (select auth.uid()) and not public.equipe_communaute() then
    raise exception 'Ce commentaire n’est pas le vôtre.' using errcode = '42501';
  end if;
  if char_length(v_texte) not between 1 and 1000 then
    raise exception 'Écrivez votre commentaire (1 000 caractères au plus).';
  end if;
  -- Le même texte : rien ne change, pas de « modifié ».
  if v_texte = v.texte then
    return;
  end if;
  update public.commentaires_publications set texte = v_texte, modifie_le = now() where id = p_id;
end;
$$;

-- signaler : dernière définition en 0020_moderation.sql
create or replace function public.signaler(p_publication uuid, p_commentaire uuid, p_motif text, p_precisions text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_publication public.publications%rowtype;
  v_commentaire public.commentaires_publications%rowtype;
  v_auteur uuid;
  v_precisions text := regexp_replace(coalesce(p_precisions, ''), '^\s+|\s+$', '', 'g');
  v_dans_la_file boolean;
begin
  perform public.exiger_compte_actif();
  if (p_publication is null) = (p_commentaire is null) then
    raise exception 'Ce contenu n’existe plus.';
  end if;
  if p_commentaire is not null then
    select * into v_commentaire from public.commentaires_publications where id = p_commentaire;
    if not found then
      raise exception 'Ce contenu n’existe plus.';
    end if;
    v_publication := public.publication_ouverte(v_commentaire.publication_id);
    v_auteur := v_commentaire.auteur;
    v_dans_la_file := exists (select 1 from public.signalements s where s.commentaire_id = p_commentaire and s.traite_le is null);
  else
    v_publication := public.publication_ouverte(p_publication);
    v_auteur := v_publication.auteur;
    v_dans_la_file := v_publication.a_examiner or v_publication.statut <> 'publiee'
      or exists (select 1 from public.signalements s where s.publication_id = p_publication and s.traite_le is null);
  end if;
  if v_auteur = (select auth.uid()) then
    raise exception 'Vous ne pouvez pas signaler votre propre contenu.';
  end if;
  if public.equipe_communaute() then
    raise exception 'L’équipe modère depuis la file.';
  end if;
  if p_motif is null or p_motif not in ('inapproprie', 'spam', 'harcelement', 'autre') then
    raise exception 'Choisissez un motif.';
  end if;
  if p_motif = 'autre' and v_precisions = '' then
    raise exception 'Précisez le motif du signalement.';
  end if;
  if char_length(v_precisions) > 500 then
    raise exception '500 caractères au plus pour les précisions.';
  end if;
  begin
    insert into public.signalements (publication_id, commentaire_id, auteur, motif, precisions)
    values (case when p_commentaire is null then p_publication end, p_commentaire, (select auth.uid()), p_motif, v_precisions);
  exception when unique_violation then
    raise exception 'Vous avez déjà signalé ce contenu.';
  end;
  if not v_dans_la_file then
    perform public.prevenir_equipe(
      case when p_commentaire is null then 'Une publication' else 'Une réponse' end
      || ' de l’espace ' || public.nom_espace_communaute(v_publication.parcours_id) || ' attend votre examen.'
    );
  end if;
end;
$$;

-- signaler_commentaire_lecon : dernière définition en 0028_discussions_lecons.sql
create or replace function public.signaler_commentaire_lecon(p_id uuid, p_motif text, p_precisions text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.commentaires_lecons%rowtype;
  v_lecon public.lecons%rowtype;
  v_precisions text := regexp_replace(coalesce(p_precisions, ''), '^\s+|\s+$', '', 'g');
  v_dans_la_file boolean;
begin
  perform public.exiger_compte_actif();
  select * into v from public.commentaires_lecons where id = p_id;
  if not found then
    raise exception 'Ce contenu n’existe plus.';
  end if;
  v_lecon := public.lecon_discutable(v.lecon_id);
  if v.auteur = (select auth.uid()) then
    raise exception 'Vous ne pouvez pas signaler votre propre contenu.';
  end if;
  if public.equipe_communaute() then
    raise exception 'L’équipe modère depuis la file.';
  end if;
  if p_motif is null or p_motif not in ('inapproprie', 'spam', 'harcelement', 'autre') then
    raise exception 'Choisissez un motif.';
  end if;
  if p_motif = 'autre' and v_precisions = '' then
    raise exception 'Précisez le motif du signalement.';
  end if;
  if char_length(v_precisions) > 500 then
    raise exception '500 caractères au plus pour les précisions.';
  end if;
  v_dans_la_file := exists (select 1 from public.signalements s where s.commentaire_lecon_id = p_id and s.traite_le is null);
  begin
    insert into public.signalements (commentaire_lecon_id, auteur, motif, precisions)
    values (p_id, (select auth.uid()), p_motif, v_precisions);
  exception when unique_violation then
    raise exception 'Vous avez déjà signalé ce contenu.';
  end;
  if not v_dans_la_file then
    perform public.prevenir_equipe('Un commentaire de la leçon « ' || v_lecon.titre || ' » attend votre examen.');
  end if;
end;
$$;

-- bloc_sondage : dernière définition en 0026_communaute_sondages.sql
create or replace function public.bloc_sondage(p_publication uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  s public.sondages%rowtype;
  v_moi uuid := (select auth.uid());
  v_repondu boolean;
  v_ferme boolean;
  v_voit boolean;
begin
  select * into s from public.sondages where publication_id = p_publication;
  if not found then
    return null;
  end if;
  v_repondu := exists (select 1 from public.votes_sondage where publication_id = p_publication and profil_id = v_moi);
  v_ferme := s.fin_le is not null and s.fin_le <= now();
  v_voit := v_repondu or v_ferme or public.equipe_communaute()
    or exists (select 1 from public.publications p where p.id = p_publication and p.auteur = v_moi);
  return jsonb_build_object(
    'type', s.type,
    'choix_multiples', s.choix_multiples,
    'fin_le', s.fin_le,
    'ferme', v_ferme,
    'a_repondu', v_repondu,
    'votants', case when v_voit then (select count(distinct profil_id)::int from public.votes_sondage where publication_id = p_publication) end,
    'options', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', o.id,
          'texte', o.texte,
          'image', o.image,
          'votes', case when v_voit then (select count(*)::int from public.votes_sondage v where v.option_id = o.id) end,
          'moi', exists (select 1 from public.votes_sondage v where v.option_id = o.id and v.profil_id = v_moi)
        ) || case when s.type = 'quiz' and v_voit then jsonb_build_object('correcte', o.correcte) else '{}'::jsonb end
        order by o.ordre
      )
      from public.options_sondage o
      where o.publication_id = p_publication
    ), '[]'::jsonb)
  ) || case when s.type = 'quiz' and v_voit then jsonb_build_object('explication', s.explication) else '{}'::jsonb end;
end;
$$;

-- reprogrammer : dernière définition en 0026_communaute_sondages.sql
create or replace function public.reprogrammer(p_publication uuid, p_publie_le timestamptz)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.publications%rowtype;
  v_nouvelle timestamptz := coalesce(p_publie_le, now());
begin
  perform public.exiger_compte_actif();
  select * into v from public.publications where id = p_publication for update;
  if not found then
    raise exception 'Cette publication n’existe plus.';
  end if;
  if v.auteur <> (select auth.uid()) and not public.equipe_communaute() then
    raise exception 'Cette publication n’est pas la vôtre.' using errcode = '42501';
  end if;
  if v.cree_le <= now() then
    raise exception 'Cette publication est déjà parue.';
  end if;
  perform public.verifier_parution(p_publie_le);
  -- La fin d'un sondage garde son écart avec la parution.
  update public.sondages set fin_le = v_nouvelle + (fin_le - v.cree_le) where publication_id = p_publication and fin_le is not null;
  update public.publications set cree_le = v_nouvelle where id = p_publication;
end;
$$;

-- images_sondage : dernière définition en 0026_communaute_sondages.sql
create or replace function public.images_sondage(p_publication uuid)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(o.image ->> 'chemin' order by o.ordre), '{}')
  from public.options_sondage o
  join public.publications p on p.id = o.publication_id
  where o.publication_id = p_publication and o.image is not null
    and (p.auteur = (select auth.uid()) or public.equipe_communaute());
$$;

-- publication_communaute : dernière définition en 0050_acces_abonnes.sql
create or replace function public.publication_communaute(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v public.publications%rowtype;
begin
  perform public.exiger_compte_actif();
  select * into v from public.publications where id = p_id;
  if not found or not public.peut_lire_publication(v) or not (public.publication_visible(v) or public.equipe_communaute()) then
    return null;
  end if;
  return public.carte_publication(v) || jsonb_build_object('toutes_reponses', coalesce((
    select jsonb_agg(public.carte_reponse(c) order by c.cree_le, c.id)
    from public.commentaires_publications c
    where c.publication_id = v.id
  ), '[]'::jsonb));
end;
$$;

-- publication_ouverte : dernière définition en 0050_acces_abonnes.sql
create or replace function public.publication_ouverte(p_id uuid)
returns public.publications
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v public.publications%rowtype;
begin
  perform public.exiger_compte_actif();
  select * into v from public.publications where id = p_id;
  if not found then
    raise exception 'Cette publication n’existe plus.';
  end if;
  if not public.peut_lire_publication(v) then
    raise exception 'Cet espace ne vous est pas ouvert.' using errcode = '42501';
  end if;
  if v.statut <> 'publiee' and not public.equipe_communaute() then
    if v.statut = 'en_attente' and v.auteur = (select auth.uid()) then
      raise exception 'Cette publication attend sa vérification.';
    end if;
    raise exception 'Cette publication n’existe plus.';
  end if;
  -- Programmée : rien avant son heure (l'auteur le sait ; pour les autres, elle n'existe pas encore).
  if v.cree_le > now() and not public.equipe_communaute() then
    if v.auteur = (select auth.uid()) then
      raise exception 'Cette publication n’est pas encore parue.';
    end if;
    raise exception 'Cette publication n’existe plus.';
  end if;
  return v;
end;
$$;

-- peut_lire_espace : dernière définition en 0050_acces_abonnes.sql
create or replace function public.peut_lire_espace(p_parcours uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and not public.compte_suspendu()
    and (
      p_parcours is null
      or public.equipe_communaute()
      or exists (
        select 1 from public.parcours pa
        where pa.id = p_parcours and pa.actif
          and (
            public.abonne((select auth.uid()))
            or exists (
              select 1
              from public.formations_parcours fp
              join public.formations f on f.id = fp.formation_id
              where fp.parcours_id = pa.id and f.formateur_id is not null and f.formateur_id = public.ma_fiche_formateur()
            )
            or exists (
              select 1
              from public.progression_lecons pr
              join public.lecons l on l.id = pr.lecon_id
              join public.modules m on m.id = l.module_id
              join public.formations_parcours fp on fp.formation_id = m.formation_id
              where fp.parcours_id = pa.id and pr.profil_id = (select auth.uid())
            )
          )
      )
    );
$$;

-- acces_abonne : dernière définition en 0050_acces_abonnes.sql
create or replace function public.acces_abonne()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.equipe_communaute() or public.abonne((select auth.uid()));
$$;

-- avis_equipe : dernière définition en 0010_avis.sql
create or replace function public.avis_equipe()
returns table (
  id uuid,
  formation_titre text,
  formation_slug text,
  auteur text,
  note smallint,
  commentaire text,
  masque boolean,
  cree_le timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, f.titre, f.slug, public.nom_avis(p.prenom, p.nom), a.note, a.commentaire, a.masque, a.cree_le
  from public.avis a
  join public.formations f on f.id = a.formation_id
  join public.profils p on p.id = a.profil_id
  where public.equipe_communaute()
  order by a.cree_le desc;
$$;

-- masquer_avis : dernière définition en 0010_avis.sql
create or replace function public.masquer_avis(p_avis uuid, p_masque boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.equipe_communaute() then
    raise exception 'Le masquage des avis est réservé à l’équipe.' using errcode = '42501';
  end if;
  update public.avis set masque = coalesce(p_masque, false) where id = p_avis;
end;
$$;

-- cote_conversation : dernière définition en 0035_messagerie.sql
create or replace function public.cote_conversation(p_conversation uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when c.etudiant_id = (select auth.uid()) then 'etudiant'
    when c.formateur_id is not null and c.formateur_id = (select auth.uid()) and public.a_role('formateur') then 'formateur'
    when c.formateur_id is null and public.equipe_communaute() then 'equipe'
  end
  from public.conversations c
  where c.id = p_conversation;
$$;

-- conversations_de : dernière définition en 0035_messagerie.sql
create or replace function public.conversations_de(p_espace text)
returns setof public.conversations
language sql
stable
security definer
set search_path = ''
as $$
  select c.*
  from public.conversations c
  where (
      (p_espace = 'etudiant' and c.etudiant_id = (select auth.uid()))
      or (p_espace = 'formateur' and c.formateur_id = (select auth.uid()) and public.a_role('formateur'))
      or (p_espace = 'equipe' and c.formateur_id is null and public.equipe_communaute())
    )
    and exists (select 1 from public.messages m where m.conversation_id = c.id);
$$;

-- droit_session : dernière définition en 0018_sessions_live.sql
create or replace function public.droit_session(p_formateur uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  -- coalesce : sans fiche (étudiant), la comparaison est « inconnue », jamais « vraie » ni ignorée.
  select public.equipe_communaute() or coalesce(p_formateur = public.ma_fiche_formateur(), false);
$$;

-- creer_session : dernière définition en 0036_formateur_sans_espace_etudiant.sql
create or replace function public.creer_session(
  p_titre text,
  p_description text,
  p_debut timestamptz,
  p_duree integer,
  p_lien text,
  p_parcours uuid,
  p_formateur uuid,
  p_image jsonb default null,
  p_video jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_titre text := regexp_replace(coalesce(p_titre, ''), '^\s+|\s+$', '', 'g');
  v_description text := regexp_replace(coalesce(p_description, ''), '^\s+|\s+$', '', 'g');
  v_lien text := regexp_replace(coalesce(p_lien, ''), '^\s+|\s+$', '', 'g');
  v_equipe boolean := public.equipe_communaute();
  v_fiche uuid := public.ma_fiche_formateur();
  v_formateur uuid;
  v_id uuid;
  v_promo jsonb;
  v_publication uuid;
begin
  if not v_equipe and v_fiche is null then
    raise exception 'Accès réservé aux formateurs et à l’équipe.' using errcode = '42501';
  end if;
  v_formateur := case when v_equipe then p_formateur else v_fiche end;
  if v_formateur is not null and not exists (select 1 from public.formateurs where id = v_formateur) then
    raise exception 'Cette fiche formateur n’existe plus.';
  end if;
  perform public.verifier_session(v_titre, v_description, p_debut, p_duree, v_lien, true);
  v_promo := public.verifier_promotion(p_image, p_video, null);
  perform public.verifier_espace_session(p_parcours);

  insert into public.sessions_live (titre, description, debut, duree_minutes, lien, parcours_id, formateur_id, cree_par, promo_image, promo_video)
  values (v_titre, v_description, p_debut, p_duree, v_lien, p_parcours, v_formateur, (select auth.uid()),
          nullif(v_promo -> 'image', 'null'::jsonb), nullif(v_promo -> 'video', 'null'::jsonb))
  returning id into v_id;

  -- La session paraît aussitôt dans la communauté (espace de son parcours, Général pour tous les parcours).
  insert into public.publications (auteur, parcours_id, titre, texte, piece_jointe, video, statut, session_id)
  values ((select auth.uid()), p_parcours, v_titre, coalesce(nullif(v_description, ''), 'Session live programmée.'),
          nullif(v_promo -> 'image', 'null'::jsonb), nullif(v_promo -> 'video', 'null'::jsonb), 'publiee', v_id)
  returning id into v_publication;
  update public.sessions_live set publication_id = v_publication where id = v_id;

  perform public.notifier(
    array(select id from public.profils), 'sessions_live', 'Nouvelle session live : ' || v_titre,
    public.majuscule(public.quand_session(p_debut)) || ', avec ' || public.animateur_session(v_formateur) || '.', '/evenements'
  );
  -- L'animateur (un formateur, qui ne reçoit plus les sessions live) est prévenu dans son espace ; pas s'il l'a créée.
  perform public.notifier(
    array(select fo.compte_id from public.formateurs fo where fo.id = v_formateur and fo.compte_id is not null), 'service',
    'Session live programmée : ' || v_titre, public.majuscule(public.quand_session(p_debut)) || '.', '/formateur/sessions'
  );
  return v_id;
end;
$$;

-- modifier_session : dernière définition en 0024_sessions_promotion.sql
create or replace function public.modifier_session(
  p_session uuid,
  p_titre text,
  p_description text,
  p_debut timestamptz,
  p_duree integer,
  p_lien text,
  p_parcours uuid,
  p_formateur uuid,
  p_image jsonb default null,
  p_video jsonb default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.sessions_live%rowtype;
  v_titre text := regexp_replace(coalesce(p_titre, ''), '^\s+|\s+$', '', 'g');
  v_description text := regexp_replace(coalesce(p_description, ''), '^\s+|\s+$', '', 'g');
  v_lien text := regexp_replace(coalesce(p_lien, ''), '^\s+|\s+$', '', 'g');
  v_equipe boolean := public.equipe_communaute();
  v_heure_changee boolean;
  v_promo jsonb;
begin
  if not v_equipe and public.ma_fiche_formateur() is null then
    raise exception 'Accès réservé aux formateurs et à l’équipe.' using errcode = '42501';
  end if;
  select * into v from public.sessions_live where id = p_session for update;
  if not found then
    raise exception 'Session introuvable.';
  end if;
  if not public.droit_session(v.formateur_id) then
    raise exception 'Cette session n’est pas la vôtre.' using errcode = '42501';
  end if;
  if v.statut = 'annulee' then
    raise exception 'Cette session est annulée.';
  end if;
  if v.debut + make_interval(mins => v.duree_minutes) <= now() then
    raise exception 'Une session terminée ne se modifie plus.';
  end if;
  v_heure_changee := p_debut is distinct from v.debut;
  perform public.verifier_session(v_titre, v_description, p_debut, p_duree, v_lien, v_heure_changee);
  -- La même affiche que la session est gardée telle quelle (elle est déjà jointe à sa publication).
  v_promo := public.verifier_promotion(p_image, p_video, v.promo_image);
  if p_parcours is distinct from v.parcours_id then
    perform public.verifier_espace_session(p_parcours);
  end if;
  if v_equipe and p_formateur is not null and not exists (select 1 from public.formateurs where id = p_formateur) then
    raise exception 'Cette fiche formateur n’existe plus.';
  end if;

  update public.sessions_live
  set titre = v_titre, description = v_description, debut = p_debut, duree_minutes = p_duree, lien = v_lien,
      parcours_id = p_parcours, formateur_id = case when v_equipe then p_formateur else v.formateur_id end,
      promo_image = nullif(v_promo -> 'image', 'null'::jsonb), promo_video = nullif(v_promo -> 'video', 'null'::jsonb)
  where id = p_session;
  update public.publications
  set parcours_id = p_parcours, titre = v_titre, texte = coalesce(nullif(v_description, ''), 'Session live programmée.'),
      piece_jointe = nullif(v_promo -> 'image', 'null'::jsonb), video = nullif(v_promo -> 'video', 'null'::jsonb), modifie_le = now()
  where session_id = p_session;

  if v_heure_changee then
    update public.inscriptions_sessions set rappel_veille_le = null, rappel_heure_le = null, rappel_dix_le = null where session_id = p_session;
    update public.sessions_live set debut_annonce_le = null where id = p_session;
  end if;
  if v_heure_changee or p_duree is distinct from v.duree_minutes or v_lien is distinct from v.lien then
    perform public.notifier(
      array(select profil_id from public.inscriptions_sessions where session_id = p_session), 'sessions_live',
      'Session live modifiée', v_titre || ' : ' || public.quand_session(p_debut) || '.', '/evenements'
    );
  end if;
end;
$$;

-- annuler_session : dernière définition en 0018_sessions_live.sql
create or replace function public.annuler_session(p_session uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.sessions_live%rowtype;
begin
  if not public.equipe_communaute() and public.ma_fiche_formateur() is null then
    raise exception 'Accès réservé aux formateurs et à l’équipe.' using errcode = '42501';
  end if;
  select * into v from public.sessions_live where id = p_session for update;
  if not found then
    raise exception 'Session introuvable.';
  end if;
  if not public.droit_session(v.formateur_id) then
    raise exception 'Cette session n’est pas la vôtre.' using errcode = '42501';
  end if;
  if v.statut = 'annulee' then
    raise exception 'Cette session est annulée.';
  end if;
  if v.debut + make_interval(mins => v.duree_minutes) <= now() then
    raise exception 'Une session terminée ne se modifie plus.';
  end if;
  update public.sessions_live set statut = 'annulee', annulee_le = now() where id = p_session;
  perform public.notifier(
    array(select profil_id from public.inscriptions_sessions where session_id = p_session), 'sessions_live',
    'Session live annulée', v.titre || ', prévue ' || public.quand_session(v.debut) || '.', '/evenements'
  );
end;
$$;

-- sessions_equipe : dernière définition en 0018_sessions_live.sql
create or replace function public.sessions_equipe()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.equipe_communaute() then
    raise exception 'Accès réservé à l’équipe.' using errcode = '42501';
  end if;
  return public.liste_sessions_edition(null);
end;
$$;

-- peut_publier_replay : dernière définition en 0046_replays.sql
create or replace function public.peut_publier_replay()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.equipe_communaute() or public.ma_fiche_formateur() is not null;
$$;

-- codes_promo_equipe : dernière définition en 0051_paiements_equipe.sql
create or replace function public.codes_promo_equipe()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.exiger_equipe_admin();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', c.id,
      'code', c.code,
      'type', c.type,
      'valeur', c.valeur,
      'debut', c.debut,
      'fin', c.fin,
      'limite', c.limite,
      'actif', c.actif,
      'cree_le', c.cree_le,
      -- Seuls les paiements réussis consomment un code.
      'utilisations', (select count(*)::integer from public.paiements p where p.code_promo_id = c.id and p.statut = 'reussi')
    ) order by c.cree_le desc, c.code)
    from public.codes_promo c
  ), '[]'::jsonb);
end;
$$;

-- paiements_equipe : dernière définition en 0054_abonnements_manuels.sql
create or replace function public.paiements_equipe(p_statut text, p_recherche text, p_page integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_q text := lower(btrim(coalesce(p_recherche, '')));
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_resultat jsonb;
begin
  perform public.exiger_equipe_admin();
  with lignes as (
    select p.id, p.cree_le, p.montant, p.statut, p.operateur, p.telephone_masque, p.numero_recu, p.profil_id, p.source, p.moyen_manuel,
           coalesce(pr.prenom, '') as prenom, coalesce(pr.nom, '') as nom, coalesce(u.email, '') as email,
           f.code as formule_code, f.nom as formule_nom, f.duree_mois
    from public.paiements p
    join public.formules f on f.id = p.formule_id
    left join public.profils pr on pr.id = p.profil_id
    left join auth.users u on u.id = p.profil_id
    where not (p.source = 'payiz' and p.payiz_id is null and p.montant > 0)
      and case
        when coalesce(p_statut, '') = '' then true
        when p_statut = 'expire' then p.statut in ('expire', 'annule')
        else p.statut = p_statut
      end
      and (
        v_q = ''
        or strpos(lower(coalesce(p.numero_recu, '')), v_q) > 0
        or strpos(lower(coalesce(u.email, '')), v_q) > 0
        or strpos(public.sans_accents(coalesce(pr.prenom, '') || ' ' || coalesce(pr.nom, '')), public.sans_accents(v_q)) > 0
      )
  ),
  page as (
    select * from lignes order by cree_le desc, id limit 20 offset (v_page - 1) * 20
  )
  select jsonb_build_object(
    'total', (select count(*) from lignes),
    'lignes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', g.id,
        'cree_le', g.cree_le,
        'compte', jsonb_build_object('id', g.profil_id, 'prenom', g.prenom, 'nom', g.nom, 'email', g.email),
        'formule', jsonb_build_object('code', g.formule_code, 'nom', g.formule_nom, 'duree_mois', g.duree_mois),
        'montant', g.montant,
        'statut', g.statut,
        'operateur', g.operateur,
        'telephone_masque', g.telephone_masque,
        'numero_recu', g.numero_recu,
        'source', g.source,
        'moyen_manuel', g.moyen_manuel
      ) order by g.cree_le desc, g.id)
      from page g
    ), '[]'::jsonb)
  ) into v_resultat;
  return v_resultat;
end;
$$;

-- paiement_equipe : dernière définition en 0051_paiements_equipe.sql
create or replace function public.paiement_equipe(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v public.paiements%rowtype;
begin
  perform public.exiger_equipe_admin();
  select * into v from public.paiements where id = p_id;
  if not found then
    return null;
  end if;
  return public.carte_paiement(v) || jsonb_build_object(
    'compte', (
      select jsonb_build_object('id', pr.id, 'prenom', pr.prenom, 'nom', pr.nom, 'email', coalesce(u.email, ''))
      from public.profils pr left join auth.users u on u.id = pr.id
      where pr.id = v.profil_id
    ),
    'abonnement', (
      select jsonb_build_object('id', a.id, 'debut', a.debut, 'fin', a.fin, 'annule_le', a.annule_le, 'motif_annulation', a.motif_annulation)
      from public.abonnements a where a.paiement_id = v.id
    )
  );
end;
$$;

-- resume_paiements : dernière définition en 0051_paiements_equipe.sql
create or replace function public.resume_paiements()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_mois timestamptz := date_trunc('month', now() at time zone 'Africa/Porto-Novo') at time zone 'Africa/Porto-Novo';
begin
  perform public.exiger_equipe_admin();
  return jsonb_build_object(
    'revenus_mois', coalesce((select sum(p.montant) from public.paiements p where p.statut = 'reussi' and p.confirme_le >= v_mois), 0),
    'reussis_mois', (select count(*) from public.paiements p where p.statut = 'reussi' and p.confirme_le >= v_mois),
    'echoues_mois', (select count(*) from public.paiements p where p.statut = 'echoue' and p.cree_le >= v_mois),
    'abonnes_actifs', (
      select count(distinct a.profil_id) from public.abonnements a
      where a.annule_le is null and a.debut <= now() and now() < a.fin
    )
  );
end;
$$;

-- abonnements_compte : dernière définition en 0054_abonnements_manuels.sql
create or replace function public.abonnements_compte(p_compte uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.exiger_equipe_admin();
  return jsonb_build_object(
    'etat', public.etat_abonnement(p_compte),
    'abonnements', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id,
        'formule', jsonb_build_object('code', f.code, 'nom', f.nom, 'duree_mois', f.duree_mois),
        'debut', a.debut,
        'fin', a.fin,
        'annule_le', a.annule_le,
        'motif_annulation', a.motif_annulation,
        'paiement_id', p.id,
        'source', p.source,
        'moyen_manuel', p.moyen_manuel,
        'operateur', p.operateur,
        'montant', p.montant,
        'numero_recu', p.numero_recu
      ) order by a.debut desc)
      from public.abonnements a
      join public.formules f on f.id = a.formule_id
      join public.paiements p on p.id = a.paiement_id
      where a.profil_id = p_compte
    ), '[]'::jsonb)
  );
end;
$$;

-- politique « communaute : lire » : 0019_communaute.sql
drop policy if exists "communaute : lire" on storage.objects;
create policy "communaute : lire" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'communaute'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or (select public.fichier_communaute_lisible(objects.name))
      or (select public.equipe_communaute())
    )
  );

-- politique « communaute : supprimer » : 0019_communaute.sql
drop policy if exists "communaute : supprimer" on storage.objects;
create policy "communaute : supprimer" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'communaute'
    and (
      ((storage.foldername(name))[1] = (select auth.uid())::text and not (select public.fichier_communaute_attache(objects.name)))
      or (select public.equipe_communaute())
    )
  );

-- ─── Les notifications de l'équipe des contenus ─────────────────────────────────────────────────────
-- Les membres actifs de l'équipe qui ont un domaine (comme membres_equipe(), 0016, pour un domaine).
create or replace function public.membres_domaine(p_domaine text)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct r.profil_id), '{}')
  from public.roles r
  where p_domaine = any (public.domaines_role(r.role::text))
    and not exists (select 1 from public.suspensions s where s.profil_id = r.profil_id);
$$;
revoke execute on function public.membres_domaine(text) from public, anon, authenticated;

-- « Formation à valider » : aux admins (domaine des contenus), plus au modérateur. Dernière définition en 0016_notifications.sql,
-- recopiée à l'identique sauf ses destinataires.
create or replace function public.notifications_formations()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_formateur uuid;
  v_deja uuid[] := '{}';
  v_parcours record;
  v_suiveurs uuid[];
  v_remarque text;
begin
  select compte_id into v_formateur from public.formateurs where id = new.formateur_id;

  -- Première publication (republier une formation archivée ne compte pas) : les étudiants de ses parcours, une
  -- seule fois chacun, avec le premier parcours qu'ils suivent ; puis son formateur.
  if new.publiee_le is not null and (tg_op = 'INSERT' or old.publiee_le is null) then
    for v_parcours in
      select pa.id, pa.nom_court
      from public.formations_parcours fp
      join public.parcours pa on pa.id = fp.parcours_id
      where fp.formation_id = new.id
      order by pa.ordre, pa.nom_court
    loop
      select coalesce(array_agg(distinct p.profil_id), '{}') into v_suiveurs
      from public.progression_lecons p
      join public.lecons l on l.id = p.lecon_id
      join public.modules m on m.id = l.module_id
      join public.formations_parcours fp on fp.formation_id = m.formation_id
      where fp.parcours_id = v_parcours.id
        and not (p.profil_id = any (v_deja))
        and p.profil_id is distinct from v_formateur;
      perform public.notifier(
        v_suiveurs, 'nouveaux_contenus', 'Nouvelle formation : ' || new.titre,
        'Dans le parcours ' || v_parcours.nom_court || '.', '/formations/' || new.slug
      );
      v_deja := v_deja || v_suiveurs;
    end loop;
    if v_formateur is not null then
      perform public.notifier(array[v_formateur], 'service', 'Votre formation est en ligne', new.titre, '/formateur/formations/' || new.id);
    end if;
  end if;

  if tg_op = 'UPDATE' then
    if new.statut = 'archivee' and old.statut <> 'archivee' then
      perform public.notifier(
        public.suiveurs_formation(new.id), 'service', 'Formation archivée',
        new.titre || ' n’est plus disponible. Votre progression est conservée.', '/mes-formations'
      );
    end if;

    if new.envoyee_le is not null and old.envoyee_le is null then
      perform public.notifier(
        public.membres_domaine('contenus'), 'service', 'Formation à valider',
        new.titre || ', par ' || coalesce((select nom from public.formateurs where id = new.formateur_id), 'un formateur'),
        '/admin/formations/' || new.id || '?onglet=publication'
      );
    end if;

    if new.renvoyee_le is not null and new.renvoyee_le is distinct from old.renvoyee_le and v_formateur is not null then
      v_remarque := coalesce(new.remarque_relecture, '');
      if char_length(v_remarque) > 120 then
        v_remarque := left(v_remarque, 119) || '…';
      end if;
      perform public.notifier(
        array[v_formateur], 'service', 'Votre formation est à corriger', v_remarque,
        '/formateur/formations/' || new.id || '?onglet=publication'
      );
    end if;
  end if;
  return null;
end;
$$;

commit;
