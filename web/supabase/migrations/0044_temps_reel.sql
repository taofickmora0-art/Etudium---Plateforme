-- Migration 0044 : les notifications en temps réel (liste du 31 octobre 2026, demande après la tâche 9).
-- Jusqu'ici, la cloche, la pastille des messages et le bandeau « Nouvelles publications » se relisaient toutes les 30 à
-- 60 s. La base prévient désormais aussitôt les appareils concernés, par le temps réel de Supabase (realtime.send) :
--   * « compte:<id> », événement « notification » : une notification lui arrive, ou il en lit (ses autres appareils) ;
--   * « compte:<id> », événement « message » : un message arrive dans l'une de ses conversations, ou elle est lue ;
--   * « communaute », événement « publication » : une publication paraît (publiée, validée par l'équipe, ou programmée
--     et parue à l'heure).
-- Rien du contenu n'est diffusé : l'appli relit ce qui la concerne, avec ses droits. Les sujets sont privés : un compte
-- ne peut s'abonner qu'au sien et à « communaute » (règle sur realtime.messages, plus bas). Sans le temps réel, rien ne
-- casse : la diffusion est ignorée et l'appli continue de relire régulièrement. Rejouable.

begin;

-- ─── Diffuser un événement, sans jamais faire échouer l'action qui le déclenche ─────────────────────
create or replace function public.diffuser(p_sujet text, p_evenement text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if to_regprocedure('realtime.send(jsonb,text,text,boolean)') is null then
    return;
  end if;
  begin
    perform realtime.send('{}'::jsonb, p_evenement, p_sujet, true);
  exception when others then
    -- Le temps réel indisponible : la relecture régulière de l'appli prend le relais.
    null;
  end;
end;
$$;

-- ─── Les notifications : une diffusion par destinataire et par envoi (ou par lecture) ───────────────
create or replace function public.diffuser_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_destinataire uuid;
begin
  for v_destinataire in select distinct n.destinataire from lignes n loop
    perform public.diffuser('compte:' || v_destinataire, 'notification');
  end loop;
  return null;
end;
$$;

drop trigger if exists notifications_temps_reel_ajout on public.notifications;
create trigger notifications_temps_reel_ajout
  after insert on public.notifications
  referencing new table as lignes
  for each statement execute function public.diffuser_notifications();

drop trigger if exists notifications_temps_reel_lecture on public.notifications;
create trigger notifications_temps_reel_lecture
  after update on public.notifications
  referencing new table as lignes
  for each statement execute function public.diffuser_notifications();

-- ─── Les messages : les deux côtés de la conversation (l'assistance : toute l'équipe) ──────────────
create or replace function public.participants_conversation(p_conversation uuid)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select array[c.etudiant_id] || case when c.formateur_id is null then public.membres_equipe() else array[c.formateur_id] end
  from public.conversations c
  where c.id = p_conversation;
$$;

create or replace function public.diffuser_conversations(p_conversations uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_compte uuid;
begin
  for v_compte in
    select distinct x.compte
    from unnest(p_conversations) as c(id)
    cross join lateral unnest(public.participants_conversation(c.id)) as x(compte)
    where x.compte is not null
  loop
    perform public.diffuser('compte:' || v_compte, 'message');
  end loop;
end;
$$;

create or replace function public.diffuser_messages()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.diffuser_conversations(array(select distinct m.conversation_id from nouveaux m));
  return null;
end;
$$;

drop trigger if exists messages_temps_reel on public.messages;
create trigger messages_temps_reel
  after insert on public.messages
  referencing new table as nouveaux
  for each statement execute function public.diffuser_messages();

-- Une conversation qui passe de non lue à lue (pour l'un des côtés) : la pastille de ses autres appareils suit. Chaque
-- ouverture la marque lue de nouveau (fil_conversation, 0035) : seul le passage compte, sinon l'écran ouvert, prévenu
-- de sa propre lecture, se relirait sans fin.
create or replace function public.diffuser_conversations_lues()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.diffuser_conversations(array(
    select apres.id
    from apres
    join avant on avant.id = apres.id
    where (avant.lu_etudiant_le < apres.dernier_message_le and apres.lu_etudiant_le >= apres.dernier_message_le)
       or (avant.lu_autre_le < apres.dernier_message_le and apres.lu_autre_le >= apres.dernier_message_le)
  ));
  return null;
end;
$$;

drop trigger if exists conversations_temps_reel on public.conversations;
create trigger conversations_temps_reel
  after update on public.conversations
  referencing old table as avant new table as apres
  for each statement execute function public.diffuser_conversations_lues();

-- ─── Les publications : la communauté, quand l'une paraît ──────────────────────────────────────────
create or replace function public.diffuser_publication()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.diffuser('communaute', 'publication');
  return null;
end;
$$;

-- Publiée tout de suite (pas programmée, pas en attente de l'équipe).
drop trigger if exists publications_temps_reel_ajout on public.publications;
create trigger publications_temps_reel_ajout
  after insert on public.publications
  for each row when (new.statut = 'publiee' and new.cree_le <= now())
  execute function public.diffuser_publication();

-- Validée par l'équipe (0020).
drop trigger if exists publications_temps_reel_validation on public.publications;
create trigger publications_temps_reel_validation
  after update of statut on public.publications
  for each row when (old.statut is distinct from 'publiee' and new.statut = 'publiee' and new.cree_le <= now())
  execute function public.diffuser_publication();

-- Programmée et parue à l'heure : traiter_publications_programmees (0041) la marque, chaque minute.
drop trigger if exists publications_temps_reel_parution on public.publications;
create trigger publications_temps_reel_parution
  after update of parution_annoncee_le on public.publications
  for each row when (old.parution_annoncee_le is null and new.parution_annoncee_le is not null and new.statut = 'publiee')
  execute function public.diffuser_publication();

-- ─── Droits ─────────────────────────────────────────────────────────────────────────────────────────
revoke execute on function public.diffuser(text, text) from public, anon, authenticated;
revoke execute on function public.diffuser_notifications() from public, anon, authenticated;
revoke execute on function public.participants_conversation(uuid) from public, anon, authenticated;
revoke execute on function public.diffuser_conversations(uuid[]) from public, anon, authenticated;
revoke execute on function public.diffuser_messages() from public, anon, authenticated;
revoke execute on function public.diffuser_conversations_lues() from public, anon, authenticated;
revoke execute on function public.diffuser_publication() from public, anon, authenticated;

commit;

-- ─── Qui peut s'abonner : son sujet « compte:<id> », et « communaute » ──────────────────────────────
-- Supabase vérifie ce droit en lisant realtime.messages avec le sujet demandé (realtime.topic()) et le compte connecté.
do $temps_reel$
begin
  if to_regclass('realtime.messages') is null then
    raise notice 'Temps réel indisponible : règle d''abonnement non créée (voir le guide « Ce qui te revient », section 49).';
    return;
  end if;
  execute 'drop policy if exists etudium_temps_reel on realtime.messages';
  execute $regle$
    create policy etudium_temps_reel on realtime.messages
    for select to authenticated
    using (
      realtime.messages.extension = 'broadcast'
      and (
        (select realtime.topic()) = 'communaute'
        or (select realtime.topic()) = 'compte:' || (select auth.uid())::text
      )
    )
  $regle$;
end
$temps_reel$;
