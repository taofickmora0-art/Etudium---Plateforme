-- Étudium · migration 0028 : les discussions des leçons (refonte des formations, étape B,
-- spec docs/superpowers/specs/2026-10-15-refonte-formations-design.md, §1.6 et §4).
-- À appliquer dans Supabase, après la 0027 : SQL Editor → New query → coller tout le fichier → Run. Rejouable.
--
-- Sous une leçon, les comptes qui y ont accès commentent (un seul niveau de réponses), aiment, modifient et suppriment
-- les leurs ; le formateur de la formation et l'équipe suppriment. Le formateur est prévenu d'un nouveau commentaire,
-- l'auteur d'une réponse. « Signaler » envoie le commentaire dans la file de modération de l'équipe.

begin;

-- ─── Tables ─────────────────────────────────────────────────────────────────────────────────────────
create table if not exists public.commentaires_lecons (
  id uuid primary key default gen_random_uuid(),
  lecon_id uuid not null references public.lecons (id) on delete cascade,
  auteur uuid not null references public.profils (id) on delete cascade,
  -- Une réponse vise un commentaire de premier niveau ; supprimer un commentaire supprime ses réponses.
  parent_id uuid references public.commentaires_lecons (id) on delete cascade,
  texte text not null,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz,
  constraint commentaires_lecons_texte check (char_length(texte) between 1 and 1000)
);
create index if not exists commentaires_lecons_lecon_idx on public.commentaires_lecons (lecon_id, cree_le);
create index if not exists commentaires_lecons_parent_idx on public.commentaires_lecons (parent_id);
create index if not exists commentaires_lecons_auteur_idx on public.commentaires_lecons (auteur, cree_le);
alter table public.commentaires_lecons enable row level security;
revoke all on public.commentaires_lecons from anon, authenticated;

create table if not exists public.reactions_commentaires_lecons (
  commentaire_id uuid not null references public.commentaires_lecons (id) on delete cascade,
  profil_id uuid not null references public.profils (id) on delete cascade,
  cree_le timestamptz not null default now(),
  primary key (commentaire_id, profil_id)
);
create index if not exists reactions_commentaires_lecons_profil_idx on public.reactions_commentaires_lecons (profil_id);
alter table public.reactions_commentaires_lecons enable row level security;
revoke all on public.reactions_commentaires_lecons from anon, authenticated;

-- Les signalements visent aussi un commentaire de leçon : une seule cible par signalement.
alter table public.signalements add column if not exists commentaire_lecon_id uuid references public.commentaires_lecons (id) on delete cascade;
alter table public.signalements drop constraint if exists signalements_une_cible;
alter table public.signalements add constraint signalements_une_cible check (num_nonnulls(publication_id, commentaire_id, commentaire_lecon_id) = 1);
create unique index if not exists signalements_commentaire_lecon_unique on public.signalements (auteur, commentaire_lecon_id) where commentaire_lecon_id is not null;
create index if not exists signalements_commentaire_lecon_idx on public.signalements (commentaire_lecon_id) where traite_le is null;

-- ─── Une leçon ouverte à la discussion : un compte qui y a accès, commentaires activés ──────────────
create or replace function public.lecon_discutable(p_lecon uuid)
returns public.lecons
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v public.lecons%rowtype;
begin
  select * into v from public.lecons where id = p_lecon;
  if not found or (select auth.uid()) is null or not public.acces_lecon(p_lecon) then
    raise exception 'Cette leçon ne vous est pas ouverte.' using errcode = '42501';
  end if;
  if not v.commentaires_actifs then
    raise exception 'Les commentaires sont fermés sur cette leçon.';
  end if;
  return v;
end;
$$;

-- ─── La carte d'un commentaire ──────────────────────────────────────────────────────────────────────
create or replace function public.carte_commentaire_lecon(c public.commentaires_lecons)
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
    'reactions', (select count(*)::int from public.reactions_commentaires_lecons r where r.commentaire_id = c.id),
    'j_aime', exists (select 1 from public.reactions_commentaires_lecons r where r.commentaire_id = c.id and r.profil_id = (select auth.uid())),
    'peut_modifier', c.auteur = (select auth.uid()),
    'peut_supprimer', c.auteur = (select auth.uid()) or public.equipe_contenus() or public.formateur_de(public.formation_de_la_lecon(c.lecon_id)),
    'peut_signaler', c.auteur <> (select auth.uid()) and not public.equipe_contenus(),
    -- L'étiquette « Formateur » : l'auteur est le formateur de la formation.
    'formateur', exists (
      select 1 from public.formations f join public.formateurs fo on fo.id = f.formateur_id
      where f.id = public.formation_de_la_lecon(c.lecon_id) and fo.compte_id = c.auteur
    )
  )
  from public.profils pr
  where pr.id = c.auteur;
$$;

-- ─── Lire : les 10 derniers commentaires de premier niveau et leurs réponses (ou tout), du plus ancien au plus récent ───
-- null sans accès (visiteur, leçon fermée ou en brouillon) ou commentaires fermés : la page n'affiche pas la section.
create or replace function public.discussion_lecon(p_lecon uuid, p_tout boolean default false)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not public.acces_lecon(p_lecon)
    or not exists (select 1 from public.lecons where id = p_lecon and commentaires_actifs) then
    return null;
  end if;
  return jsonb_build_object(
    'total', (select count(*)::int from public.commentaires_lecons where lecon_id = p_lecon),
    'commentaires', coalesce((
      select jsonb_agg(public.carte_commentaire_lecon(c) order by c.cree_le, c.id)
      from public.commentaires_lecons c
      where c.lecon_id = p_lecon
        and (p_tout or coalesce(c.parent_id, c.id) in (
          select d.id from public.commentaires_lecons d
          where d.lecon_id = p_lecon and d.parent_id is null
          order by d.cree_le desc, d.id desc
          limit 10
        ))
    ), '[]'::jsonb)
  );
end;
$$;

-- ─── Commenter, ou répondre (un seul niveau) ────────────────────────────────────────────────────────
create or replace function public.commenter_lecon(p_lecon uuid, p_texte text, p_parent uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.lecons%rowtype;
  v_moi uuid := (select auth.uid());
  v_texte text := regexp_replace(coalesce(p_texte, ''), '^\s+|\s+$', '', 'g');
  v_parent public.commentaires_lecons%rowtype;
  v_nouveau public.commentaires_lecons%rowtype;
  v_formation record;
  v_nom text;
  v_lien text;
begin
  perform public.exiger_compte_actif();
  v := public.lecon_discutable(p_lecon);
  if char_length(v_texte) not between 1 and 1000 then
    raise exception 'Écrivez votre commentaire (1 000 caractères au plus).';
  end if;
  if p_parent is not null then
    select * into v_parent from public.commentaires_lecons where id = p_parent and lecon_id = p_lecon;
    if not found then
      raise exception 'Ce commentaire n’existe plus.';
    end if;
    -- Un seul niveau : répondre à une réponse répond au même commentaire.
    if v_parent.parent_id is not null then
      select * into v_parent from public.commentaires_lecons where id = v_parent.parent_id;
    end if;
  end if;
  if (select count(*) from public.commentaires_lecons where auteur = v_moi and cree_le > now() - interval '10 minutes') >= 30 then
    raise exception 'Vous publiez beaucoup en peu de temps. Réessayez dans quelques minutes.';
  end if;
  insert into public.commentaires_lecons (lecon_id, auteur, texte, parent_id)
  values (p_lecon, v_moi, v_texte, v_parent.id)
  returning * into v_nouveau;

  select f.slug, fo.compte_id into v_formation
  from public.modules m
  join public.formations f on f.id = m.formation_id
  left join public.formateurs fo on fo.id = f.formateur_id
  where m.id = v.module_id;
  v_lien := '/formations/' || v_formation.slug || '/lecons/' || v.id || '#commentaire-' || v_nouveau.id;
  select public.nom_avis(prenom, nom) into v_nom from public.profils where id = v_moi;
  -- L'auteur du commentaire auquel on répond ; puis le formateur, une seule fois.
  if v_parent.id is not null and v_parent.auteur <> v_moi then
    perform public.notifier(
      array[v_parent.auteur], 'communaute', 'Nouvelle réponse à votre commentaire',
      v_nom || ' a répondu à votre commentaire sur « ' || v.titre || ' ».', v_lien
    );
  end if;
  if v_formation.compte_id is not null and v_formation.compte_id <> v_moi and v_formation.compte_id is distinct from v_parent.auteur then
    perform public.notifier(
      array[v_formation.compte_id], 'communaute', 'Nouveau commentaire sur votre leçon',
      v_nom || ' a commenté « ' || v.titre || ' ».', v_lien
    );
  end if;
  return public.carte_commentaire_lecon(v_nouveau);
end;
$$;

-- ─── Modifier : son auteur ──────────────────────────────────────────────────────────────────────────
create or replace function public.modifier_commentaire_lecon(p_id uuid, p_texte text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.commentaires_lecons%rowtype;
  v_texte text := regexp_replace(coalesce(p_texte, ''), '^\s+|\s+$', '', 'g');
begin
  perform public.exiger_compte_actif();
  select * into v from public.commentaires_lecons where id = p_id for update;
  if not found then
    raise exception 'Ce commentaire n’existe plus.';
  end if;
  perform public.lecon_discutable(v.lecon_id);
  if v.auteur <> (select auth.uid()) then
    raise exception 'Ce commentaire n’est pas le vôtre.' using errcode = '42501';
  end if;
  if char_length(v_texte) not between 1 and 1000 then
    raise exception 'Écrivez votre commentaire (1 000 caractères au plus).';
  end if;
  if v_texte = v.texte then
    return;
  end if;
  update public.commentaires_lecons set texte = v_texte, modifie_le = now() where id = p_id;
end;
$$;

-- ─── Supprimer : son auteur, le formateur de la formation, l'équipe ; rend le nombre retiré (lui et ses réponses) ───
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
  if v.auteur <> (select auth.uid()) and not public.equipe_contenus() and not public.formateur_de(public.formation_de_la_lecon(v.lecon_id)) then
    raise exception 'Ce commentaire n’est pas le vôtre.' using errcode = '42501';
  end if;
  select count(*) + 1 into v_nombre from public.commentaires_lecons where parent_id = p_id;
  delete from public.commentaires_lecons where id = p_id;
  return v_nombre;
end;
$$;

-- ─── « J’aime » : le premier clic l'ajoute, le second le retire ────────────────────────────────────
create or replace function public.basculer_reaction_commentaire_lecon(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_moi uuid := (select auth.uid());
  v_lecon uuid;
  v_aime boolean;
begin
  perform public.exiger_compte_actif();
  select lecon_id into v_lecon from public.commentaires_lecons where id = p_id;
  if not found then
    raise exception 'Ce commentaire n’existe plus.';
  end if;
  perform public.lecon_discutable(v_lecon);
  delete from public.reactions_commentaires_lecons where commentaire_id = p_id and profil_id = v_moi;
  if found then
    v_aime := false;
  else
    insert into public.reactions_commentaires_lecons (commentaire_id, profil_id) values (p_id, v_moi) on conflict do nothing;
    v_aime := true;
  end if;
  return jsonb_build_object(
    'j_aime', v_aime,
    'reactions', (select count(*)::int from public.reactions_commentaires_lecons where commentaire_id = p_id)
  );
end;
$$;

-- ─── Signaler (comme un commentaire de la communauté, migration 0020) ───────────────────────────────
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
  if public.equipe_contenus() then
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

-- ─── Dans la file de l'équipe ───────────────────────────────────────────────────────────────────────
create or replace function public.element_commentaire_lecon(c public.commentaires_lecons)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with s as (select * from public.signalements where traite_le is null and commentaire_lecon_id = c.id)
  select jsonb_build_object(
    'type', 'commentaire_lecon',
    'id', c.id,
    'publication_id', null,
    'lien', '/formations/' || f.slug || '/lecons/' || l.id || '#commentaire-' || c.id,
    'espace', jsonb_build_object('id', null, 'nom', f.titre),
    'auteur', jsonb_build_object('id', c.auteur, 'prenom', coalesce(pr.prenom, ''), 'nom', coalesce(pr.nom, '')),
    'cree_le', c.cree_le,
    'titre', '',
    'texte', c.texte,
    'piece_jointe', null,
    'statut', 'publiee',
    'analyse', null,
    'extrait', l.titre,
    'signalements', jsonb_build_object(
      'nombre', (select count(*)::int from s),
      'motifs', coalesce((
        select jsonb_agg(jsonb_build_object('motif', m.motif, 'nombre', m.n) order by m.n desc, m.motif)
        from (select motif, count(*)::int as n from s group by motif) m
      ), '[]'::jsonb),
      'details', coalesce((
        select jsonb_agg(jsonb_build_object('motif', s.motif, 'precisions', s.precisions, 'par', public.nom_avis(p2.prenom, p2.nom), 'le', s.cree_le) order by s.cree_le, s.id)
        from s join public.profils p2 on p2.id = s.auteur
      ), '[]'::jsonb)
    )
  )
  from public.lecons l
  join public.modules m on m.id = l.module_id
  join public.formations f on f.id = m.formation_id
  join public.profils pr on pr.id = c.auteur
  where l.id = c.lecon_id;
$$;

create or replace function public.file_moderation(p_onglet text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.exiger_equipe_moderation();
  if p_onglet = 'bloquees' then
    return coalesce((
      select jsonb_agg(public.element_publication(b) order by b.cree_le desc, b.id desc)
      from (select * from public.publications where statut = 'bloquee' order by cree_le desc, id desc limit 50) b
    ), '[]'::jsonb);
  end if;
  return coalesce((
    select jsonb_agg(e.element order by e.cree_le, e.id)
    from (
      select public.element_publication(p) as element, p.cree_le, p.id
      from public.publications p
      where p.statut = 'en_attente'
        or (p.statut = 'publiee' and (p.a_examiner or exists (select 1 from public.signalements s where s.publication_id = p.id and s.traite_le is null)))
      union all
      select public.element_reponse(c), c.cree_le, c.id
      from public.commentaires_publications c
      where exists (select 1 from public.signalements s where s.commentaire_id = c.id and s.traite_le is null)
      union all
      select public.element_commentaire_lecon(c), c.cree_le, c.id
      from public.commentaires_lecons c
      where exists (select 1 from public.signalements s where s.commentaire_lecon_id = c.id and s.traite_le is null)
      order by 2, 3
      limit 50
    ) e
  ), '[]'::jsonb);
end;
$$;

create or replace function public.nombre_a_examiner()
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.exiger_equipe_moderation();
  return (
    select count(*)::int from public.publications p
    where p.statut = 'en_attente'
      or (p.statut = 'publiee' and (p.a_examiner or exists (select 1 from public.signalements s where s.publication_id = p.id and s.traite_le is null)))
  ) + (
    select count(*)::int from public.commentaires_publications c
    where exists (select 1 from public.signalements s where s.commentaire_id = c.id and s.traite_le is null)
  ) + (
    select count(*)::int from public.commentaires_lecons c
    where exists (select 1 from public.signalements s where s.commentaire_lecon_id = c.id and s.traite_le is null)
  );
end;
$$;

-- Garder : les signalements sont classés, le commentaire quitte la file.
create or replace function public.garder_commentaire_lecon(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.exiger_equipe_moderation();
  if not exists (select 1 from public.commentaires_lecons where id = p_id) then
    raise exception 'Ce contenu n’existe plus.';
  end if;
  update public.signalements set traite_le = now() where commentaire_lecon_id = p_id and traite_le is null;
end;
$$;

-- Retirer : le commentaire disparaît (avec ses réponses et ses signalements) et son auteur est prévenu.
create or replace function public.retirer_commentaire_lecon(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.commentaires_lecons%rowtype;
  v_lecon record;
begin
  perform public.exiger_equipe_moderation();
  select * into v from public.commentaires_lecons where id = p_id for update;
  if not found then
    raise exception 'Ce contenu n’existe plus.';
  end if;
  select l.id, l.titre, f.slug into v_lecon
  from public.lecons l join public.modules m on m.id = l.module_id join public.formations f on f.id = m.formation_id
  where l.id = v.lecon_id;
  delete from public.commentaires_lecons where id = p_id;
  perform public.notifier(
    array[v.auteur], 'service', 'Commentaire retiré',
    'Votre commentaire sur la leçon « ' || v_lecon.titre || ' » a été retiré par l’équipe Étudium : il ne respecte pas les règles de la communauté.',
    '/formations/' || v_lecon.slug || '/lecons/' || v_lecon.id
  );
end;
$$;

-- ─── Droits d'exécution ─────────────────────────────────────────────────────────────────────────────
revoke execute on function public.lecon_discutable(uuid) from public, anon, authenticated;
revoke execute on function public.carte_commentaire_lecon(public.commentaires_lecons) from public, anon, authenticated;
revoke execute on function public.element_commentaire_lecon(public.commentaires_lecons) from public, anon, authenticated;
-- Lire : null pour un visiteur (la page ne l'appelle pas) ; ouvert aussi à « anon » pour ne pas lever d'erreur.
grant execute on function public.discussion_lecon(uuid, boolean) to anon, authenticated;
revoke execute on function public.commenter_lecon(uuid, text, uuid) from public, anon;
grant execute on function public.commenter_lecon(uuid, text, uuid) to authenticated;
revoke execute on function public.modifier_commentaire_lecon(uuid, text) from public, anon;
grant execute on function public.modifier_commentaire_lecon(uuid, text) to authenticated;
revoke execute on function public.supprimer_commentaire_lecon(uuid) from public, anon;
grant execute on function public.supprimer_commentaire_lecon(uuid) to authenticated;
revoke execute on function public.basculer_reaction_commentaire_lecon(uuid) from public, anon;
grant execute on function public.basculer_reaction_commentaire_lecon(uuid) to authenticated;
revoke execute on function public.signaler_commentaire_lecon(uuid, text, text) from public, anon;
grant execute on function public.signaler_commentaire_lecon(uuid, text, text) to authenticated;
revoke execute on function public.garder_commentaire_lecon(uuid) from public, anon;
grant execute on function public.garder_commentaire_lecon(uuid) to authenticated;
revoke execute on function public.retirer_commentaire_lecon(uuid) from public, anon;
grant execute on function public.retirer_commentaire_lecon(uuid) to authenticated;

commit;
