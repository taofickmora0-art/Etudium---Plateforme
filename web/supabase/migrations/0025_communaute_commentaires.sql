-- Étudium · migration 0025 : les commentaires (communauté v3, étape 2) — répondre (un seul niveau), J’aime, modifier.
-- À appliquer dans Supabase, après la 0024 : SQL Editor → New query → coller tout le fichier → Run.
-- Rejouable. Si la 0019, la 0020 ou la 0024 est rejouée un jour, rejouer celle-ci ensuite.

begin;

-- ─── Colonnes et table ──────────────────────────────────────────────────────────────────────────────
-- Une réponse vise un commentaire de premier niveau ; supprimer un commentaire supprime ses réponses.
alter table public.commentaires_publications add column if not exists parent_id uuid references public.commentaires_publications (id) on delete cascade;
alter table public.commentaires_publications add column if not exists modifie_le timestamptz;
create index if not exists commentaires_parent_idx on public.commentaires_publications (parent_id);

-- « J’aime » d'un commentaire : une fois par compte. Fermée aux comptes : tout passe par les fonctions.
create table if not exists public.reactions_commentaires (
  commentaire_id uuid not null references public.commentaires_publications (id) on delete cascade,
  profil_id uuid not null references public.profils (id) on delete cascade,
  cree_le timestamptz not null default now(),
  primary key (commentaire_id, profil_id)
);
create index if not exists reactions_commentaires_profil_idx on public.reactions_commentaires (profil_id);
alter table public.reactions_commentaires enable row level security;
revoke all on public.reactions_commentaires from anon, authenticated;

-- ─── Commenter : le commentaire parent ──────────────────────────────────────────────────────────────
drop function if exists public.commenter(uuid, text);
create or replace function public.commenter(p_publication uuid, p_texte text, p_parent uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.publications%rowtype := public.publication_ouverte(p_publication);
  v_texte text := regexp_replace(coalesce(p_texte, ''), '^\s+|\s+$', '', 'g');
  v_id uuid;
  v_nom text;
  v_parent public.commentaires_publications%rowtype;
begin
  if char_length(v_texte) not between 1 and 1000 then
    raise exception 'Écrivez votre réponse (1 000 caractères au plus).';
  end if;
  if p_parent is not null then
    select * into v_parent from public.commentaires_publications where id = p_parent and publication_id = p_publication;
    if not found then
      raise exception 'Ce commentaire n’existe plus.';
    end if;
    -- Un seul niveau : répondre à une réponse répond au même commentaire.
    if v_parent.parent_id is not null then
      select * into v_parent from public.commentaires_publications where id = v_parent.parent_id;
    end if;
  end if;
  perform public.limiter_debit(true);
  insert into public.commentaires_publications (publication_id, auteur, texte, parent_id)
  values (p_publication, (select auth.uid()), v_texte, v_parent.id)
  returning id into v_id;
  select public.nom_avis(prenom, nom) into v_nom from public.profils where id = (select auth.uid());
  -- L'auteur du commentaire auquel on répond est prévenu ; l'auteur de la publication aussi, sauf si c'est le même.
  if v_parent.id is not null then
    perform public.notifier(
      array[v_parent.auteur], 'communaute', 'Nouvelle réponse à votre commentaire',
      v_nom || ' a répondu à votre commentaire dans l’espace ' || public.nom_espace_communaute(v.parcours_id) || '.',
      '/communaute/publications/' || v.id || '#commentaire-' || v_id
    );
  end if;
  perform public.notifier(
    array(select v.auteur where v.auteur is distinct from v_parent.auteur), 'communaute', 'Nouvelle réponse',
    v_nom || ' a répondu à votre publication dans l’espace ' || public.nom_espace_communaute(v.parcours_id) || '.',
    '/communaute/publications/' || v.id || '#commentaire-' || v_id
  );
  return v_id;
end;
$$;

-- ─── Modifier un commentaire : son auteur ou l'équipe ───────────────────────────────────────────────
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
  if v.auteur <> (select auth.uid()) and not public.equipe_contenus() then
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

-- ─── « J’aime » d'un commentaire : le premier clic l'ajoute, le second le retire ───────────────────
create or replace function public.basculer_reaction_commentaire(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_moi uuid := (select auth.uid());
  v_publication uuid;
  v_aime boolean;
begin
  select publication_id into v_publication from public.commentaires_publications where id = p_id;
  if not found then
    raise exception 'Ce commentaire n’existe plus.';
  end if;
  perform public.publication_ouverte(v_publication);
  delete from public.reactions_commentaires where commentaire_id = p_id and profil_id = v_moi;
  if found then
    v_aime := false;
  else
    insert into public.reactions_commentaires (commentaire_id, profil_id) values (p_id, v_moi) on conflict do nothing;
    v_aime := true;
  end if;
  return jsonb_build_object(
    'j_aime', v_aime,
    'reactions', (select count(*)::int from public.reactions_commentaires where commentaire_id = p_id)
  );
end;
$$;

-- ─── La carte d'un commentaire : parent, J’aime, modifié, droits ────────────────────────────────────
create or replace function public.carte_reponse(c public.commentaires_publications)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', c.id,
    'auteur', jsonb_build_object('prenom', coalesce(pr.prenom, ''), 'nom_court', public.nom_avis(pr.prenom, pr.nom)),
    'est_moi', c.auteur = (select auth.uid()),
    'texte', c.texte,
    'cree_le', c.cree_le,
    'parent_id', c.parent_id,
    'modifie', c.modifie_le is not null,
    'reactions', (select count(*)::int from public.reactions_commentaires r where r.commentaire_id = c.id),
    'j_aime', exists (select 1 from public.reactions_commentaires r where r.commentaire_id = c.id and r.profil_id = (select auth.uid())),
    'peut_modifier', c.auteur = (select auth.uid()) or public.equipe_contenus(),
    'peut_supprimer', c.auteur = (select auth.uid()) or public.equipe_contenus(),
    'peut_signaler', c.auteur <> (select auth.uid()) and not public.equipe_contenus()
  )
  from public.profils pr
  where pr.id = c.auteur;
$$;

-- ─── Supprimer un commentaire : rend le nombre retiré (lui et ses réponses), pour le compteur de la carte ─────
drop function if exists public.supprimer_commentaire(uuid);
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
  if v.auteur <> (select auth.uid()) and not public.equipe_contenus() then
    raise exception 'Cette réponse n’est pas la vôtre.' using errcode = '42501';
  end if;
  select count(*) + 1 into v_nombre from public.commentaires_publications where parent_id = p_id;
  delete from public.commentaires_publications where id = p_id;
  return v_nombre;
end;
$$;

-- ─── La carte d'une publication : les 2 derniers commentaires de premier niveau ─────────────────────
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

-- ─── Droits d'exécution ─────────────────────────────────────────────────────────────────────────────
revoke execute on function public.commenter(uuid, text, uuid) from public, anon;
grant execute on function public.commenter(uuid, text, uuid) to authenticated;
revoke execute on function public.modifier_commentaire(uuid, text) from public, anon;
grant execute on function public.modifier_commentaire(uuid, text) to authenticated;
revoke execute on function public.basculer_reaction_commentaire(uuid) from public, anon;
grant execute on function public.basculer_reaction_commentaire(uuid) to authenticated;
revoke execute on function public.supprimer_commentaire(uuid) from public, anon;
grant execute on function public.supprimer_commentaire(uuid) to authenticated;

commit;
