-- Migration 0059 : désactiver une formation (lot 5, étape C ; spec du 15 octobre, Q12 et Q13).
-- Une formation désactivée n'ouvre plus rien aux étudiants, tout de suite : la règle d'accès aux leçons (0050) n'ouvre
-- que les formations publiées (leçons, quiz, exercices, visionnage, discussions, images suivent). Elle reste dans
-- « Mes formations » de qui l'a commencée ; progression, certificats et avis sont gardés. L'équipe seule désactive et
-- réactive (0047 refuse tout changement d'état au formateur). Ceux qui la suivent sont prévenus : appli, push (0058)
-- et e-mail (message important).
-- Rejouable.

-- ─── Le nouvel état ─────────────────────────────────────────────────────────────────────────────────
-- Il ne sert pas dans cette migration (Postgres l'interdit avant sa validation, comme en 0030) : les fonctions
-- comparent le texte du statut.
alter type public.statut_formation add value if not exists 'desactivee';

begin;

-- ─── Les étudiants qui suivent une formation, comptes suspendus exclus ──────────────────────────────
create or replace function public.suiveurs_actifs_formation(p_formation uuid)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(s), '{}')
  from unnest(public.suiveurs_formation(p_formation)) s
  where not exists (select 1 from public.suspensions su where su.profil_id = s);
$$;

-- Pour la fenêtre de confirmation du back-office : « N étudiants suivent cette formation ».
create or replace function public.nombre_suiveurs_formation(p_formation uuid)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.equipe_contenus() then
    raise exception 'Réservé à l’équipe.' using errcode = '42501';
  end if;
  return cardinality(public.suiveurs_actifs_formation(p_formation));
end;
$$;

-- ─── Les passages permis ────────────────────────────────────────────────────────────────────────────
-- Désactiver : une formation publiée seulement. Une formation désactivée se réactive (elle redevient publiée).
create or replace function public.desactivation_regle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.statut::text = 'desactivee' and old.statut::text not in ('desactivee', 'publiee') then
    raise exception 'Seule une formation publiée peut être désactivée.' using errcode = 'P0001';
  end if;
  if old.statut::text = 'desactivee' and new.statut::text not in ('desactivee', 'publiee') then
    raise exception 'Une formation désactivée se réactive : elle redevient publiée.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
drop trigger if exists formations_desactivation_regle on public.formations;
create trigger formations_desactivation_regle
  before update of statut on public.formations
  for each row execute function public.desactivation_regle();

-- ─── Prévenir : les étudiants (appli, push, e-mail) et le formateur ─────────────────────────────────
create or replace function public.notifier_desactivation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_suiveurs uuid[];
  v_formateur uuid;
  v_titre text;
  v_texte text;
  v_lien text;
  v_titre_formateur text;
begin
  if new.statut::text = 'desactivee' and old.statut::text <> 'desactivee' then
    v_titre := format('« %s » est momentanément indisponible', new.titre);
    v_texte := 'Votre progression et vos certificats sont conservés.';
    v_lien := '/mes-formations';
    v_titre_formateur := format('Votre formation « %s » est désactivée par l’équipe', new.titre);
  elsif old.statut::text = 'desactivee' and new.statut::text = 'publiee' then
    v_titre := format('« %s » est de nouveau disponible', new.titre);
    v_texte := 'Vous reprenez là où vous en étiez.';
    v_lien := '/formations/' || new.slug;
    v_titre_formateur := format('Votre formation « %s » est de nouveau en ligne', new.titre);
  else
    return null;
  end if;

  v_suiveurs := public.suiveurs_actifs_formation(new.id);
  perform public.notifier(v_suiveurs, 'service', v_titre, v_texte, v_lien, true);
  -- Un message important (Q10) : l'e-mail part, quelles que soient les préférences.
  insert into public.envois (canal, destinataire, titre, texte, lien)
  select 'email', s, v_titre, v_texte, v_lien from unnest(v_suiveurs) s;

  select compte_id into v_formateur from public.formateurs where id = new.formateur_id;
  if v_formateur is not null then
    perform public.notifier(array[v_formateur], 'service', v_titre_formateur, '', '/formateur/formations/' || new.id, true);
  end if;
  return null;
end;
$$;
drop trigger if exists formations_desactivation on public.formations;
create trigger formations_desactivation
  after update of statut on public.formations
  for each row execute function public.notifier_desactivation();

-- ─── L'historique (0057) : réactiver ne crée pas de version (le contenu n'a pas changé) ─────────────
create or replace function public.version_mise_en_ligne()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.statut = 'publiee' and old.statut is distinct from 'publiee' and old.statut::text <> 'desactivee' then
    perform public.noter_version(new.id, 'Mise en ligne');
  end if;
  return null;
end;
$$;

-- ─── Droits ─────────────────────────────────────────────────────────────────────────────────────────
revoke execute on function public.suiveurs_actifs_formation(uuid) from public, anon, authenticated;
revoke execute on function public.nombre_suiveurs_formation(uuid) from public;
revoke execute on function public.desactivation_regle() from public, anon, authenticated;
revoke execute on function public.notifier_desactivation() from public, anon, authenticated;
grant execute on function public.nombre_suiveurs_formation(uuid) to authenticated;

commit;
