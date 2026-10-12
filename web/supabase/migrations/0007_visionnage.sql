-- Étudium · migration 0007 : temps réellement regardé des vidéos (tâche 1.6).
-- À appliquer dans Supabase, après la 0006 : SQL Editor → New query → coller tout le fichier → Run.
-- Rejouable : relancé sur une base qui l'a déjà, il ne change rien et ne casse rien.

begin;

-- Une ligne par compte et par leçon. On garde les passages réellement lus (de 2:10 à 4:35…), en secondes, et non la
-- position atteinte : un passage lu deux fois ne compte qu'une fois, un saut dans la barre ne compte pas (spec §5).
create table if not exists public.progression_lecons (
  profil_id uuid not null default auth.uid() references public.profils (id) on delete cascade,
  lecon_id uuid not null references public.lecons (id) on delete cascade,
  passages int4multirange not null default '{}',
  -- Où reprendre la vidéo (tâche 1.7).
  position_secondes integer not null default 0,
  -- Garde-fou : un envoi ne peut couvrir plus que le temps écoulé depuis le précédent.
  dernier_envoi timestamptz,
  vue_le timestamptz not null default now(),
  terminee_le timestamptz,
  primary key (profil_id, lecon_id),
  constraint progression_position_positive check (position_secondes >= 0)
);
create index if not exists progression_lecons_lecon_idx on public.progression_lecons (lecon_id);

alter table public.progression_lecons enable row level security;

-- Lecture : chacun la sienne. Écriture : seulement par les deux fonctions ci-dessous, qui vérifient tout.
revoke all on public.progression_lecons from anon;
revoke insert, update, delete, truncate on public.progression_lecons from authenticated;

drop policy if exists "sa progression : lecture" on public.progression_lecons;
create policy "sa progression : lecture" on public.progression_lecons
  for select to authenticated
  using (profil_id = (select auth.uid()));

-- Secondes couvertes par des passages.
create or replace function public.secondes_couvertes(p_passages int4multirange)
returns integer
language sql
immutable
set search_path = ''
as $$
  select coalesce(sum(upper(r) - lower(r)), 0)::integer from unnest(p_passages) as r;
$$;

-- Début d'un visionnage (première lecture) : ouvre la fenêtre de temps des envois suivants.
create or replace function public.commencer_visionnage(p_lecon uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not public.acces_lecon(p_lecon) then
    raise exception 'Leçon inaccessible.' using errcode = '42501';
  end if;
  insert into public.progression_lecons (profil_id, lecon_id, dernier_envoi, vue_le)
  values ((select auth.uid()), p_lecon, now(), now())
  on conflict (profil_id, lecon_id) do update set dernier_envoi = now(), vue_le = now();
end;
$$;

-- Envoi des passages regardés depuis le dernier envoi. Rend les secondes vues, la durée de référence et l'état.
-- Durée de référence : celle de la leçon ; celle du lecteur si elle est plus courte mais en vaut au moins la moitié,
-- ou si la leçon n'a pas de durée.
create or replace function public.enregistrer_visionnage(
  p_lecon uuid,
  p_passages int4multirange,
  p_position integer,
  p_duree_video integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_duree integer;
  v_seuil smallint;
  v_reference integer;
  v_ligne public.progression_lecons;
  v_passages int4multirange;
  v_vues integer;
begin
  if v_uid is null or not public.acces_lecon(p_lecon) then
    raise exception 'Leçon inaccessible.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.lecons_contenus c where c.lecon_id = p_lecon and c.video_id is not null) then
    raise exception 'Cette leçon n''a pas de vidéo.' using errcode = '22023';
  end if;

  select l.duree_secondes, f.seuil_video into v_duree, v_seuil
  from public.lecons l
  join public.modules m on m.id = l.module_id
  join public.formations f on f.id = m.formation_id
  where l.id = p_lecon;

  v_reference := case
    when v_duree > 0 and p_duree_video between ceil(v_duree / 2.0) and v_duree then p_duree_video
    when v_duree > 0 then v_duree
    else greatest(coalesce(p_duree_video, 0), 0)
  end;

  select * into v_ligne from public.progression_lecons where profil_id = v_uid and lecon_id = p_lecon for update;
  if not found or v_ligne.dernier_envoi is null then
    raise exception 'Visionnage non commencé.' using errcode = '55000';
  end if;

  -- Rien au-delà de la vidéo ; et pas plus que le temps écoulé depuis le dernier envoi, en vitesse 2× (marge de 3 s).
  v_passages := p_passages * int4multirange(int4range(0, v_reference));
  if public.secondes_couvertes(v_passages) > extract(epoch from now() - v_ligne.dernier_envoi) * 2 + 3 then
    raise exception 'Passage plus long que le temps écoulé.' using errcode = '22023';
  end if;

  update public.progression_lecons
  set passages = passages + v_passages,
      position_secondes = least(greatest(coalesce(p_position, 0), 0), greatest(v_reference, 0)),
      dernier_envoi = now(),
      vue_le = now()
  where profil_id = v_uid and lecon_id = p_lecon
  returning * into v_ligne;

  v_vues := public.secondes_couvertes(v_ligne.passages);
  if v_ligne.terminee_le is null and v_reference > 0 and v_vues * 100 >= v_seuil * v_reference then
    update public.progression_lecons set terminee_le = now()
    where profil_id = v_uid and lecon_id = p_lecon
    returning * into v_ligne;
  end if;

  return jsonb_build_object('secondes_vues', v_vues, 'reference', v_reference, 'terminee', v_ligne.terminee_le is not null);
end;
$$;

revoke execute on function public.commencer_visionnage(uuid) from public, anon;
revoke execute on function public.enregistrer_visionnage(uuid, int4multirange, integer, integer) from public, anon;
grant execute on function public.commencer_visionnage(uuid) to authenticated;
grant execute on function public.enregistrer_visionnage(uuid, int4multirange, integer, integer) to authenticated;

commit;
