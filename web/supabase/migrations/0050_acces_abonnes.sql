-- Migration 0050 : ce qu'ouvre un abonnement (lot 2, spec du 1er novembre 2026, §5 et choix 1). Un abonnement actif ouvre
-- les leçons des formations payantes, tous les espaces de la communauté, les lives et leurs replays. L'équipe garde
-- tout ; le formateur garde ses lives et les replays qu'il publie ; le compte gratuit garde Général et les espaces des
-- parcours qu'il a commencés. Chaque fonction reprend sa dernière définition et n'ajoute que la condition. Rejouable.

begin;

-- ─── Les aides ──────────────────────────────────────────────────────────────────────────────────────
create or replace function public.acces_abonne()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.equipe_contenus() or public.abonne((select auth.uid()));
$$;

create or replace function public.acces_replays()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.acces_abonne() or public.peut_publier_replay();
$$;

-- Une publication lisible : son espace, et, pour un replay, l'accès aux replays.
create or replace function public.peut_lire_publication(p public.publications)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.peut_lire_espace(p.parcours_id) and (not p.replay or public.acces_replays());
$$;

-- Les leçons publiées des formations payantes : ouvertes à l'abonné (dernière définition : 0036_formateur_sans_espace_etudiant.sql).
create or replace function public.acces_lecon(p_lecon uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not public.compte_suspendu() and (
    public.equipe_contenus()
    or public.formateur_de(public.formation_de_la_lecon(p_lecon))
    or (
      not public.a_role('formateur')
      and exists (
        select 1
        from public.lecons l
        join public.modules m on m.id = l.module_id
        join public.formations f on f.id = m.formation_id
        where l.id = p_lecon
          and f.statut = 'publiee'
          and l.publiee
          and (l.apercu or (f.gratuite and (select auth.uid()) is not null) or public.abonne((select auth.uid())))
      )
    )
  );
$$;

-- Les espaces des parcours : ouverts à l'abonné (restructuration, §5.4) (dernière définition : 0019_communaute.sql).
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
      or public.equipe_contenus()
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

-- L'espace « Replays » : ouvert aux abonnés (dernière définition : 0046_replays.sql).
create or replace function public.espaces_communaute()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.exiger_compte_actif();
  return jsonb_build_array(
    jsonb_build_object('id', null, 'nom', 'Général', 'nom_court', 'Général', 'couleur', null, 'slug', null, 'ouvert', true)
  ) || coalesce((
    select jsonb_agg(
      jsonb_build_object('id', pa.id, 'nom', pa.nom, 'nom_court', pa.nom_court, 'couleur', pa.couleur, 'slug', pa.slug, 'ouvert', public.peut_lire_espace(pa.id))
      order by pa.ordre, pa.nom
    )
    from public.parcours pa
    where pa.actif
  ), '[]'::jsonb)
  -- Les replays des lives (0046) : réservés aux abonnés, à l’équipe et aux formateurs (0050) ; « publier » dit si le compte peut y publier.
  || jsonb_build_array(
    jsonb_build_object('id', 'replays', 'nom', 'Replays de live', 'nom_court', 'Replays', 'couleur', null, 'slug', null, 'ouvert', public.acces_replays(),
      'publier', public.peut_publier_replay())
  );
end;
$$;

-- Le fil : les replays aux seuls abonnés, dans leur espace comme dans Actualités (dernière définition : 0046_replays.sql).
create or replace function public.fil_communaute(
  p_espace text,
  p_tri text default 'recentes',
  p_avant timestamptz default null,
  p_avant_id uuid default null,
  p_page integer default 0,
  p_nombre integer default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_nombre integer := least(greatest(coalesce(p_nombre, 20), 1), 50);
  v_debut integer := greatest(coalesce(p_page, 0), 0) * least(greatest(coalesce(p_nombre, 20), 1), 50);
  v_general boolean := p_espace = 'general';
  v_replays boolean := p_espace = 'replays';
  v_parcours uuid;
  v_ids uuid[];
  v_lignes jsonb;
  v_vide constant jsonb := jsonb_build_object('publications', '[]'::jsonb, 'suite', false);
begin
  perform public.exiger_compte_actif();
  if v_replays and not public.acces_replays() then
    return v_vide;
  end if;
  if not v_general and not v_replays and p_espace is distinct from 'tous' then
    begin
      v_parcours := p_espace::uuid;
    exception when invalid_text_representation then
      return v_vide;
    end;
    if not public.peut_lire_espace(v_parcours) then
      return v_vide;
    end if;
  end if;

  if p_tri = 'populaires' then
    select array_agg(x.id order by x.score desc, x.cree_le desc, x.id desc) into v_ids
    from (
      select p.id, p.cree_le,
             (select count(*) from public.reactions_publications r where r.publication_id = p.id)
             + 2 * (select count(*) from public.commentaires_publications c where c.publication_id = p.id) as score
      from public.publications p
      where (case when v_general then p.parcours_id is null and not p.replay when v_replays then p.replay when v_parcours is not null then p.parcours_id = v_parcours else public.peut_lire_publication(p) end)
        and public.publication_visible(p) and p.cree_le <= now()
        and p.cree_le > now() - interval '30 days'
      order by score desc, p.cree_le desc, p.id desc
      offset v_debut
      limit v_nombre + 1
    ) x;
  elsif p_tri = 'enregistrees' then
    select array_agg(x.id order by x.enregistree_le desc, x.id desc) into v_ids
    from (
      select p.id, e.cree_le as enregistree_le
      from public.publications_enregistrees e
      join public.publications p on p.id = e.publication_id
      where e.profil_id = (select auth.uid())
        and (case when v_general then p.parcours_id is null and not p.replay when v_replays then p.replay when v_parcours is not null then p.parcours_id = v_parcours else public.peut_lire_publication(p) end)
        and public.publication_visible(p) and p.cree_le <= now()
      order by e.cree_le desc, p.id desc
      offset v_debut
      limit v_nombre + 1
    ) x;
  elsif p_tri = 'programmees' then
    -- Les siennes, à venir, de la plus proche à la plus lointaine.
    select array_agg(x.id order by x.cree_le, x.id) into v_ids
    from (
      select p.id, p.cree_le
      from public.publications p
      where p.auteur = (select auth.uid()) and p.cree_le > now() and p.statut in ('publiee', 'en_attente')
        and (case when v_general then p.parcours_id is null and not p.replay when v_replays then p.replay when v_parcours is not null then p.parcours_id = v_parcours else public.peut_lire_publication(p) end)
      order by p.cree_le, p.id
      offset v_debut
      limit v_nombre + 1
    ) x;
  else
    select array_agg(x.id order by x.cree_le desc, x.id desc) into v_ids
    from (
      select p.id, p.cree_le
      from public.publications p
      where (case when v_general then p.parcours_id is null and not p.replay when v_replays then p.replay when v_parcours is not null then p.parcours_id = v_parcours else public.peut_lire_publication(p) end)
        and public.publication_visible(p) and p.cree_le <= now()
        and (p_avant is null or (p.cree_le, p.id) < (p_avant, coalesce(p_avant_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)))
      order by p.cree_le desc, p.id desc
      limit v_nombre + 1
    ) x;
  end if;

  select coalesce(jsonb_agg(public.carte_publication(p) order by array_position(v_ids, p.id)), '[]'::jsonb) into v_lignes
  from public.publications p
  where p.id = any (coalesce(v_ids[1:v_nombre], '{}'::uuid[]));

  return jsonb_build_object('publications', v_lignes, 'suite', coalesce(array_length(v_ids, 1), 0) > v_nombre);
end;
$$;

-- Le bandeau « Nouvelles publications » : même règle (dernière définition : 0046_replays.sql).
create or replace function public.nouvelles_publications(p_espace text, p_apres timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_general boolean := p_espace = 'general';
  v_replays boolean := p_espace = 'replays';
  v_parcours uuid;
  v_vide constant jsonb := jsonb_build_object('nombre', 0, 'auteurs', '[]'::jsonb);
  v_resultat jsonb;
begin
  perform public.exiger_compte_actif();
  if v_replays and not public.acces_replays() then
    return v_vide;
  end if;
  if not v_general and not v_replays and p_espace is distinct from 'tous' then
    begin
      v_parcours := p_espace::uuid;
    exception when invalid_text_representation then
      return v_vide;
    end;
    if not public.peut_lire_espace(v_parcours) then
      return v_vide;
    end if;
  end if;

  with nouvelles as (
    select p.auteur, p.cree_le
    from public.publications p
    where (case when v_general then p.parcours_id is null and not p.replay when v_replays then p.replay when v_parcours is not null then p.parcours_id = v_parcours else public.peut_lire_publication(p) end)
      and p.statut = 'publiee' and p.cree_le <= now()
      and (p_apres is null or p.cree_le > p_apres)
  ),
  derniers as (
    select n.auteur, max(n.cree_le) as derniere
    from nouvelles n
    group by n.auteur
    order by max(n.cree_le) desc
    limit 3
  )
  select jsonb_build_object(
    'nombre', (select count(*) from nouvelles),
    'auteurs', coalesce((
      select jsonb_agg(jsonb_build_object('initiales', public.initiales_avis(pr.prenom, pr.nom), 'photo', pr.photo_url) order by d.derniere desc)
      from derniers d
      join public.profils pr on pr.id = d.auteur
    ), '[]'::jsonb)
  ) into v_resultat;
  return v_resultat;
end;
$$;

-- Une publication ouverte par son lien (dernière définition : 0020_moderation.sql).
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
  if not found or not public.peut_lire_publication(v) or not (public.publication_visible(v) or public.equipe_contenus()) then
    return null;
  end if;
  return public.carte_publication(v) || jsonb_build_object('toutes_reponses', coalesce((
    select jsonb_agg(public.carte_reponse(c) order by c.cree_le, c.id)
    from public.commentaires_publications c
    where c.publication_id = v.id
  ), '[]'::jsonb));
end;
$$;

-- Réagir, commenter, voter : sur ce qu'on peut lire (dernière définition : 0026_communaute_sondages.sql).
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
  if v.statut <> 'publiee' and not public.equipe_contenus() then
    if v.statut = 'en_attente' and v.auteur = (select auth.uid()) then
      raise exception 'Cette publication attend sa vérification.';
    end if;
    raise exception 'Cette publication n’existe plus.';
  end if;
  -- Programmée : rien avant son heure (l'auteur le sait ; pour les autres, elle n'existe pas encore).
  if v.cree_le > now() and not public.equipe_contenus() then
    if v.auteur = (select auth.uid()) then
      raise exception 'Cette publication n’est pas encore parue.';
    end if;
    raise exception 'Cette publication n’existe plus.';
  end if;
  return v;
end;
$$;

-- Les fichiers joints : sur ce qu'on peut lire (dernière définition : 0026_communaute_sondages.sql).
create or replace function public.fichier_communaute_lisible(p_nom text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.publications p
    where p.piece_jointe ->> 'chemin' = p_nom and p.statut = 'publiee' and p.cree_le <= now() and public.peut_lire_publication(p)
  ) or exists (
    select 1 from public.options_sondage o
    join public.publications p on p.id = o.publication_id
    where o.image ->> 'chemin' = p_nom and p.statut = 'publiee' and p.cree_le <= now() and public.peut_lire_publication(p)
  ) or exists (
    select 1 from public.annonce_communaute a
    where a.image_chemin = p_nom and public.annonce_visible(a)
  );
$$;

-- La colonne « Activité récente » : même règle (dernière définition : 0040_photos_colonne_communaute.sql).
create or replace function public.activites_recentes()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.exiger_compte_actif();
  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'type', a.type,
        'publication_id', a.publication_id,
        'auteur', jsonb_build_object('nom_court', public.nom_avis(pr.prenom, pr.nom), 'initiales', public.initiales_avis(pr.prenom, pr.nom), 'photo', pr.photo_url),
        'extrait', a.extrait,
        'cree_le', a.cree_le
      )
      order by a.cree_le desc
    )
    from (
      (
        select 'publication' as type, p.id as publication_id, p.auteur, p.cree_le, left(coalesce(nullif(p.titre, ''), p.texte), 80) as extrait
        from public.publications p
        where p.statut = 'publiee' and p.cree_le <= now() and public.peut_lire_publication(p)
        order by p.cree_le desc
        limit 6
      )
      union all
      (
        select 'commentaire', p.id, c.auteur, c.cree_le, left(coalesce(nullif(p.titre, ''), p.texte), 80)
        from public.commentaires_publications c
        join public.publications p on p.id = c.publication_id
        where p.statut = 'publiee' and p.cree_le <= now() and public.peut_lire_publication(p)
        order by c.cree_le desc
        limit 6
      )
      order by cree_le desc
      limit 6
    ) a
    join public.profils pr on pr.id = a.auteur
  ), '[]'::jsonb);
end;
$$;

-- La colonne « Tendances » : même règle (dernière définition : 0040_photos_colonne_communaute.sql).
create or replace function public.publications_tendances()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.exiger_compte_actif();
  return coalesce((
    select jsonb_agg(y.carte order by y.score desc, y.cree_le desc, y.id desc)
    from (
    select x.* from (
      select p.id, p.cree_le,
             (select count(*) from public.reactions_publications r where r.publication_id = p.id)
             + (select count(*) from public.commentaires_publications c where c.publication_id = p.id) as score,
             jsonb_build_object(
               'id', p.id,
               'extrait', left(coalesce(nullif(p.titre, ''), p.texte), 160),
               'auteur', jsonb_build_object(
                 'nom_court', public.nom_avis(pr.prenom, pr.nom),
                 'initiales', public.initiales_avis(pr.prenom, pr.nom),
                 'photo', pr.photo_url,
                 'equipe', coalesce(public.role_communaute(p.auteur) = 'equipe', false)
               )
             ) as carte
      from public.publications p
      join public.profils pr on pr.id = p.auteur
      where p.statut = 'publiee' and p.cree_le <= now() and p.cree_le > now() - interval '7 days' and public.peut_lire_publication(p)
    ) x
    where x.score > 0
    order by x.score desc, x.cree_le desc, x.id desc
    limit 5
    ) y
  ), '[]'::jsonb);
end;
$$;

-- S'inscrire à un live : abonnés et équipe (choix 1 de la spec ; dernière définition : 0023_sessions_rappels.sql).
create or replace function public.sinscrire_session(p_session uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.sessions_live%rowtype;
begin
  perform public.exiger_compte_actif();
  select * into v from public.sessions_live where id = p_session;
  if not found or v.statut <> 'programmee' or v.debut + make_interval(mins => v.duree_minutes) <= now() then
    raise exception 'Les inscriptions à cette session sont closes.';
  end if;
  if not public.acces_abonne() then
    raise exception 'Les lives sont réservés aux abonnés.' using errcode = '42501';
  end if;
  insert into public.inscriptions_sessions (session_id, profil_id, rappel_veille_le, rappel_heure_le, rappel_dix_le)
  values (
    p_session,
    (select auth.uid()),
    case when now() >= v.debut - interval '24 hours' then now() end,
    case when now() >= v.debut - interval '1 hour' then now() end,
    case when now() >= v.debut - interval '10 minutes' then now() end
  )
  on conflict do nothing;
end;
$$;

-- La carte d'un live : le lien aux seuls abonnés ; « reservee » pour le cadenas (dernière définition : 0018_sessions_live.sql).
create or replace function public.carte_session(s public.sessions_live)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', s.id,
    'titre', s.titre,
    'description', s.description,
    'debut', s.debut,
    'duree_minutes', s.duree_minutes,
    'plateforme', public.plateforme_session(s.lien),
    'lien', case
      when public.droit_session(s.formateur_id)
        or (public.acces_abonne() and s.statut = 'programmee'
            and now() >= s.debut - interval '10 minutes'
            and now() < s.debut + make_interval(mins => s.duree_minutes))
      then s.lien
    end,
    'parcours', (select jsonb_build_object('nom_court', p.nom_court, 'couleur', p.couleur) from public.parcours p where p.id = s.parcours_id),
    'animateur', public.animateur_session(s.formateur_id),
    'inscriptions', (select count(*)::int from public.inscriptions_sessions i where i.session_id = s.id),
    'inscrit', exists (select 1 from public.inscriptions_sessions i where i.session_id = s.id and i.profil_id = (select auth.uid())),
    'reservee', not (public.acces_abonne() or public.droit_session(s.formateur_id)),
    'statut', s.statut
  );
$$;

revoke execute on function public.acces_abonne() from public, anon, authenticated;
revoke execute on function public.acces_replays() from public, anon, authenticated;
revoke execute on function public.peut_lire_publication(public.publications) from public, anon, authenticated;
grant execute on function public.acces_abonne() to authenticated;
grant execute on function public.acces_replays() to authenticated;

commit;
