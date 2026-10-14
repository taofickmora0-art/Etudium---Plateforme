-- Étudium · migration 0024 : promotion des sessions live (spec 2026-10-14-sessions-promotion-design).
-- À appliquer dans Supabase, après la 0023 : SQL Editor → New query → coller tout le fichier → Run.
-- Rejouable. Si la 0018, la 0022 ou la 0023 est rejouée un jour, rejouer celle-ci ensuite.
-- Une session programmée paraît dans la communauté avec son visuel (affiche ou vidéo) et son bloc ; « nouvelles
-- sessions » compte celles programmées depuis la dernière visite de la page Événements (pastille rouge).

begin;

-- ─── Colonnes ───────────────────────────────────────────────────────────────────────────────────────
-- L'affiche : une pièce jointe de la communauté ({chemin, nom, type, taille}) ; la vidéo : le format de verifier_video.
alter table public.sessions_live add column if not exists promo_image jsonb;
alter table public.sessions_live add column if not exists promo_video jsonb;
alter table public.sessions_live add column if not exists publication_id uuid references public.publications (id) on delete set null;
alter table public.publications add column if not exists session_id uuid references public.sessions_live (id) on delete set null;
create unique index if not exists publications_session_idx on public.publications (session_id) where session_id is not null;
create index if not exists sessions_live_publication_idx on public.sessions_live (publication_id);
alter table public.profils add column if not exists evenements_vus_le timestamptz;

-- ─── Le visuel de promotion : une affiche (image) ou une vidéo, vérifiées comme dans la communauté ──
create or replace function public.verifier_promotion(p_image jsonb, p_video jsonb, p_image_actuelle jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_image jsonb := case when p_image is null or jsonb_typeof(p_image) = 'null' then null else p_image end;
  v_video jsonb := case when p_video is null or jsonb_typeof(p_video) = 'null' then null else p_video end;
begin
  if v_image is not null and v_video is not null then
    raise exception 'Choisissez une affiche ou une vidéo, pas les deux.';
  end if;
  if v_image is not null then
    if coalesce(v_image ->> 'type', '') not in ('image/jpeg', 'image/png', 'image/webp') then
      raise exception 'L’affiche doit être une image (JPG, PNG ou WebP).';
    end if;
    if p_image_actuelle is not null and v_image ->> 'chemin' = p_image_actuelle ->> 'chemin' then
      v_image := p_image_actuelle;
    else
      v_image := public.verifier_piece(v_image);
    end if;
  end if;
  -- Le lien d'un live (Google Meet, Zoom) reste réservé à sa fenêtre de 10 min : jamais en vidéo de promotion.
  if v_video is not null and public.plateforme_session(coalesce(v_video ->> 'url', '')) <> 'En ligne' then
    raise exception 'Le lien du live ne peut pas servir de vidéo de promotion.';
  end if;
  return jsonb_build_object('image', v_image, 'video', public.verifier_video(v_video));
end;
$$;

-- ─── L'espace de la publication d'une session ───────────────────────────────────────────────────────
-- Un parcours actif, et un espace ouvert au compte : un formateur publie dans les espaces de ses formations.
create or replace function public.verifier_espace_session(p_parcours uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_parcours is not null and not exists (select 1 from public.parcours where id = p_parcours and actif) then
    raise exception 'Ce parcours n’est plus proposé.';
  end if;
  if not public.peut_lire_espace(p_parcours) then
    raise exception 'Cet espace ne vous est pas ouvert.' using errcode = '42501';
  end if;
end;
$$;

-- La publication d'une session supprimée : son affiche part avec elle (le fichier est retiré du stockage), la session
-- ne la désigne plus.
create or replace function public.apres_suppression_publication_session()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.session_id is not null then
    update public.sessions_live set promo_image = null where id = old.session_id and promo_image is not null;
  end if;
  return null;
end;
$$;

drop trigger if exists publications_session_supprimee on public.publications;
create trigger publications_session_supprimee after delete on public.publications
  for each row execute function public.apres_suppression_publication_session();

-- ─── Programmer : la publication en plus ────────────────────────────────────────────────────────────
drop function if exists public.creer_session(text, text, timestamptz, integer, text, uuid, uuid);
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
  v_equipe boolean := public.equipe_contenus();
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
  return v_id;
end;
$$;

-- ─── Modifier : le visuel et la publication suivent ─────────────────────────────────────────────────
drop function if exists public.modifier_session(uuid, text, text, timestamptz, integer, text, uuid, uuid);
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
  v_equipe boolean := public.equipe_contenus();
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

-- ─── La fiche d'une session : son visuel en plus ────────────────────────────────────────────────────
create or replace function public.session_detail(p_session uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v public.sessions_live%rowtype;
begin
  select * into v from public.sessions_live where id = p_session;
  if not found or not public.droit_session(v.formateur_id) then
    return null;
  end if;
  return jsonb_build_object(
    'id', v.id,
    'titre', v.titre,
    'description', v.description,
    'debut', v.debut,
    'duree_minutes', v.duree_minutes,
    'lien', v.lien,
    'plateforme', public.plateforme_session(v.lien),
    'parcours', (select jsonb_build_object('id', p.id, 'nom_court', p.nom_court, 'couleur', p.couleur) from public.parcours p where p.id = v.parcours_id),
    'formateur_id', v.formateur_id,
    'animateur', public.animateur_session(v.formateur_id),
    'statut', v.statut,
    'annulee_le', v.annulee_le,
    'promo_image', v.promo_image,
    'promo_video', v.promo_video,
    'inscrits', coalesce((
      select jsonb_agg(jsonb_build_object('prenom', coalesce(p.prenom, ''), 'nom', coalesce(p.nom, '')) order by i.inscrit_le)
      from public.inscriptions_sessions i
      join public.profils p on p.id = i.profil_id
      where i.session_id = v.id
    ), '[]'::jsonb)
  );
end;
$$;

-- ─── La carte d'une publication : le bloc de sa session ─────────────────────────────────────────────
create or replace function public.carte_publication(p public.publications)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p.id,
    'auteur', jsonb_build_object('prenom', coalesce(pr.prenom, ''), 'nom', coalesce(pr.nom, ''), 'role', public.role_communaute(p.auteur)),
    'est_moi', p.auteur = (select auth.uid()),
    'espace', jsonb_build_object('id', p.parcours_id, 'nom', public.nom_espace_communaute(p.parcours_id)),
    'titre', p.titre,
    'texte', p.texte,
    'piece_jointe', p.piece_jointe,
    'cree_le', p.cree_le,
    'modifiee', p.modifiee,
    'statut', p.statut,
    'apercu', p.apercu,
    'video', p.video,
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
      select jsonb_agg(public.initiales_avis(pr2.prenom, pr2.nom) order by d.cree_le desc, d.profil_id)
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
        where c.publication_id = p.id
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

-- ─── Nouvelles sessions (pastille rouge) ────────────────────────────────────────────────────────────
-- Programmées depuis la dernière visite de la page Événements, à venir ou en cours, pas annulées, pas les siennes.
create or replace function public.nouvelles_sessions()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int
  from public.sessions_live s
  where s.statut = 'programmee'
    and s.debut + make_interval(mins => s.duree_minutes) > now()
    and s.cree_par is distinct from (select auth.uid())
    and s.cree_le > coalesce((select p.evenements_vus_le from public.profils p where p.id = (select auth.uid())), '-infinity'::timestamptz);
$$;

create or replace function public.marquer_evenements_vus()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.exiger_compte_actif();
  update public.profils set evenements_vus_le = now() where id = (select auth.uid());
end;
$$;

-- ─── Droits d'exécution ─────────────────────────────────────────────────────────────────────────────
revoke execute on function public.verifier_promotion(jsonb, jsonb, jsonb) from public, anon, authenticated;
revoke execute on function public.verifier_espace_session(uuid) from public, anon, authenticated;
revoke execute on function public.apres_suppression_publication_session() from public, anon, authenticated;
revoke execute on function public.creer_session(text, text, timestamptz, integer, text, uuid, uuid, jsonb, jsonb) from public, anon;
grant execute on function public.creer_session(text, text, timestamptz, integer, text, uuid, uuid, jsonb, jsonb) to authenticated;
revoke execute on function public.modifier_session(uuid, text, text, timestamptz, integer, text, uuid, uuid, jsonb, jsonb) from public, anon;
grant execute on function public.modifier_session(uuid, text, text, timestamptz, integer, text, uuid, uuid, jsonb, jsonb) to authenticated;
revoke execute on function public.session_detail(uuid) from public, anon;
grant execute on function public.session_detail(uuid) to authenticated;
revoke execute on function public.nouvelles_sessions() from public, anon;
grant execute on function public.nouvelles_sessions() to authenticated;
revoke execute on function public.marquer_evenements_vus() from public, anon;
grant execute on function public.marquer_evenements_vus() to authenticated;

commit;
