-- Migration 0046 : l'espace « Replays de live » de la communauté (liste du 31 octobre 2026, tâche 11).
-- Après un live, l'équipe (ou un formateur) publie son replay dans cet espace, qui vient en dernier dans les onglets
-- (après les parcours) et dans « Publication dans ». Tout le monde le lit, l'aime et le commente ; les replays paraissent
-- aussi dans Actualités, plus dans Général. Un replay n'appartient à aucun parcours (colonne `replay`).
-- Mêmes définitions qu'en 0019 (espaces_communaute), 0026 (publier, fil_communaute), 0043 (nouvelles_publications) et
-- 0038 (carte_publication), plus l'espace des replays. Rejouable.

begin;

alter table public.publications add column if not exists replay boolean not null default false;
do $contrainte$
begin
  alter table public.publications add constraint publications_replay_sans_parcours check (not replay or parcours_id is null);
exception when duplicate_object then
  null;
end
$contrainte$;
create index if not exists publications_replays_idx on public.publications (cree_le desc) where replay;

-- ─── Qui publie un replay : l'équipe et les formateurs ──────────────────────────────────────────────
create or replace function public.peut_publier_replay()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.equipe_contenus() or public.ma_fiche_formateur() is not null;
$$;

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
  -- Les replays des lives (0046) : ouverts à tous ; « publier » dit si le compte peut y publier.
  || jsonb_build_array(
    jsonb_build_object('id', 'replays', 'nom', 'Replays de live', 'nom_court', 'Replays', 'couleur', null, 'slug', null, 'ouvert', true,
      'publier', public.peut_publier_replay())
  );
end;
$$;

-- La signature change (p_replay) : l'ancienne est retirée, sans quoi les deux se confondraient.
drop function if exists public.publier(uuid, text, text, jsonb, jsonb, jsonb, jsonb, timestamptz, jsonb);
create or replace function public.publier(p_parcours uuid, p_titre text, p_texte text, p_piece jsonb default null, p_analyse jsonb default null, p_apercu jsonb default null, p_video jsonb default null, p_publie_le timestamptz default null, p_sondage jsonb default null, p_replay boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_titre text := regexp_replace(coalesce(p_titre, ''), '^\s+|\s+$', '', 'g');
  v_texte text := regexp_replace(coalesce(p_texte, ''), '^\s+|\s+$', '', 'g');
  v_statut text := 'publiee';
  v_examen boolean := false;
  v_analyse jsonb;
  v_id uuid;
  v_publie timestamptz := coalesce(p_publie_le, now());
  v_sondage jsonb;
  -- Un replay (0046) n'est dans aucun parcours.
  v_replay boolean := coalesce(p_replay, false);
  v_parcours uuid := case when coalesce(p_replay, false) then null else p_parcours end;
begin
  perform public.exiger_compte_actif();
  if v_replay and not public.peut_publier_replay() then
    raise exception 'Les replays sont publiés par l’équipe Étudium et les formateurs.' using errcode = '42501';
  end if;
  if not public.peut_lire_espace(v_parcours) then
    raise exception 'Cet espace ne vous est pas ouvert.' using errcode = '42501';
  end if;
  if char_length(v_texte) not between 1 and 3000 then
    raise exception 'Écrivez votre publication (3 000 caractères au plus).';
  end if;
  if char_length(v_titre) > 120 then
    raise exception 'Le titre dépasse 120 caractères.';
  end if;
  perform public.verifier_parution(p_publie_le);
  -- Un seul ajout : un sondage (ou un quiz) ne s'accompagne ni d'un fichier ni d'une vidéo.
  if p_sondage is not null and jsonb_typeof(p_sondage) <> 'null' then
    if (p_piece is not null and jsonb_typeof(p_piece) <> 'null') or (p_video is not null and jsonb_typeof(p_video) <> 'null') then
      raise exception 'Une publication porte un seul ajout : une image, un fichier, une vidéo, un sondage ou un quiz.';
    end if;
    v_sondage := public.verifier_sondage(p_sondage);
  end if;
  perform public.limiter_debit(false);
  if public.verdict_valide(p_analyse) then
    -- Le fichier analysé ne doit pas avoir été remplacé entre l'analyse et la publication.
    if p_piece is not null and jsonb_typeof(p_piece) <> 'null' and (
      coalesce(p_analyse ->> 'objet', '') = ''
      or not exists (
        select 1 from storage.objects o
        where o.bucket_id = 'communaute' and o.name = p_piece ->> 'chemin' and o.id::text = p_analyse ->> 'objet'
      )
    ) then
      raise exception 'Ce fichier a changé pendant la vérification. Publiez-le de nouveau.';
    end if;
    v_analyse := public.analyse_retenue(p_analyse);
    v_statut := case when v_analyse ->> 'decision' = 'bloquer' then 'bloquee' else 'publiee' end;
    v_examen := v_analyse ->> 'decision' in ('signaler', 'echec');
    update public.reglages_moderation set derniere_analyse = now() where id;
  elsif public.moderation_active() then
    v_statut := 'en_attente';
  end if;
  -- Une publication programmée prend son heure de parution pour date : le fil la montre à cette heure-là.
  insert into public.publications (auteur, parcours_id, replay, titre, texte, piece_jointe, statut, verdict, a_examiner, apercu, video, cree_le)
  values ((select auth.uid()), v_parcours, v_replay, v_titre, v_texte, public.verifier_piece(p_piece), v_statut, v_analyse, v_examen, public.verifier_apercu(p_apercu, v_texte), public.verifier_video(p_video), v_publie)
  returning id into v_id;
  if v_sondage is not null then
    insert into public.sondages (publication_id, type, choix_multiples, fin_le, explication)
    values (v_id, v_sondage ->> 'type', (v_sondage ->> 'choix_multiples')::boolean,
            v_publie + make_interval(days => (v_sondage ->> 'duree_jours')::integer), v_sondage ->> 'explication');
    insert into public.options_sondage (publication_id, ordre, texte, image, correcte)
    select v_id, o.ordre::integer, o.valeur ->> 'texte', nullif(o.valeur -> 'image', 'null'::jsonb), coalesce((o.valeur ->> 'correcte')::boolean, false)
    from jsonb_array_elements(v_sondage -> 'options') with ordinality as o(valeur, ordre);
  end if;
  if v_examen or v_statut = 'en_attente' then
    perform public.prevenir_equipe('Une publication de l’espace ' || case when v_replay then 'Replays' else public.nom_espace_communaute(v_parcours) end || ' attend votre examen.');
  end if;
  return jsonb_build_object('id', v_id, 'statut', v_statut, 'categorie', v_analyse ->> 'categorie');
end;
$$;

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
      where (case when v_general then p.parcours_id is null and not p.replay when v_replays then p.replay when v_parcours is not null then p.parcours_id = v_parcours else public.peut_lire_espace(p.parcours_id) end)
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
        and (case when v_general then p.parcours_id is null and not p.replay when v_replays then p.replay when v_parcours is not null then p.parcours_id = v_parcours else public.peut_lire_espace(p.parcours_id) end)
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
        and (case when v_general then p.parcours_id is null and not p.replay when v_replays then p.replay when v_parcours is not null then p.parcours_id = v_parcours else public.peut_lire_espace(p.parcours_id) end)
      order by p.cree_le, p.id
      offset v_debut
      limit v_nombre + 1
    ) x;
  else
    select array_agg(x.id order by x.cree_le desc, x.id desc) into v_ids
    from (
      select p.id, p.cree_le
      from public.publications p
      where (case when v_general then p.parcours_id is null and not p.replay when v_replays then p.replay when v_parcours is not null then p.parcours_id = v_parcours else public.peut_lire_espace(p.parcours_id) end)
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
    where (case when v_general then p.parcours_id is null and not p.replay when v_replays then p.replay when v_parcours is not null then p.parcours_id = v_parcours else public.peut_lire_espace(p.parcours_id) end)
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
    'peut_supprimer', p.auteur = (select auth.uid()) or public.equipe_contenus(),
    'peut_signaler', p.statut = 'publiee' and p.auteur <> (select auth.uid()) and not public.equipe_contenus()
  )
  from public.profils pr
  where pr.id = p.auteur;
$$;

-- ─── Droits ─────────────────────────────────────────────────────────────────────────────────────────
revoke execute on function public.peut_publier_replay() from public, anon, authenticated;
revoke execute on function public.publier(uuid, text, text, jsonb, jsonb, jsonb, jsonb, timestamptz, jsonb, boolean) from public, anon;
grant execute on function public.publier(uuid, text, text, jsonb, jsonb, jsonb, jsonb, timestamptz, jsonb, boolean) to authenticated;

commit;
