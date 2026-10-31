-- Migration 0041 : les notifications de la communauté (liste du 31 octobre 2026, tâche 8).
-- Ce qui prévenait déjà : un commentaire ou une réponse (0025, 0037), la modération (0020), les sessions live.
-- Ce qui manquait :
--   * un J'aime sur une publication ou un commentaire (communauté et leçons) prévient son auteur, avec une seule
--     notification non lue par contenu, mise à jour (« Nadia S. et 2 autres personnes aiment votre publication ») ;
--   * une publication programmée qui paraît prévient son auteur, une fois (traitée chaque minute par la tâche planifiée
--     et quand la cloche se charge).
-- Mêmes définitions qu'en 0019 (basculer_reaction), 0025 (basculer_reaction_commentaire), 0028
-- (basculer_reaction_commentaire_lecon) et 0023 (rappels_sessions), plus ces envois. Rejouable.

begin;

-- ─── Un extrait lisible d'un texte mis en forme (gras, liens…) pour une notification ─────────────────
create or replace function public.extrait_notification(p_texte text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when char_length(t) > 80 then left(t, 79) || '…' else t end
  from (
    select btrim(regexp_replace(
      regexp_replace(regexp_replace(coalesce(p_texte, ''), '\[([^\]]*)\]\([^)]*\)', '\1', 'g'), '(\*\*|~~|\+\+|(^|\n)#{1,3} |(^|\n)> )', ' ', 'g'),
      '\s+', ' ', 'g'
    )) as t
  ) x;
$$;

-- ─── Un J'aime : l'auteur prévenu, une seule notification non lue par contenu ───────────────────────
-- `p_nombre` : les J'aime des autres (l'auteur exclu). La précédente notification non lue est remplacée, seulement si
-- la nouvelle sera créée (préférences de l'auteur) : sinon, l'ancienne reste.
create or replace function public.notifier_jaime(p_auteur uuid, p_quoi text, p_texte text, p_lien text, p_nombre integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_moi uuid := (select auth.uid());
  v_nom text;
  v_titre text;
begin
  if p_auteur is null or p_auteur = v_moi then
    return;
  end if;
  select public.nom_avis(prenom, nom) into v_nom from public.profils where id = v_moi;
  v_titre := case
    when p_nombre <= 1 then v_nom || ' aime ' || p_quoi
    when p_nombre = 2 then v_nom || ' et une autre personne aiment ' || p_quoi
    else v_nom || ' et ' || (p_nombre - 1) || ' autres personnes aiment ' || p_quoi
  end;
  delete from public.notifications n
  using public.profils p
  where p.id = n.destinataire
    and n.destinataire = p_auteur and n.categorie = 'communaute' and n.lue_le is null and n.lien = p_lien
    and (n.titre like '% aime ' || p_quoi or n.titre like '% aiment ' || p_quoi)
    and (p.preferences_notifications ->> 'canal_appli') is distinct from 'false'
    and (p.preferences_notifications ->> 'communaute') is distinct from 'false';
  perform public.notifier(array[p_auteur], 'communaute', v_titre, '« ' || public.extrait_notification(p_texte) || ' »', p_lien);
end;
$$;

create or replace function public.basculer_reaction(p_publication uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_moi uuid := (select auth.uid());
  v_aime boolean;
  v_publication public.publications%rowtype;
begin
  perform public.publication_ouverte(p_publication);
  delete from public.reactions_publications where publication_id = p_publication and profil_id = v_moi;
  if found then
    v_aime := false;
  else
    insert into public.reactions_publications (publication_id, profil_id) values (p_publication, v_moi) on conflict do nothing;
    v_aime := true;
    -- Son auteur est prévenu (0041).
    select * into v_publication from public.publications where id = p_publication;
    perform public.notifier_jaime(
      v_publication.auteur, 'votre publication', coalesce(nullif(v_publication.titre, ''), v_publication.texte),
      '/communaute/publications/' || p_publication,
      (select count(*)::int from public.reactions_publications where publication_id = p_publication and profil_id <> v_publication.auteur)
    );
  end if;
  return jsonb_build_object(
    'j_aime', v_aime,
    'reactions', (select count(*)::int from public.reactions_publications where publication_id = p_publication)
  );
end;
$$;

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
  v_commentaire public.commentaires_publications%rowtype;
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
    -- Son auteur est prévenu (0041).
    select * into v_commentaire from public.commentaires_publications where id = p_id;
    perform public.notifier_jaime(
      v_commentaire.auteur, 'votre commentaire', v_commentaire.texte,
      '/communaute/publications/' || v_publication || '#commentaire-' || p_id,
      (select count(*)::int from public.reactions_commentaires where commentaire_id = p_id and profil_id <> v_commentaire.auteur)
    );
  end if;
  return jsonb_build_object(
    'j_aime', v_aime,
    'reactions', (select count(*)::int from public.reactions_commentaires where commentaire_id = p_id)
  );
end;
$$;

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
  v_commentaire public.commentaires_lecons%rowtype;
  v_slug text;
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
    -- Son auteur est prévenu (0041).
    select * into v_commentaire from public.commentaires_lecons where id = p_id;
    select f.slug into v_slug
    from public.lecons le
    join public.modules m on m.id = le.module_id
    join public.formations f on f.id = m.formation_id
    where le.id = v_lecon;
    perform public.notifier_jaime(
      v_commentaire.auteur, 'votre commentaire', v_commentaire.texte,
      '/formations/' || v_slug || '/lecons/' || v_lecon || '#commentaire-' || p_id,
      (select count(*)::int from public.reactions_commentaires_lecons where commentaire_id = p_id and profil_id <> v_commentaire.auteur)
    );
  end if;
  return jsonb_build_object(
    'j_aime', v_aime,
    'reactions', (select count(*)::int from public.reactions_commentaires_lecons where commentaire_id = p_id)
  );
end;
$$;

-- ─── Les publications programmées qui paraissent ────────────────────────────────────────────────────
-- Programmée : écrite plus d'une minute avant sa parution (0026). Une fois parue, son auteur est prévenu, une fois ;
-- pas si elle paraît plus d'une heure après l'heure prévue (validée tard par la modération : « Publication en ligne »
-- l'a déjà dit). Les publications déjà parues avant cette migration sont marquées, sans notification.
alter table public.publications add column if not exists parution_annoncee_le timestamptz;
update public.publications set parution_annoncee_le = cree_le where parution_annoncee_le is null and cree_le <= now();

create or replace function public.traiter_publications_programmees()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nombre integer := 0;
  r record;
begin
  for r in
    update public.publications p
    set parution_annoncee_le = now()
    where p.parution_annoncee_le is null and p.statut = 'publiee'
      and p.cree_le <= now() and p.cree_le > p.ecrite_le + interval '1 minute'
    returning p.id, p.auteur, p.titre, p.texte, p.cree_le
  loop
    if r.cree_le > now() - interval '1 hour' then
      v_nombre := v_nombre + public.notifier(
        array[r.auteur], 'communaute', 'Votre publication programmée est parue',
        '« ' || public.extrait_notification(coalesce(nullif(r.titre, ''), r.texte)) || ' »',
        '/communaute/publications/' || r.id, true
      );
    end if;
  end loop;
  return v_nombre;
end;
$$;

create or replace function public.rappels_sessions()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.exiger_compte_actif();
  -- Les publications programmées qui viennent de paraître (0041), puis les sessions live.
  perform public.traiter_publications_programmees();
  return public.traiter_sessions_live();
end;
$$;

-- ─── Droits ─────────────────────────────────────────────────────────────────────────────────────────
revoke execute on function public.extrait_notification(text) from public, anon, authenticated;
revoke execute on function public.notifier_jaime(uuid, text, text, text, integer) from public, anon, authenticated;
revoke execute on function public.traiter_publications_programmees() from public, anon, authenticated;

commit;

-- ─── La tâche planifiée, chaque minute (comme les sessions live, 0023) ───────────────────────────────
-- Sans pg_cron, la cloche suffit (rappels_sessions) : la notification part au prochain chargement d'une cloche.
do $cron$
begin
  begin
    create extension if not exists pg_cron with schema pg_catalog;
  exception when others then
    raise notice 'pg_cron indisponible (%) : activez Cron dans Supabase, puis relancez ce bloc.', sqlerrm;
    return;
  end;
  begin
    perform cron.schedule('etudium-publications-programmees', '* * * * *', 'select public.traiter_publications_programmees()');
  exception when others then
    raise notice 'Tâche planifiée non créée (%) : voir le guide « Ce qui te revient », section 47.', sqlerrm;
  end;
end
$cron$;
