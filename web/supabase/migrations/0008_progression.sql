-- Étudium · migration 0008 : visite et fin d'une leçon (tâche 1.7).
-- À appliquer dans Supabase, après la 0007 : SQL Editor → New query → coller tout le fichier → Run.
-- Rejouable : relancé sur une base qui l'a déjà, il ne change rien et ne casse rien.
--
-- Le suivi d'une formation (commencée le, dernière leçon ouverte, terminée le : spec §4) se déduit des lignes de
-- progression_lecons (0007) : la première ouverture, la dernière visite et la date de fin de chaque leçon.

begin;

-- Première ouverture de la leçon (vue_le garde la dernière visite).
alter table public.progression_lecons add column if not exists ouverte_le timestamptz not null default now();

-- Visite d'une leçon : sert à « Continuer » (dernière leçon ouverte) et à « Mes formations » (formations commencées).
create or replace function public.ouvrir_lecon(p_lecon uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not public.acces_lecon(p_lecon) then
    raise exception 'Leçon inaccessible.' using errcode = '42501';
  end if;
  insert into public.progression_lecons (profil_id, lecon_id)
  values ((select auth.uid()), p_lecon)
  on conflict (profil_id, lecon_id) do update set vue_le = now();
end;
$$;

-- « Marquer comme terminée » : seulement pour une leçon sans vidéo (spec Q3). Une leçon vidéo se termine quand le temps
-- réellement regardé atteint le seuil (enregistrer_visionnage, 0007).
create or replace function public.terminer_lecon(p_lecon uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not public.acces_lecon(p_lecon) then
    raise exception 'Leçon inaccessible.' using errcode = '42501';
  end if;
  if exists (select 1 from public.lecons_contenus c where c.lecon_id = p_lecon and c.video_id is not null) then
    raise exception 'Une leçon vidéo se termine en la regardant.' using errcode = '22023';
  end if;
  insert into public.progression_lecons (profil_id, lecon_id, terminee_le)
  values ((select auth.uid()), p_lecon, now())
  on conflict (profil_id, lecon_id) do update
    set terminee_le = coalesce(public.progression_lecons.terminee_le, now()),
        vue_le = now();
end;
$$;

revoke execute on function public.ouvrir_lecon(uuid) from public, anon;
revoke execute on function public.terminer_lecon(uuid) from public, anon;
grant execute on function public.ouvrir_lecon(uuid) to authenticated;
grant execute on function public.terminer_lecon(uuid) to authenticated;

commit;
