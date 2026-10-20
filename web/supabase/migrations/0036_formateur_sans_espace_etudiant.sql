-- Migration 0036 : le formateur n'est plus étudiant (restructuration du 20 octobre 2026, R1 ;
-- spec docs/superpowers/specs/2026-10-20-restructuration-design.md, §4.3).
-- Un formateur n'ouvre que le contenu de ses formations ; la base refuse toute action d'étudiant de sa part (progression,
-- favoris, avis, inscriptions aux sessions, quiz, rendus, conversation côté étudiant) ; les notifications
-- d'apprentissage ne lui sont plus envoyées. Repasser étudiant (changer_role) lui rend tout.
-- Rejouable. L'équipe n'est jamais formateur (0017) : rien ne change pour elle, ni pour l'étudiant.

begin;

-- ─── L'accès d'un étudiant : une leçon publiée, jamais pour un formateur ───────────────────────────
-- Même définition qu'en 0027, la branche « leçon publiée » exclut le formateur : il n'ouvre que ses formations.
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
          and (l.apercu or (f.gratuite and (select auth.uid()) is not null))
      )
    )
  );
$$;

-- ─── Aucune action d'étudiant pour un formateur ────────────────────────────────────────────────────
-- Un déclencheur par table d'étudiant : il refuse la ligne d'un compte formateur, même écrite par une fonction.
create or replace function public.refuser_compte_formateur()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.roles r where r.profil_id = new.profil_id and r.role = 'formateur') then
    raise exception 'Un compte formateur ne suit pas de formation.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists progression_lecons_pas_de_formateur on public.progression_lecons;
create trigger progression_lecons_pas_de_formateur
  before insert or update on public.progression_lecons
  for each row execute function public.refuser_compte_formateur();

drop trigger if exists favoris_pas_de_formateur on public.favoris;
create trigger favoris_pas_de_formateur
  before insert or update on public.favoris
  for each row execute function public.refuser_compte_formateur();

drop trigger if exists avis_pas_de_formateur on public.avis;
create trigger avis_pas_de_formateur
  before insert or update on public.avis
  for each row execute function public.refuser_compte_formateur();

drop trigger if exists inscriptions_sessions_pas_de_formateur on public.inscriptions_sessions;
create trigger inscriptions_sessions_pas_de_formateur
  before insert or update on public.inscriptions_sessions
  for each row execute function public.refuser_compte_formateur();

drop trigger if exists tentatives_quiz_pas_de_formateur on public.tentatives_quiz;
create trigger tentatives_quiz_pas_de_formateur
  before insert or update on public.tentatives_quiz
  for each row execute function public.refuser_compte_formateur();

drop trigger if exists rendus_exercices_pas_de_formateur on public.rendus_exercices;
create trigger rendus_exercices_pas_de_formateur
  before insert or update on public.rendus_exercices
  for each row execute function public.refuser_compte_formateur();

-- La messagerie côté étudiant : ni nouvelle conversation, ni message écrit comme étudiant.
create or replace function public.refuser_formateur_conversation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_compte uuid;
begin
  if tg_table_name = 'conversations' then
    v_compte := new.etudiant_id;
  elsif new.de_etudiant then
    v_compte := new.auteur_id;
  end if;
  if v_compte is not null and exists (select 1 from public.roles r where r.profil_id = v_compte and r.role = 'formateur') then
    raise exception 'Un compte formateur ne suit pas de formation.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists conversations_pas_de_formateur on public.conversations;
create trigger conversations_pas_de_formateur
  before insert on public.conversations
  for each row execute function public.refuser_formateur_conversation();

drop trigger if exists messages_pas_de_formateur on public.messages;
create trigger messages_pas_de_formateur
  before insert on public.messages
  for each row execute function public.refuser_formateur_conversation();

-- ─── notifier : pas de notification d'apprentissage pour un formateur ──────────────────────────────
-- Même définition qu'en 0018 ; un formateur ne reçoit plus les sessions live, les nouveaux contenus, les rappels
-- d'apprentissage, les recommandations ni l'expiration (il ne suit pas de formation). Le reste lui parvient.
create or replace function public.notifier(
  p_destinataires uuid[],
  p_categorie text,
  p_titre text,
  p_texte text,
  p_lien text,
  p_auteur_inclus boolean
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nombre integer;
begin
  delete from public.notifications
  where destinataire = any (p_destinataires) and cree_le < now() - interval '6 months';

  insert into public.notifications (destinataire, categorie, titre, texte, lien)
  select p.id, p_categorie, left(p_titre, 200), left(coalesce(p_texte, ''), 400), p_lien
  from public.profils p
  where p.id = any (p_destinataires)
    and (coalesce(p_auteur_inclus, false) or p.id is distinct from (select auth.uid()))
    and (p.preferences_notifications ->> 'canal_appli') is distinct from 'false'
    and (p_categorie = 'service' or (p.preferences_notifications ->> p_categorie) is distinct from 'false')
    and not (
      p_categorie in ('sessions_live', 'nouveaux_contenus', 'rappels_apprentissage', 'recommandations', 'expiration_renouvellement')
      and exists (select 1 from public.roles r where r.profil_id = p.id and r.role = 'formateur')
    );
  get diagnostics v_nombre = row_count;
  return v_nombre;
end;
$$;

-- ─── Droits ─────────────────────────────────────────────────────────────────────────────────────────
revoke execute on function public.refuser_compte_formateur() from public, anon, authenticated;
revoke execute on function public.refuser_formateur_conversation() from public, anon, authenticated;
revoke execute on function public.notifier(uuid[], text, text, text, text, boolean) from public, anon, authenticated;

commit;
