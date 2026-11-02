-- Étudium · base de production · partie 3 sur 5 (migrations 0035 à 0055).
-- Fichier produit par scripts/assembler-migrations.mjs : ne pas le modifier à la main.
-- Supabase › SQL Editor › New query : colle tout ce fichier, puis Run. Attends « Success » avant la partie suivante.
-- Ensuite : partie 4.

-- ═══ 0035_messagerie.sql ═══
-- Étudium, migration 0035 : la messagerie (lot 5, étape A ; spec de la fin du lot 5, Q1 à Q6).
--
-- L'étudiant écrit au formateur d'une formation qu'il suit (règle provisoire avant le lot 2 : une leçon ouverte) et à
-- l'Équipe Étudium (assistance) ; le formateur écrit à ses étudiants ; l'équipe répond à l'assistance au nom
-- d'« Équipe Étudium ». Une conversation par paire étudiant–formateur, une conversation d'assistance par étudiant.
-- Un fichier par message (10 Mo, les formats des rendus), lisible par les participants seulement. Chaque message
-- prévient l'autre côté (catégorie « messages »), une seule notification non lue par conversation.
--
-- À coller dans l'éditeur SQL de Supabase, après la 0034. Rejouable.

begin;

-- ─── La catégorie de notification « messages » ──────────────────────────────────────────────────────
alter table public.notifications drop constraint if exists notifications_categorie;
alter table public.notifications add constraint notifications_categorie check (categorie in (
  'nouveaux_contenus', 'sessions_live', 'expiration_renouvellement', 'exercices', 'rappels_apprentissage',
  'communaute', 'recommandations', 'annonces', 'service', 'messages'
));

-- ─── Les conversations et les messages (lus et écrits par les fonctions seulement) ─────────────────────
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  etudiant_id uuid not null references public.profils (id) on delete cascade,
  -- Le compte du formateur ; null : l'assistance (l'Équipe Étudium).
  formateur_id uuid references public.profils (id) on delete cascade,
  cree_le timestamptz not null default now(),
  dernier_message_le timestamptz not null default now(),
  -- Jusqu'où chaque côté a lu (l'équipe partage le sien : une demande lue par un membre l'est pour tous).
  lu_etudiant_le timestamptz not null default now(),
  lu_autre_le timestamptz not null default now(),
  constraint conversations_pas_soi check (formateur_id is null or etudiant_id <> formateur_id)
);
create unique index if not exists conversations_paire on public.conversations (etudiant_id, formateur_id) where formateur_id is not null;
create unique index if not exists conversations_assistance on public.conversations (etudiant_id) where formateur_id is null;
create index if not exists conversations_formateur_idx on public.conversations (formateur_id, dernier_message_le desc) where formateur_id is not null;
create index if not exists conversations_equipe_idx on public.conversations (dernier_message_le desc) where formateur_id is null;
alter table public.conversations enable row level security;
revoke all on public.conversations from anon, authenticated;

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  auteur_id uuid references public.profils (id) on delete set null,
  -- Écrit par l'étudiant de la conversation (sinon : son formateur, ou l'équipe).
  de_etudiant boolean not null,
  texte text not null default '',
  -- Le chemin dans l'espace « messages » ; null sans pièce jointe.
  fichier text,
  nom_fichier text not null default '',
  format text not null default '',
  taille_octets bigint not null default 0,
  cree_le timestamptz not null default now(),
  constraint messages_texte check (char_length(texte) <= 4000),
  constraint messages_contenu check (texte <> '' or fichier is not null)
);
create index if not exists messages_conversation_idx on public.messages (conversation_id, cree_le desc);
create index if not exists messages_auteur_idx on public.messages (auteur_id, cree_le);
create unique index if not exists messages_fichier_unique on public.messages (fichier) where fichier is not null;
alter table public.messages enable row level security;
revoke all on public.messages from anon, authenticated;

-- ─── Outils ─────────────────────────────────────────────────────────────────────────────────────────
-- L'étudiant suit-il une formation de ce formateur (son compte) ? Une leçon ouverte suffit (règle provisoire).
create or replace function public.suit_formation_de(p_etudiant uuid, p_formateur uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.progression_lecons p
    join public.lecons l on l.id = p.lecon_id
    join public.modules m on m.id = l.module_id
    join public.formations f on f.id = m.formation_id
    join public.formateurs fo on fo.id = f.formateur_id
    where p.profil_id = p_etudiant and fo.compte_id = p_formateur
  );
$$;

-- La formation qui les relie, la plus récemment ouverte (« Formateur·rice · Maîtriser Microsoft Excel »).
create or replace function public.formation_commune(p_etudiant uuid, p_formateur uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('titre', f.titre, 'slug', f.slug)
  from public.progression_lecons p
  join public.lecons l on l.id = p.lecon_id
  join public.modules m on m.id = l.module_id
  join public.formations f on f.id = m.formation_id
  join public.formateurs fo on fo.id = f.formateur_id
  where p.profil_id = p_etudiant and fo.compte_id = p_formateur
  order by p.vue_le desc
  limit 1;
$$;

-- Le côté de l'appelant dans une conversation : « etudiant », « formateur », « equipe » ; null s'il n'y participe pas.
create or replace function public.cote_conversation(p_conversation uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when c.etudiant_id = (select auth.uid()) then 'etudiant'
    when c.formateur_id is not null and c.formateur_id = (select auth.uid()) and public.a_role('formateur') then 'formateur'
    when c.formateur_id is null and public.equipe_contenus() then 'equipe'
  end
  from public.conversations c
  where c.id = p_conversation;
$$;

-- Le nom affiché d'un formateur : celui de sa fiche (« Dr Mireille Adjovi »), sinon celui de son profil.
create or replace function public.nom_du_formateur(p_compte uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select nullif(btrim(fo.nom), '') from public.formateurs fo where fo.compte_id = p_compte limit 1),
    public.nom_du_profil(p_compte)
  );
$$;

-- Un message vu d'un côté : « de_moi » = de mon côté (bulle à droite) ; « auteur » : le membre de l'équipe qui a
-- répondu, quand ce n'est pas l'appelant (vu par l'équipe seulement).
create or replace function public.message_json(p_message public.messages, p_cote text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p_message.id,
    'texte', p_message.texte,
    'fichier', case when p_message.fichier is null then null
      else jsonb_build_object('nom', p_message.nom_fichier, 'format', p_message.format, 'taille', p_message.taille_octets) end,
    'de_moi', p_message.de_etudiant = (p_cote = 'etudiant'),
    'auteur', case when p_cote = 'equipe' and not p_message.de_etudiant and p_message.auteur_id is distinct from (select auth.uid())
      then coalesce(public.nom_du_profil(p_message.auteur_id), 'Équipe Étudium') end,
    'cree_le', p_message.cree_le
  );
$$;

-- Une conversation vue d'un côté : l'interlocuteur, la formation, le dernier message, non lu ou non.
create or replace function public.resume_conversation(p_conversation public.conversations, p_cote text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p_conversation.id,
    'avec', case
      when p_cote = 'etudiant' and p_conversation.formateur_id is null then
        jsonb_build_object('nom', 'Équipe Étudium', 'photo', null, 'role', 'Assistance', 'equipe', true)
      when p_cote = 'etudiant' then
        jsonb_build_object(
          'nom', coalesce(public.nom_du_formateur(p_conversation.formateur_id), 'Votre formateur'),
          'photo', (select p.photo_url from public.profils p where p.id = p_conversation.formateur_id),
          'role', 'Formateur·rice', 'equipe', false)
      else
        jsonb_build_object(
          'nom', coalesce(public.nom_du_profil(p_conversation.etudiant_id), 'Étudiant'),
          'photo', (select p.photo_url from public.profils p where p.id = p_conversation.etudiant_id),
          'role', case when p_cote = 'equipe' then 'Assistance' else 'Étudiant·e' end, 'equipe', false)
    end,
    'formation', case when p_conversation.formateur_id is null then null
      else public.formation_commune(p_conversation.etudiant_id, p_conversation.formateur_id) end,
    'dernier', (
      select jsonb_build_object('texte', m.texte, 'fichier', nullif(m.nom_fichier, ''), 'de_moi', m.de_etudiant = (p_cote = 'etudiant'), 'cree_le', m.cree_le)
      from public.messages m
      where m.conversation_id = p_conversation.id
      order by m.cree_le desc, m.id desc
      limit 1
    ),
    'non_lu', exists (
      select 1 from public.messages m
      where m.conversation_id = p_conversation.id
        and m.de_etudiant = (p_cote <> 'etudiant')
        and m.cree_le > case when p_cote = 'etudiant' then p_conversation.lu_etudiant_le else p_conversation.lu_autre_le end
    )
  );
$$;

-- Les conversations visibles dans un espace (celles qui ont au moins un message).
create or replace function public.conversations_de(p_espace text)
returns setof public.conversations
language sql
stable
security definer
set search_path = ''
as $$
  select c.*
  from public.conversations c
  where (
      (p_espace = 'etudiant' and c.etudiant_id = (select auth.uid()))
      or (p_espace = 'formateur' and c.formateur_id = (select auth.uid()) and public.a_role('formateur'))
      or (p_espace = 'equipe' and c.formateur_id is null and public.equipe_contenus())
    )
    and exists (select 1 from public.messages m where m.conversation_id = c.id);
$$;

-- « de » devant un nom, élidé devant une voyelle : « d’Aïcha Kpadé », « de Koffi Mensah ». Null si le nom l'est.
create or replace function public.de_nom(p_nom text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when nullif(btrim(p_nom), '') is null then null
    when left(btrim(p_nom), 1) ~ '^[AEIOUYÀÂÄÉÈÊËÎÏÔÖÙÛÜaeiouyàâäéèêëîïôöùûü]' then 'd’' || btrim(p_nom)
    else 'de ' || btrim(p_nom)
  end;
$$;

-- ─── Lire ───────────────────────────────────────────────────────────────────────────────────────────
-- Les conversations d'un espace (« etudiant », « formateur », « equipe »), la plus récente d'abord.
create or replace function public.mes_conversations(p_espace text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(public.resume_conversation(c, case when p_espace = 'equipe' then 'equipe' when p_espace = 'formateur' then 'formateur' else 'etudiant' end)
    order by c.dernier_message_le desc), '[]'::jsonb)
  from public.conversations_de(p_espace) c;
$$;

-- Le nombre de conversations non lues d'un espace (la pastille du menu).
create or replace function public.messages_non_lus(p_espace text)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.conversations_de(p_espace) c
  where exists (
    select 1 from public.messages m
    where m.conversation_id = c.id
      and m.de_etudiant = (p_espace <> 'etudiant')
      and m.cree_le > case when p_espace = 'etudiant' then c.lu_etudiant_le else c.lu_autre_le end
  );
$$;

-- Le fil d'une conversation : ses 50 derniers messages (avant « p_avant » pour remonter), du plus ancien au plus
-- récent. L'ouvrir (sans p_avant) la marque lue de son côté, avec ses notifications. Null sans y participer.
create or replace function public.fil_conversation(p_conversation uuid, p_avant timestamptz default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cote text := public.cote_conversation(p_conversation);
  v_conversation public.conversations;
  v_messages jsonb;
  v_plus boolean;
begin
  if v_cote is null then
    return null;
  end if;
  if p_avant is null then
    if v_cote = 'etudiant' then
      update public.conversations set lu_etudiant_le = now() where id = p_conversation;
    else
      update public.conversations set lu_autre_le = now() where id = p_conversation;
    end if;
    -- Ses notifications de cette conversation sont lues (pour l'équipe : celles de tous ses membres, jamais celle de
    -- l'étudiant).
    update public.notifications n set lue_le = now()
    where n.categorie = 'messages' and n.lue_le is null
      and n.lien = case v_cote
        when 'etudiant' then '/messages?c='
        when 'formateur' then '/formateur/messages?c='
        else '/admin/messages?c='
      end || p_conversation::text
      and (n.destinataire = (select auth.uid()) or v_cote = 'equipe');
  end if;
  select * into v_conversation from public.conversations where id = p_conversation;
  select count(*) > 50 into v_plus from (
    select 1 from public.messages m
    where m.conversation_id = p_conversation and (p_avant is null or m.cree_le < p_avant)
    limit 51
  ) lot;
  select coalesce(jsonb_agg(public.message_json(m, v_cote) order by m.cree_le, m.id), '[]'::jsonb) into v_messages
  from (
    select * from public.messages m
    where m.conversation_id = p_conversation and (p_avant is null or m.cree_le < p_avant)
    order by m.cree_le desc, m.id desc
    limit 50
  ) m;
  return jsonb_build_object('conversation', public.resume_conversation(v_conversation, v_cote), 'messages', v_messages, 'plus_anciens', v_plus);
end;
$$;

-- À qui écrire (« Nouveau message ») : pour l'étudiant, les formateurs des formations qu'il suit (l'Équipe Étudium
-- est ajoutée par l'appli) ; pour le formateur, ses étudiants, filtrés par nom, 20 au plus.
create or replace function public.contacts_messagerie(p_espace text, p_recherche text default '')
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with liens as (
    select
      case when p_espace = 'formateur' then p.profil_id else fo.compte_id end as id,
      f.titre as formation,
      p.vue_le
    from public.progression_lecons p
    join public.lecons l on l.id = p.lecon_id
    join public.modules m on m.id = l.module_id
    join public.formations f on f.id = m.formation_id
    join public.formateurs fo on fo.id = f.formateur_id
    where fo.compte_id is not null
      and fo.compte_id <> p.profil_id
      and (
        (p_espace = 'etudiant' and p.profil_id = (select auth.uid()))
        or (p_espace = 'formateur' and fo.compte_id = (select auth.uid()) and public.a_role('formateur'))
      )
  ),
  personnes as (
    select distinct on (l.id)
      l.id,
      case when p_espace = 'formateur' then public.nom_du_profil(l.id) else public.nom_du_formateur(l.id) end as nom,
      l.formation
    from liens l
    order by l.id, l.vue_le desc
  ),
  choisies as (
    select pe.*, pr.photo_url
    from personnes pe
    join public.profils pr on pr.id = pe.id
    where pe.nom is not null
      and (coalesce(btrim(p_recherche), '') = '' or lower(pe.nom) like '%' || lower(btrim(p_recherche)) || '%')
    order by pe.nom
    limit 20
  )
  select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'nom', c.nom, 'photo', c.photo_url, 'formation', c.formation) order by c.nom), '[]'::jsonb)
  from choisies c;
$$;

-- Le chemin d'une pièce jointe, pour en faire un lien de téléchargement (participants seulement).
create or replace function public.fichier_message(p_message uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('chemin', m.fichier, 'nom', m.nom_fichier)
  from public.messages m
  where m.id = p_message and m.fichier is not null and public.cote_conversation(m.conversation_id) is not null;
$$;

-- ─── Écrire ─────────────────────────────────────────────────────────────────────────────────────────
-- Ouvre (ou retrouve) une conversation : sans personne, l'assistance de l'appelant ; avec un formateur dont il suit une
-- formation ; avec un étudiant qui suit une formation de l'appelant (formateur). Rend son identifiant.
create or replace function public.ouvrir_conversation(p_avec uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_id uuid;
begin
  if v_uid is null or public.compte_suspendu() then
    raise exception 'Vous ne pouvez pas écrire à cette personne.' using errcode = '42501';
  end if;
  if p_avec is null then
    insert into public.conversations (etudiant_id) values (v_uid)
    on conflict (etudiant_id) where formateur_id is null do nothing;
    select c.id into v_id from public.conversations c where c.etudiant_id = v_uid and c.formateur_id is null;
    return v_id;
  end if;
  if p_avec <> v_uid and public.suit_formation_de(v_uid, p_avec) then
    insert into public.conversations (etudiant_id, formateur_id) values (v_uid, p_avec)
    on conflict (etudiant_id, formateur_id) where formateur_id is not null do nothing;
    select c.id into v_id from public.conversations c where c.etudiant_id = v_uid and c.formateur_id = p_avec;
    return v_id;
  end if;
  if p_avec <> v_uid and public.a_role('formateur') and public.suit_formation_de(p_avec, v_uid) then
    insert into public.conversations (etudiant_id, formateur_id) values (p_avec, v_uid)
    on conflict (etudiant_id, formateur_id) where formateur_id is not null do nothing;
    select c.id into v_id from public.conversations c where c.etudiant_id = p_avec and c.formateur_id = v_uid;
    return v_id;
  end if;
  raise exception 'Vous ne pouvez pas écrire à cette personne.' using errcode = '42501';
end;
$$;

-- Envoie un message (texte, pièce jointe déposée dans son dossier de l'espace « messages », ou les deux) et prévient
-- l'autre côté. Rend le message.
create or replace function public.envoyer_message(p_conversation uuid, p_texte text, p_fichier text default null, p_nom text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_cote text := public.cote_conversation(p_conversation);
  v_texte text := btrim(coalesce(p_texte, ''));
  v_nom text := '';
  v_format text := '';
  v_taille bigint := 0;
  v_message public.messages;
  v_conversation public.conversations;
  v_auteur text;
  v_destinataires uuid[];
  v_titre text;
  v_lien text;
begin
  if v_uid is null or v_cote is null then
    raise exception 'Vous ne pouvez pas écrire dans cette conversation.' using errcode = '42501';
  end if;
  if public.compte_suspendu() then
    raise exception 'Votre compte est suspendu.' using errcode = '42501';
  end if;
  if char_length(v_texte) > 4000 then
    raise exception 'Votre message dépasse 4 000 caractères.';
  end if;
  if v_texte = '' and p_fichier is null then
    raise exception 'Écrivez un message ou joignez un fichier.';
  end if;
  if (select count(*) from public.messages m where m.auteur_id = v_uid and m.cree_le > now() - interval '10 minutes') >= 30 then
    raise exception 'Trop de messages en peu de temps : réessayez dans quelques minutes.';
  end if;
  if p_fichier is not null then
    select o.metadata ->> 'mimetype', (o.metadata ->> 'size')::bigint into v_format, v_taille
    from storage.objects o
    where o.bucket_id = 'messages' and o.name = p_fichier and (storage.foldername(o.name))[1] = v_uid::text;
    if not found or exists (select 1 from public.messages m where m.fichier = p_fichier) then
      raise exception 'Ce fichier n’a pas été reçu. Déposez-le à nouveau.';
    end if;
    if v_format is null or not (v_format = any (public.formats_rendu())) then
      raise exception 'Ce format n’est pas accepté.';
    end if;
    if coalesce(v_taille, 0) > 10485760 then
      raise exception 'Le fichier dépasse 10 Mo.';
    end if;
    v_nom := coalesce(nullif(left(btrim(coalesce(p_nom, '')), 200), ''), 'fichier');
  end if;

  insert into public.messages (conversation_id, auteur_id, de_etudiant, texte, fichier, nom_fichier, format, taille_octets)
  values (p_conversation, v_uid, v_cote = 'etudiant', v_texte, p_fichier, v_nom, coalesce(v_format, ''), coalesce(v_taille, 0))
  returning * into v_message;

  update public.conversations
  set dernier_message_le = v_message.cree_le,
      lu_etudiant_le = case when v_cote = 'etudiant' then v_message.cree_le else lu_etudiant_le end,
      lu_autre_le = case when v_cote <> 'etudiant' then v_message.cree_le else lu_autre_le end
  where id = p_conversation
  returning * into v_conversation;

  -- L'autre côté est prévenu : une seule notification non lue par conversation (la plus récente la remplace).
  if v_cote = 'etudiant' then
    v_auteur := coalesce(public.de_nom(public.nom_du_profil(v_uid)), 'd’un étudiant');
    if v_conversation.formateur_id is null then
      v_destinataires := public.membres_equipe();
      v_titre := 'Nouvelle demande d’assistance ' || v_auteur;
      v_lien := '/admin/messages?c=' || p_conversation::text;
    else
      v_destinataires := array[v_conversation.formateur_id];
      v_titre := 'Nouveau message ' || v_auteur;
      v_lien := '/formateur/messages?c=' || p_conversation::text;
    end if;
  else
    v_auteur := case when v_cote = 'equipe' then 'de l’Équipe Étudium' else coalesce(public.de_nom(public.nom_du_formateur(v_uid)), 'de votre formateur') end;
    v_destinataires := array[v_conversation.etudiant_id];
    v_titre := 'Nouveau message ' || v_auteur;
    v_lien := '/messages?c=' || p_conversation::text;
    -- Une réponse de l'équipe : la demande est lue pour tous ses membres.
    if v_cote = 'equipe' then
      update public.notifications n set lue_le = now()
      where n.categorie = 'messages' and n.lue_le is null and n.lien = '/admin/messages?c=' || p_conversation::text;
    end if;
  end if;
  -- (Seulement pour qui la recevra : sans notification de message, l'ancienne reste.)
  delete from public.notifications n
  using public.profils p
  where p.id = n.destinataire
    and n.destinataire = any (v_destinataires) and n.categorie = 'messages' and n.lue_le is null and n.lien = v_lien
    and (p.preferences_notifications ->> 'canal_appli') is distinct from 'false'
    and (p.preferences_notifications ->> 'messages') is distinct from 'false';
  perform public.notifier(
    v_destinataires, 'messages', v_titre,
    case when v_texte <> '' then left(v_texte, 140) else 'Pièce jointe : ' || v_nom end,
    v_lien
  );
  return public.message_json(v_message, v_cote);
end;
$$;

-- ─── La suppression d'un compte ─────────────────────────────────────────────────────────────────────
-- Ses conversations (comme étudiant ou formateur) partent avec son profil, des deux côtés, par la cascade : dans la
-- transaction de `supprimer_mon_compte`, qui refuse un compte suspendu. Rien ne part avant : personne ne peut effacer
-- une conversation sans supprimer son compte (Q6 : un message envoyé reste tel quel).
-- Leurs fichiers sont notés dans `messages_fichiers_a_effacer` au même moment ; l'appli les efface juste après, avec
-- la session qui vaut encore (le stockage n'efface que ce qu'on peut lire : voir `message_a_effacer`). Ceux qu'il a
-- joints à l'assistance comme membre de l'équipe sont détachés et notés aussi. Sans clé étrangère vers le profil : la
-- note survit à la suppression.
create table if not exists public.messages_fichiers_a_effacer (
  chemin text primary key,
  par uuid not null
);
alter table public.messages_fichiers_a_effacer enable row level security;
revoke all on public.messages_fichiers_a_effacer from public, anon, authenticated;

-- Les fichiers de ses conversations et ceux qu'il a joints ailleurs : ceux que la suppression de son compte emportera.
-- La liste seule, sans rien changer (l'appli la lit avant de supprimer le compte).
create or replace function public.fichiers_de_mes_messages()
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(m.fichier), '{}')
  from public.messages m
  join public.conversations c on c.id = m.conversation_id
  where m.fichier is not null
    and (
      c.etudiant_id = (select auth.uid())
      or c.formateur_id = (select auth.uid())
      or (storage.foldername(m.fichier))[1] = (select auth.uid())::text
    );
$$;

-- Avant que le profil parte : noter ses fichiers, détacher ceux qu'il a joints à l'assistance.
create or replace function public.oublier_messages_du_compte()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_chemins text[];
begin
  select coalesce(array_agg(m.fichier), '{}') into v_chemins
  from public.messages m
  join public.conversations c on c.id = m.conversation_id
  where m.fichier is not null
    and (c.etudiant_id = old.id or c.formateur_id = old.id or (storage.foldername(m.fichier))[1] = old.id::text);
  insert into public.messages_fichiers_a_effacer (chemin, par)
  select f, old.id from unnest(v_chemins) f
  on conflict (chemin) do update set par = excluded.par;
  delete from public.messages where fichier = any (v_chemins) and texte = '';
  update public.messages set fichier = null, nom_fichier = '', format = '', taille_octets = 0 where fichier = any (v_chemins);
  return old;
end;
$$;

drop trigger if exists profils_oublier_messages on public.profils;
create trigger profils_oublier_messages
  before delete on public.profils
  for each row execute function public.oublier_messages_du_compte();

-- Une conversation qui part emporte ses notifications (leur texte reprend celui des messages).
create or replace function public.oublier_notifications_conversation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.notifications
  where categorie = 'messages'
    and lien in ('/messages?c=' || old.id::text, '/formateur/messages?c=' || old.id::text, '/admin/messages?c=' || old.id::text);
  return old;
end;
$$;

drop trigger if exists conversations_oublier_notifications on public.conversations;
create trigger conversations_oublier_notifications
  after delete on public.conversations
  for each row execute function public.oublier_notifications_conversation();

-- ─── L'espace des pièces jointes ────────────────────────────────────────────────────────────────────
-- Un fichier joint à une conversation dont on est participant.
create or replace function public.message_lisible(p_nom text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.messages m where m.fichier = p_nom and public.cote_conversation(m.conversation_id) is not null);
$$;

-- Un fichier joint à un message : il reste tel quel, son auteur ne l'efface ni ne le remplace (Q6).
create or replace function public.message_attache(p_nom text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.messages m where m.fichier = p_nom);
$$;

-- Un fichier noté quand l'appelant a supprimé son compte, et que plus aucun message ne joint.
create or replace function public.message_a_effacer(p_nom text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.messages_fichiers_a_effacer a where a.chemin = p_nom and a.par = (select auth.uid()))
     and not public.message_attache(p_nom);
$$;

-- Privé, 10 Mo, les formats des rendus. Chacun dépose dans son dossier (« <compte>/… ») et y efface ce qu'il n'a pas
-- envoyé ; on lit le sien, ou un fichier joint à une conversation dont on est participant. Qui vient de supprimer son
-- compte lit et efface aussi les fichiers de leurs conversations (le stockage n'efface que ce qu'on peut lire).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('messages', 'messages', false, 10485760, public.formats_rendu())
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "messages : déposer dans son dossier" on storage.objects;
create policy "messages : déposer dans son dossier" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'messages'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and not (select public.compte_suspendu())
  );

drop policy if exists "messages : lire" on storage.objects;
create policy "messages : lire" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'messages'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or (select public.message_lisible(objects.name))
      or (select public.message_a_effacer(objects.name))
    )
  );

drop policy if exists "messages : supprimer" on storage.objects;
create policy "messages : supprimer" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'messages'
    and (
      ((storage.foldername(name))[1] = (select auth.uid())::text and not (select public.message_attache(objects.name)))
      or (select public.message_a_effacer(objects.name))
    )
  );

-- ─── Droits ─────────────────────────────────────────────────────────────────────────────────────────
revoke execute on function public.suit_formation_de(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.formation_commune(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.cote_conversation(uuid) from public, anon, authenticated;
revoke execute on function public.nom_du_formateur(uuid) from public, anon, authenticated;
revoke execute on function public.message_json(public.messages, text) from public, anon, authenticated;
revoke execute on function public.resume_conversation(public.conversations, text) from public, anon, authenticated;
revoke execute on function public.conversations_de(text) from public, anon, authenticated;
revoke execute on function public.message_lisible(text) from public, anon;
grant execute on function public.message_lisible(text) to authenticated;
revoke execute on function public.message_a_effacer(text) from public, anon;
grant execute on function public.message_a_effacer(text) to authenticated;
revoke execute on function public.message_attache(text) from public, anon;
grant execute on function public.message_attache(text) to authenticated;
revoke execute on function public.mes_conversations(text) from public, anon;
grant execute on function public.mes_conversations(text) to authenticated;
revoke execute on function public.messages_non_lus(text) from public, anon;
grant execute on function public.messages_non_lus(text) to authenticated;
revoke execute on function public.fil_conversation(uuid, timestamptz) from public, anon;
grant execute on function public.fil_conversation(uuid, timestamptz) to authenticated;
revoke execute on function public.contacts_messagerie(text, text) from public, anon;
grant execute on function public.contacts_messagerie(text, text) to authenticated;
revoke execute on function public.fichier_message(uuid) from public, anon;
grant execute on function public.fichier_message(uuid) to authenticated;
revoke execute on function public.ouvrir_conversation(uuid) from public, anon;
grant execute on function public.ouvrir_conversation(uuid) to authenticated;
revoke execute on function public.envoyer_message(uuid, text, text, text) from public, anon;
grant execute on function public.envoyer_message(uuid, text, text, text) to authenticated;
revoke execute on function public.fichiers_de_mes_messages() from public, anon;
grant execute on function public.fichiers_de_mes_messages() to authenticated;
revoke execute on function public.oublier_messages_du_compte() from public, anon, authenticated;
revoke execute on function public.oublier_notifications_conversation() from public, anon, authenticated;
revoke execute on function public.de_nom(text) from public, anon, authenticated;

commit;

-- ═══ 0036_formateur_sans_espace_etudiant.sql ═══
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
-- Un déclencheur par table d'étudiant : il refuse la ligne d'un compte formateur, même écrite par une fonction. Une
-- mise à jour n'est refusée que si elle vient de lui : l'équipe, un autre formateur ou la tâche planifiée mettent encore
-- à jour les lignes d'un ancien étudiant devenu formateur (rappels des sessions, correction d'un rendu, avis masqué,
-- correcteur supprimé).
create or replace function public.refuser_compte_formateur()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.profil_id is distinct from (select auth.uid()) then
    return new;
  end if;
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

-- ─── L'animateur garde les notifications de ses sessions ───────────────────────────────────────────
-- Les annonces de session partent à tous les comptes, sauf aux formateurs (notifier) : l'animateur reçoit les siennes à
-- part, en « service », vers ses Sessions live. Mêmes définitions qu'en 0024 (creer_session) et 0023
-- (traiter_sessions_live), plus cet envoi.
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
  -- L'animateur (un formateur, qui ne reçoit plus les sessions live) est prévenu dans son espace ; pas s'il l'a créée.
  perform public.notifier(
    array(select fo.compte_id from public.formateurs fo where fo.id = v_formateur and fo.compte_id is not null), 'service',
    'Session live programmée : ' || v_titre, public.majuscule(public.quand_session(p_debut)) || '.', '/formateur/sessions'
  );
  return v_id;
end;
$$;

create or replace function public.traiter_sessions_live()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nombre integer := 0;
  r record;
begin
  -- Un traitement à la fois : un appel qui en trouve un en cours repart aussitôt (la tâche planifiée repasse dans la
  -- minute), sans attendre ni rien perdre.
  if not pg_try_advisory_xact_lock(hashtext('etudium.traiter_sessions_live')) then
    return 0;
  end if;
  -- Les sessions proches sont figées le temps du traitement : un report ou une annulation en cours est d'abord validé
  -- (les envois qui suivent voient la nouvelle heure), ou attend la fin du traitement.
  perform 1 from public.sessions_live
  where statut = 'programmee' and debut > now() - interval '4 hours' and debut <= now() + interval '24 hours'
  for share;

  -- Le début du live : tous les comptes (équipe et non-inscrits compris), une fois, tant que la session est en cours
  -- (4 h au plus : la durée maximale d'une session).
  for r in
    update public.sessions_live s
    set debut_annonce_le = now()
    where s.statut = 'programmee' and s.debut_annonce_le is null
      and s.debut > now() - interval '4 hours'
      and s.debut <= now() and s.debut + make_interval(mins => s.duree_minutes) > now()
    returning s.titre, s.formateur_id
  loop
    v_nombre := v_nombre + public.notifier(
      array(select id from public.profils), 'sessions_live', 'C’est l’heure du live : ' || r.titre,
      'La session vient de commencer avec ' || public.animateur_session(r.formateur_id) || '. Rejoignez-la depuis la page Événements.',
      '/evenements', true
    );
    -- L'animateur, dans son espace (un formateur ne reçoit plus les sessions live).
    v_nombre := v_nombre + public.notifier(
      array(select fo.compte_id from public.formateurs fo where fo.id = r.formateur_id and fo.compte_id is not null), 'service',
      'C’est l’heure de votre live : ' || r.titre, 'Votre session vient de commencer. Ouvrez-la depuis Sessions live.',
      '/formateur/sessions', true
    );
  end loop;

  -- 10 min avant : les inscrits (le lien vient de s'ouvrir). Les rappels plus anciens qui n'ont pas pu partir sont clos.
  for r in
    update public.inscriptions_sessions i
    set rappel_dix_le = now(), rappel_heure_le = coalesce(i.rappel_heure_le, now()), rappel_veille_le = coalesce(i.rappel_veille_le, now())
    from public.sessions_live s
    where s.id = i.session_id and s.statut = 'programmee' and i.rappel_dix_le is null
      and s.debut > now() and s.debut <= now() + interval '10 minutes'
    returning i.profil_id, s.titre, s.debut
  loop
    v_nombre := v_nombre + public.notifier(
      array[r.profil_id], 'sessions_live', 'Session live dans 10 minutes',
      r.titre || ', à ' || public.heure_session(r.debut) || '. Le lien est ouvert : rejoignez la session depuis la page Événements.',
      '/evenements', true
    );
  end loop;

  -- 1 h avant (entre 10 min et 1 h).
  for r in
    update public.inscriptions_sessions i
    set rappel_heure_le = now(), rappel_veille_le = coalesce(i.rappel_veille_le, now())
    from public.sessions_live s
    where s.id = i.session_id and s.statut = 'programmee' and i.rappel_heure_le is null and i.rappel_dix_le is null
      and s.debut > now() + interval '10 minutes' and s.debut <= now() + interval '1 hour'
    returning i.profil_id, s.titre, s.debut
  loop
    v_nombre := v_nombre + public.notifier(
      array[r.profil_id], 'sessions_live', 'Session live dans moins d’une heure',
      r.titre || ', à ' || public.heure_session(r.debut) || '. Le lien s’ouvre 10 min avant.', '/evenements', true
    );
  end loop;

  -- La veille (entre 1 h et 24 h) : « aujourd’hui » ou « demain » selon le jour au Bénin.
  for r in
    update public.inscriptions_sessions i
    set rappel_veille_le = now()
    from public.sessions_live s
    where s.id = i.session_id and s.statut = 'programmee'
      and i.rappel_veille_le is null and i.rappel_heure_le is null and i.rappel_dix_le is null
      and s.debut > now() + interval '1 hour' and s.debut <= now() + interval '24 hours'
    returning i.profil_id, s.titre, s.debut
  loop
    v_nombre := v_nombre + public.notifier(
      array[r.profil_id], 'sessions_live',
      case
        when ((r.debut at time zone 'UTC') + interval '1 hour')::date = ((now() at time zone 'UTC') + interval '1 hour')::date
        then 'Session live aujourd’hui'
        else 'Session live demain'
      end,
      r.titre || ', à ' || public.heure_session(r.debut) || '.', '/evenements', true
    );
  end loop;

  return v_nombre;
end;
$$;

-- ─── Droits ─────────────────────────────────────────────────────────────────────────────────────────
revoke execute on function public.refuser_compte_formateur() from public, anon, authenticated;
revoke execute on function public.refuser_formateur_conversation() from public, anon, authenticated;
revoke execute on function public.notifier(uuid[], text, text, text, text, boolean) from public, anon, authenticated;

commit;

-- ═══ 0037_reponses_aux_reponses.sql ═══
-- Migration 0037 : répondre à une réponse prévient la bonne personne (liste du 31 octobre 2026, tâche 4).
-- On pouvait déjà répondre à une réponse : la réponse se range sous le même commentaire (un seul niveau d'affichage),
-- en citant son auteur (« @Awa S. »). Mais seul l'auteur du commentaire était prévenu, pas la personne à qui l'on
-- répondait. Désormais, une fois chacun : celle à qui l'on répond (« Nouvelle réponse à votre commentaire »), l'auteur
-- du commentaire si l'on répond dans sa discussion (« Nouvelle réponse dans votre discussion »), puis l'auteur de la
-- publication, ou le formateur pour une leçon. Mêmes définitions qu'en 0025 (commenter) et 0028 (commenter_lecon),
-- plus ces envois. Rejouable.

begin;

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
  v_cible public.commentaires_publications%rowtype;
  v_espace text;
begin
  if char_length(v_texte) not between 1 and 1000 then
    raise exception 'Écrivez votre réponse (1 000 caractères au plus).';
  end if;
  if p_parent is not null then
    select * into v_parent from public.commentaires_publications where id = p_parent and publication_id = p_publication;
    if not found then
      raise exception 'Ce commentaire n’existe plus.';
    end if;
    -- Celui à qui l'on répond (un commentaire ou une réponse), gardé pour le prévenir.
    v_cible := v_parent;
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
  v_espace := public.nom_espace_communaute(v.parcours_id);
  -- Prévenus, une fois chacun : celui à qui l'on répond ; l'auteur du commentaire, si l'on répond à une réponse de sa
  -- discussion ; l'auteur de la publication. L'auteur de la réponse ne l'est jamais (notifier l'écarte).
  if v_cible.id is not null then
    perform public.notifier(
      array[v_cible.auteur], 'communaute', 'Nouvelle réponse à votre commentaire',
      v_nom || ' a répondu à votre commentaire dans l’espace ' || v_espace || '.',
      '/communaute/publications/' || v.id || '#commentaire-' || v_id
    );
  end if;
  if v_cible.id is distinct from v_parent.id and v_parent.auteur is distinct from v_cible.auteur then
    perform public.notifier(
      array[v_parent.auteur], 'communaute', 'Nouvelle réponse dans votre discussion',
      v_nom || ' a répondu dans la discussion de votre commentaire, dans l’espace ' || v_espace || '.',
      '/communaute/publications/' || v.id || '#commentaire-' || v_id
    );
  end if;
  perform public.notifier(
    array(select v.auteur where v.auteur is distinct from v_parent.auteur and v.auteur is distinct from v_cible.auteur), 'communaute', 'Nouvelle réponse',
    v_nom || ' a répondu à votre publication dans l’espace ' || v_espace || '.',
    '/communaute/publications/' || v.id || '#commentaire-' || v_id
  );
  return v_id;
end;
$$;

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
  v_cible public.commentaires_lecons%rowtype;
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
    -- Celui à qui l'on répond (un commentaire ou une réponse), gardé pour le prévenir.
    v_cible := v_parent;
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
  -- Prévenus, une fois chacun : celui à qui l'on répond ; l'auteur du commentaire, si l'on répond à une réponse de sa
  -- discussion ; puis le formateur.
  if v_cible.id is not null and v_cible.auteur <> v_moi then
    perform public.notifier(
      array[v_cible.auteur], 'communaute', 'Nouvelle réponse à votre commentaire',
      v_nom || ' a répondu à votre commentaire sur « ' || v.titre || ' ».', v_lien
    );
  end if;
  if v_cible.id is distinct from v_parent.id and v_parent.auteur <> v_moi and v_parent.auteur is distinct from v_cible.auteur then
    perform public.notifier(
      array[v_parent.auteur], 'communaute', 'Nouvelle réponse dans votre discussion',
      v_nom || ' a répondu dans la discussion de votre commentaire sur « ' || v.titre || ' ».', v_lien
    );
  end if;
  if v_formation.compte_id is not null and v_formation.compte_id <> v_moi and v_formation.compte_id is distinct from v_parent.auteur
    and v_formation.compte_id is distinct from v_cible.auteur then
    perform public.notifier(
      array[v_formation.compte_id], 'communaute', 'Nouveau commentaire sur votre leçon',
      v_nom || ' a commenté « ' || v.titre || ' ».', v_lien
    );
  end if;
  return public.carte_commentaire_lecon(v_nouveau);
end;
$$;

commit;

-- ═══ 0038_photos_communaute.sql ═══
-- Migration 0038 : les photos de profil dans la communauté (liste du 31 octobre 2026, tâche 5).
-- Jusqu'ici, la base ne renvoyait que les prénoms et initiales : seule sa propre photo s'affichait (l'appli la connaît).
-- Elle renvoie maintenant le chemin de la photo (espace public « photos-profil ») de l'auteur d'une publication, des
-- derniers qui l'aiment (« aimee_par » devient une liste d'objets : initiales et photo) et de l'auteur d'un commentaire,
-- dans la communauté comme dans les discussions d'une leçon. Mêmes définitions qu'en 0026 (carte_publication), 0025
-- (carte_reponse) et 0028 (carte_commentaire_lecon), plus la photo. Rejouable.

begin;

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
    'espace', jsonb_build_object('id', p.parcours_id, 'nom', public.nom_espace_communaute(p.parcours_id)),
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

create or replace function public.carte_reponse(c public.commentaires_publications)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', c.id,
    'auteur', jsonb_build_object('prenom', coalesce(pr.prenom, ''), 'nom_court', public.nom_avis(pr.prenom, pr.nom), 'photo', pr.photo_url),
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

create or replace function public.carte_commentaire_lecon(c public.commentaires_lecons)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', c.id,
    'auteur', jsonb_build_object('prenom', coalesce(pr.prenom, ''), 'nom_court', public.nom_avis(pr.prenom, pr.nom), 'photo', pr.photo_url),
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

commit;

-- ═══ 0039_annonce_masquable.sql ═══
-- Migration 0039 : l'annonce de l'Accueil masquable (liste du 31 octobre 2026, tâche 6).
-- L'équipe choisit, en l'enregistrant, si les membres peuvent masquer l'annonce. Masquée, elle ne revient pour ce membre
-- que si l'équipe la modifie (une nouvelle annonce : sa date de modification passe après le masquage). Mêmes définitions
-- qu'en 0021 (annonce_communaute, annonce_equipe, enregistrer_annonce), plus ce réglage. Rejouable.

begin;

alter table public.annonce_communaute add column if not exists masquable boolean not null default false;

-- Qui a masqué l'annonce, et quand (une ligne par compte, remplacée à chaque masquage).
create table if not exists public.annonces_masquees (
  profil_id uuid primary key references public.profils (id) on delete cascade,
  masquee_le timestamptz not null default now()
);
alter table public.annonces_masquees enable row level security;
revoke all on public.annonces_masquees from anon, authenticated;

create or replace function public.annonce_communaute()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  a public.annonce_communaute%rowtype;
begin
  perform public.exiger_compte_actif();
  select * into a from public.annonce_communaute where id;
  if not found or not public.annonce_visible(a) then
    return null;
  end if;
  -- Masquée par ce compte depuis sa dernière modification : il ne la voit plus.
  if a.masquable and exists (
    select 1 from public.annonces_masquees m where m.profil_id = (select auth.uid()) and m.masquee_le >= a.modifiee_le
  ) then
    return null;
  end if;
  return jsonb_build_object(
    'titre', a.titre, 'texte', a.texte, 'media', a.media, 'youtube_id', a.youtube_id, 'image_chemin', a.image_chemin,
    'masquable', a.masquable
  );
end;
$$;

create or replace function public.annonce_equipe()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  a public.annonce_communaute%rowtype;
begin
  perform public.exiger_equipe_moderation();
  select * into a from public.annonce_communaute where id;
  return jsonb_build_object(
    'active', a.active, 'titre', a.titre, 'texte', a.texte, 'media', a.media, 'youtube_id', a.youtube_id,
    'image_chemin', a.image_chemin, 'public', a.public, 'parcours_id', a.parcours_id, 'modifiee_le', a.modifiee_le,
    'masquable', a.masquable
  );
end;
$$;

-- La signature change (un paramètre de plus, facultatif) : l'ancienne est retirée pour éviter deux versions.
drop function if exists public.enregistrer_annonce(boolean, text, text, text, text, text, text, uuid);
create or replace function public.enregistrer_annonce(
  p_active boolean, p_titre text, p_texte text, p_media text, p_youtube_id text, p_image_chemin text, p_public text, p_parcours uuid,
  p_masquable boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_titre text := regexp_replace(coalesce(p_titre, ''), '^\s+|\s+$', '', 'g');
  v_texte text := regexp_replace(coalesce(p_texte, ''), '^\s+|\s+$', '', 'g');
  v_media text := case when p_media in ('youtube', 'image') then p_media end;
  v_public text := case when p_public = 'parcours' then 'parcours' else 'tous' end;
  v_actuelle text;
begin
  perform public.exiger_equipe_moderation();
  select image_chemin into v_actuelle from public.annonce_communaute where id;
  if char_length(v_titre) > 120 or (coalesce(p_active, false) and v_titre = '') then
    raise exception 'Écrivez le titre de l’annonce (120 caractères au plus).';
  end if;
  if char_length(v_texte) > 500 then
    raise exception 'Le texte de l’annonce dépasse 500 caractères.';
  end if;
  if v_media = 'youtube' and coalesce(p_youtube_id, '') !~ '^[A-Za-z0-9_-]{11}$' then
    raise exception 'Cette adresse YouTube n’est pas reconnue.';
  end if;
  if v_media = 'image' and (
    p_image_chemin is null
    or (
      p_image_chemin is distinct from v_actuelle
      and (
        p_image_chemin ~ '\.\.'
        or (storage.foldername(p_image_chemin))[1] is distinct from (select auth.uid())::text
        or not exists (
          select 1 from storage.objects o
          where o.bucket_id = 'communaute' and o.name = p_image_chemin
            and o.metadata ->> 'mimetype' in ('image/jpeg', 'image/png', 'image/webp')
            and o.metadata ->> 'size' ~ '^[0-9]{1,9}$'
            and (o.metadata ->> 'size')::bigint between 1 and 10485760
        )
      )
    )
  ) then
    raise exception 'Choisissez une image JPEG, PNG ou WebP de 10 Mo au plus.';
  end if;
  if v_public = 'parcours' and (p_parcours is null or not exists (select 1 from public.parcours where id = p_parcours)) then
    raise exception 'Choisissez un parcours.';
  end if;
  update public.annonce_communaute
  set active = coalesce(p_active, false), titre = v_titre, texte = v_texte, media = v_media,
      youtube_id = case when v_media = 'youtube' then p_youtube_id end,
      image_chemin = case when v_media = 'image' then p_image_chemin end,
      public = v_public, parcours_id = case when v_public = 'parcours' then p_parcours end,
      masquable = coalesce(p_masquable, false),
      modifiee_le = now()
  where id;
end;
$$;

-- Masquer l'annonce pour soi : seulement si l'équipe l'a permis, et si on la voit.
create or replace function public.masquer_annonce()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.annonce_communaute%rowtype;
begin
  perform public.exiger_compte_actif();
  select * into a from public.annonce_communaute where id;
  if not found or not public.annonce_visible(a) or not a.masquable then
    raise exception 'Cette annonce ne peut pas être masquée.';
  end if;
  insert into public.annonces_masquees (profil_id, masquee_le)
  values ((select auth.uid()), now())
  on conflict (profil_id) do update set masquee_le = excluded.masquee_le;
end;
$$;

revoke execute on function public.enregistrer_annonce(boolean, text, text, text, text, text, text, uuid, boolean) from public, anon;
grant execute on function public.enregistrer_annonce(boolean, text, text, text, text, text, text, uuid, boolean) to authenticated;
revoke execute on function public.masquer_annonce() from public, anon;
grant execute on function public.masquer_annonce() to authenticated;

commit;

-- ═══ 0040_photos_colonne_communaute.sql ═══
-- Migration 0040 : les photos de profil dans la colonne de droite de la communauté (liste du 31 octobre 2026, tâche 5).
-- La 0038 a ajouté les photos aux publications, aux J'aime et aux commentaires ; ici, aux « tendances » et aux
-- « activités récentes ». Mêmes définitions qu'en 0026 (publications_tendances, activites_recentes), plus la photo de
-- l'auteur. Rejouable.

begin;

create or replace function public.publications_tendances()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.exiger_compte_actif();
  return coalesce((
    select jsonb_agg(y.carte order by y.score desc, y.cree_le desc, y.id desc)
    from (
    select x.* from (
      select p.id, p.cree_le,
             (select count(*) from public.reactions_publications r where r.publication_id = p.id)
             + (select count(*) from public.commentaires_publications c where c.publication_id = p.id) as score,
             jsonb_build_object(
               'id', p.id,
               'extrait', left(coalesce(nullif(p.titre, ''), p.texte), 160),
               'auteur', jsonb_build_object(
                 'nom_court', public.nom_avis(pr.prenom, pr.nom),
                 'initiales', public.initiales_avis(pr.prenom, pr.nom),
                 'photo', pr.photo_url,
                 'equipe', coalesce(public.role_communaute(p.auteur) = 'equipe', false)
               )
             ) as carte
      from public.publications p
      join public.profils pr on pr.id = p.auteur
      where p.statut = 'publiee' and p.cree_le <= now() and p.cree_le > now() - interval '7 days' and public.peut_lire_espace(p.parcours_id)
    ) x
    where x.score > 0
    order by x.score desc, x.cree_le desc, x.id desc
    limit 5
    ) y
  ), '[]'::jsonb);
end;
$$;

create or replace function public.activites_recentes()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.exiger_compte_actif();
  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'type', a.type,
        'publication_id', a.publication_id,
        'auteur', jsonb_build_object('nom_court', public.nom_avis(pr.prenom, pr.nom), 'initiales', public.initiales_avis(pr.prenom, pr.nom), 'photo', pr.photo_url),
        'extrait', a.extrait,
        'cree_le', a.cree_le
      )
      order by a.cree_le desc
    )
    from (
      (
        select 'publication' as type, p.id as publication_id, p.auteur, p.cree_le, left(coalesce(nullif(p.titre, ''), p.texte), 80) as extrait
        from public.publications p
        where p.statut = 'publiee' and p.cree_le <= now() and public.peut_lire_espace(p.parcours_id)
        order by p.cree_le desc
        limit 6
      )
      union all
      (
        select 'commentaire', p.id, c.auteur, c.cree_le, left(coalesce(nullif(p.titre, ''), p.texte), 80)
        from public.commentaires_publications c
        join public.publications p on p.id = c.publication_id
        where p.statut = 'publiee' and p.cree_le <= now() and public.peut_lire_espace(p.parcours_id)
        order by c.cree_le desc
        limit 6
      )
      order by cree_le desc
      limit 6
    ) a
    join public.profils pr on pr.id = a.auteur
  ), '[]'::jsonb);
end;
$$;

commit;

-- ═══ 0041_notifications_communaute.sql ═══
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

-- ═══ 0042_nouvelles_publications.sql ═══
-- Migration 0042 : le bandeau « Nouvelles publications » (liste du 31 octobre 2026, tâche 9).
-- Le fil de la communauté vérifie de temps en temps s'il a du nouveau, sans recharger la page : la base compte les
-- publications parues dans l'espace affiché depuis la plus récente que le fil montre (`p_apres` ; nul pour un fil vide :
-- toutes), et rend les trois derniers auteurs (initiales, photo) pour le bandeau. Mêmes règles que le fil « Les plus
-- récentes » (fil_communaute, 0026) : espace ouvert au compte, publication parue. Pas les siennes, que le fil ajoute
-- lui-même, sauf une programmée qui vient de paraître (écrite plus d'une minute avant, comme en 0026 et 0041).
-- Rejouable.

begin;

create or replace function public.nouvelles_publications(p_espace text, p_apres timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_moi uuid := (select auth.uid());
  v_general boolean := p_espace = 'general';
  v_parcours uuid;
  v_vide constant jsonb := jsonb_build_object('nombre', 0, 'auteurs', '[]'::jsonb);
  v_resultat jsonb;
begin
  perform public.exiger_compte_actif();
  if not v_general and p_espace is distinct from 'tous' then
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
    where (case when v_general then p.parcours_id is null when v_parcours is not null then p.parcours_id = v_parcours else public.peut_lire_espace(p.parcours_id) end)
      and p.statut = 'publiee' and p.cree_le <= now()
      and (p_apres is null or p.cree_le > p_apres)
      and (p.auteur <> v_moi or p.cree_le > p.ecrite_le + interval '1 minute')
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

revoke execute on function public.nouvelles_publications(text, timestamptz) from public, anon;
grant execute on function public.nouvelles_publications(text, timestamptz) to authenticated;

commit;

-- ═══ 0043_nouvelles_publications_siennes.sql ═══
-- Migration 0043 : le bandeau « Nouvelles publications » compte aussi les siennes (liste du 31 octobre 2026, tâche 9).
-- La 0042 les écartait : publiée depuis le téléphone, une publication n'était donc jamais annoncée sur l'ordinateur du
-- même compte. Elles comptent désormais ; l'appareil qui publie l'a déjà en tête de son fil, et son repère (la plus
-- récente du fil) avance avec elle : rien n'y est annoncé en double. Même définition qu'en 0042, sans cette exclusion.
-- Rejouable.

begin;

create or replace function public.nouvelles_publications(p_espace text, p_apres timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_general boolean := p_espace = 'general';
  v_parcours uuid;
  v_vide constant jsonb := jsonb_build_object('nombre', 0, 'auteurs', '[]'::jsonb);
  v_resultat jsonb;
begin
  perform public.exiger_compte_actif();
  if not v_general and p_espace is distinct from 'tous' then
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
    where (case when v_general then p.parcours_id is null when v_parcours is not null then p.parcours_id = v_parcours else public.peut_lire_espace(p.parcours_id) end)
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

revoke execute on function public.nouvelles_publications(text, timestamptz) from public, anon;
grant execute on function public.nouvelles_publications(text, timestamptz) to authenticated;

commit;

-- ═══ 0044_temps_reel.sql ═══
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

-- ═══ 0045_sessions_fuseaux.sql ═══
-- Migration 0045 : les heures des lives et leur fuseau (liste du 31 octobre 2026, tâche 10).
-- L'appli affiche désormais les heures des sessions à l'heure de l'appareil de chacun, avec son décalage (« 14 h 00 (GMT) »
-- au Togo). Les notifications, elles, sont écrites une fois par la base, à l'heure du Bénin : elles le disent, « (GMT+1) ».
-- Et « Rejoindre » n'ouvrant le lien qu'à l'heure du début, les rappels ne disent plus que le lien est ouvert 10 min
-- avant. Mêmes définitions qu'en 0018 (quand_session, heure_session) et 0036 (traiter_sessions_live), avec ces textes.
-- Rejouable.

begin;

-- « samedi 24 octobre à 15 h 00 (GMT+1) ».
create or replace function public.quand_session(p_debut timestamptz)
returns text
language sql
immutable
set search_path = ''
as $$
  with b as (select (p_debut at time zone 'UTC') + interval '1 hour' as t)
  select (array['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'])[extract(dow from t)::int + 1]
    || ' ' || extract(day from t)::int
    || ' ' || (array['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'])[extract(month from t)::int]
    || ' à ' || extract(hour from t)::int || ' h ' || to_char(t, 'MI') || ' (GMT+1)'
  from b;
$$;

-- « 15 h 00 (GMT+1) ».
create or replace function public.heure_session(p_debut timestamptz)
returns text
language sql
immutable
set search_path = ''
as $$
  with b as (select (p_debut at time zone 'UTC') + interval '1 hour' as t)
  select extract(hour from t)::int || ' h ' || to_char(t, 'MI') || ' (GMT+1)' from b;
$$;

create or replace function public.traiter_sessions_live()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nombre integer := 0;
  r record;
begin
  -- Un traitement à la fois : un appel qui en trouve un en cours repart aussitôt (la tâche planifiée repasse dans la
  -- minute), sans attendre ni rien perdre.
  if not pg_try_advisory_xact_lock(hashtext('etudium.traiter_sessions_live')) then
    return 0;
  end if;
  -- Les sessions proches sont figées le temps du traitement : un report ou une annulation en cours est d'abord validé
  -- (les envois qui suivent voient la nouvelle heure), ou attend la fin du traitement.
  perform 1 from public.sessions_live
  where statut = 'programmee' and debut > now() - interval '4 hours' and debut <= now() + interval '24 hours'
  for share;

  -- Le début du live : tous les comptes (équipe et non-inscrits compris), une fois, tant que la session est en cours
  -- (4 h au plus : la durée maximale d'une session).
  for r in
    update public.sessions_live s
    set debut_annonce_le = now()
    where s.statut = 'programmee' and s.debut_annonce_le is null
      and s.debut > now() - interval '4 hours'
      and s.debut <= now() and s.debut + make_interval(mins => s.duree_minutes) > now()
    returning s.titre, s.formateur_id
  loop
    v_nombre := v_nombre + public.notifier(
      array(select id from public.profils), 'sessions_live', 'C’est l’heure du live : ' || r.titre,
      'La session vient de commencer avec ' || public.animateur_session(r.formateur_id) || '. Rejoignez-la depuis la page Événements.',
      '/evenements', true
    );
    -- L'animateur, dans son espace (un formateur ne reçoit plus les sessions live).
    v_nombre := v_nombre + public.notifier(
      array(select fo.compte_id from public.formateurs fo where fo.id = r.formateur_id and fo.compte_id is not null), 'service',
      'C’est l’heure de votre live : ' || r.titre, 'Votre session vient de commencer. Ouvrez-la depuis Sessions live.',
      '/formateur/sessions', true
    );
  end loop;

  -- 10 min avant : les inscrits (le lien vient de s'ouvrir). Les rappels plus anciens qui n'ont pas pu partir sont clos.
  for r in
    update public.inscriptions_sessions i
    set rappel_dix_le = now(), rappel_heure_le = coalesce(i.rappel_heure_le, now()), rappel_veille_le = coalesce(i.rappel_veille_le, now())
    from public.sessions_live s
    where s.id = i.session_id and s.statut = 'programmee' and i.rappel_dix_le is null
      and s.debut > now() and s.debut <= now() + interval '10 minutes'
    returning i.profil_id, s.titre, s.debut
  loop
    v_nombre := v_nombre + public.notifier(
      array[r.profil_id], 'sessions_live', 'Session live dans 10 minutes',
      r.titre || ', à ' || public.heure_session(r.debut) || '. Rejoignez-la depuis la page Événements, à l’heure du début.',
      '/evenements', true
    );
  end loop;

  -- 1 h avant (entre 10 min et 1 h).
  for r in
    update public.inscriptions_sessions i
    set rappel_heure_le = now(), rappel_veille_le = coalesce(i.rappel_veille_le, now())
    from public.sessions_live s
    where s.id = i.session_id and s.statut = 'programmee' and i.rappel_heure_le is null and i.rappel_dix_le is null
      and s.debut > now() + interval '10 minutes' and s.debut <= now() + interval '1 hour'
    returning i.profil_id, s.titre, s.debut
  loop
    v_nombre := v_nombre + public.notifier(
      array[r.profil_id], 'sessions_live', 'Session live dans moins d’une heure',
      r.titre || ', à ' || public.heure_session(r.debut) || '. « Rejoindre » s’ouvre à l’heure du début.', '/evenements', true
    );
  end loop;

  -- La veille (entre 1 h et 24 h) : « aujourd’hui » ou « demain » selon le jour au Bénin.
  for r in
    update public.inscriptions_sessions i
    set rappel_veille_le = now()
    from public.sessions_live s
    where s.id = i.session_id and s.statut = 'programmee'
      and i.rappel_veille_le is null and i.rappel_heure_le is null and i.rappel_dix_le is null
      and s.debut > now() + interval '1 hour' and s.debut <= now() + interval '24 hours'
    returning i.profil_id, s.titre, s.debut
  loop
    v_nombre := v_nombre + public.notifier(
      array[r.profil_id], 'sessions_live',
      case
        when ((r.debut at time zone 'UTC') + interval '1 hour')::date = ((now() at time zone 'UTC') + interval '1 hour')::date
        then 'Session live aujourd’hui'
        else 'Session live demain'
      end,
      r.titre || ', à ' || public.heure_session(r.debut) || '.', '/evenements', true
    );
  end loop;

  return v_nombre;
end;
$$;

commit;

-- ═══ 0046_replays.sql ═══
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

-- ═══ 0047_sans_achat_seul.sql ═══
-- Migration 0047 : plus de formation achetée seule (restructuration validée le 20 octobre 2026, §5.2 ; liste du 31
-- octobre 2026, tâche 13). Les trois abonnements (Basique, Standard, Premium) ouvrent toutes les formations : le réglage
-- « Disponible seule » et le prix d'une formation disparaissent, avec leurs colonnes. Même définition qu'en 0014
-- (formations_formateur), sans ces deux réglages. Rejouable.

begin;

-- Les réglages de l'équipe que le formateur ne touche pas, sans l'achat seul ni le prix.
create or replace function public.formations_formateur()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_fiche uuid;
begin
  -- Publiée (par l'équipe) : l'envoi en relecture et la remarque n'ont plus lieu d'être.
  if tg_op = 'UPDATE' and new.statut = 'publiee' and old.statut is distinct from 'publiee' then
    new.envoyee_le := null;
    new.renvoyee_le := null;
    new.remarque_relecture := null;
  end if;

  if current_user <> 'authenticated' or public.equipe_contenus() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    v_fiche := public.ma_fiche_formateur();
    if v_fiche is null then
      raise exception 'Votre compte n’est pas encore relié à une fiche formateur. Contactez l’équipe Étudium.' using errcode = '42501';
    end if;
    -- Un brouillon, à sa fiche, avec les réglages par défaut : le reste est décidé par l'équipe.
    new.formateur_id := v_fiche;
    new.statut := 'brouillon';
    new.gratuite := false;
    new.badge := null;
    new.seuil_video := 90;
    new.envoyee_le := null;
    new.renvoyee_le := null;
    new.remarque_relecture := null;
    new.modifiee_par_formateur_le := null;
    new.note_moyenne := null;
    new.nb_avis := 0;
    return new;
  end if;

  if new.statut is distinct from old.statut
     or new.formateur_id is distinct from old.formateur_id
     or new.gratuite is distinct from old.gratuite
     or new.badge is distinct from old.badge
     or new.seuil_video is distinct from old.seuil_video
     or new.envoyee_le is distinct from old.envoyee_le
     or new.renvoyee_le is distinct from old.renvoyee_le
     or new.remarque_relecture is distinct from old.remarque_relecture
     or new.modifiee_par_formateur_le is distinct from old.modifiee_par_formateur_le
     or new.note_moyenne is distinct from old.note_moyenne
     or new.nb_avis is distinct from old.nb_avis then
    raise exception 'Ce réglage revient à l’équipe Étudium.';
  end if;

  -- En ligne : l'équipe voit « Modifiée par le formateur le … ».
  if old.publiee_le is not null then
    new.modifiee_par_formateur_le := now();
  end if;
  return new;
end;
$$;

alter table public.formations drop constraint if exists formations_prix_positif;
alter table public.formations drop column if exists achat_separe;
alter table public.formations drop column if exists prix_fcfa;

commit;

-- ═══ 0048_monetisation.sql ═══
-- Migration 0048 : le lien compétence → monétisation (restructuration validée le 20 octobre 2026, §5.3 ; liste du 31
-- octobre 2026, tâche 14). Une formation du parcours Business indique la ou les formations de Compétences digitales
-- qu'elle apprend à vendre (« Trouver des clients en design graphique » → « Maîtriser Canva ») ; sans lien, elle vaut
-- « pour toutes les compétences ». Le formateur de la formation Business ou l'équipe le règle, au même endroit que ses
-- parcours ; tout le monde le lit, pour des formations qu'il peut voir. Rejouable.

begin;

create table if not exists public.formations_monetisation (
  business_id uuid not null references public.formations (id) on delete cascade,
  competence_id uuid not null references public.formations (id) on delete cascade,
  cree_le timestamptz not null default now(),
  primary key (business_id, competence_id),
  constraint formations_monetisation_distinctes check (business_id <> competence_id)
);
create index if not exists formations_monetisation_competence_idx on public.formations_monetisation (competence_id);
alter table public.formations_monetisation enable row level security;

-- ─── Ce qui se lie : une formation Business vers une compétence publiée de Compétences digitales ────
create or replace function public.verifier_monetisation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.formations_parcours fp
    join public.parcours pa on pa.id = fp.parcours_id
    where fp.formation_id = new.business_id and pa.couleur = 'business'
  ) then
    raise exception 'Seule une formation du parcours Business se lie à une compétence.';
  end if;
  if not exists (
    select 1 from public.formations f
    join public.formations_parcours fp on fp.formation_id = f.id
    join public.parcours pa on pa.id = fp.parcours_id
    where f.id = new.competence_id and f.statut = 'publiee' and pa.couleur = 'digital'
  ) then
    raise exception 'Choisissez une formation publiée du parcours Compétences digitales.';
  end if;
  return new;
end;
$$;

drop trigger if exists formations_monetisation_verifier on public.formations_monetisation;
create trigger formations_monetisation_verifier
  before insert or update on public.formations_monetisation
  for each row execute function public.verifier_monetisation();

-- ─── Qui lit, qui écrit ─────────────────────────────────────────────────────────────────────────────
-- Lire : les deux formations doivent être visibles du lecteur (publiées, ou l'équipe, ou le formateur de la sienne).
drop policy if exists "lien visible avec ses formations" on public.formations_monetisation;
create policy "lien visible avec ses formations" on public.formations_monetisation
  for select to anon, authenticated
  using (
    exists (select 1 from public.formations f where f.id = formations_monetisation.business_id)
    and exists (select 1 from public.formations f where f.id = formations_monetisation.competence_id)
  );

-- Écrire : l'équipe, ou le formateur de la formation Business.
drop policy if exists "l'équipe ou le formateur lie" on public.formations_monetisation;
create policy "l'équipe ou le formateur lie" on public.formations_monetisation
  for insert to authenticated
  with check ((select public.equipe_contenus()) or public.formateur_de(business_id));

drop policy if exists "l'équipe ou le formateur délie" on public.formations_monetisation;
create policy "l'équipe ou le formateur délie" on public.formations_monetisation
  for delete to authenticated
  using ((select public.equipe_contenus()) or public.formateur_de(business_id));

revoke execute on function public.verifier_monetisation() from public, anon, authenticated;

commit;

-- ═══ 0049_abonnements_paiements.sql ═══
-- Migration 0049 : les abonnements et leur paiement (lot 2, spec du 1er novembre 2026). Trois formules (Basique 3 mois,
-- Standard 6 mois, Premium 1 an) dont l'équipe fixe le prix ; des codes promo ; les paiements Mobile Money passés par
-- Payiz ; les abonnements qu'ils ouvrent, dont les durées s'ajoutent. L'étudiant prépare un paiement ; seul le serveur,
-- muni de son jeton (tiré de la clé Payiz par l'appli ; la base n'en garde que l'empreinte SHA-256, posée quand l'équipe
-- active les paiements), note un essai, le confirme ou l'échec. Personne n'écrit directement dans ces tables. Rejouable.

begin;

-- ─── Les formules ───────────────────────────────────────────────────────────────────────────────────
create table if not exists public.formules (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code in ('basique', 'standard', 'premium')),
  nom text not null,
  duree_mois integer not null check (duree_mois in (3, 6, 12)),
  -- Vide tant que l'équipe ne l'a pas fixé (« Prix annoncés au lancement ») ; 1 000 FCFA au moins (minimum de Payiz).
  prix_fcfa integer check (prix_fcfa is null or prix_fcfa >= 1000),
  recommandee boolean not null default false,
  active boolean not null default true,
  ordre integer not null default 0
);
alter table public.formules enable row level security;

insert into public.formules (code, nom, duree_mois, recommandee, ordre) values
  ('basique', 'Basique', 3, false, 1),
  ('standard', 'Standard', 6, true, 2),
  ('premium', 'Premium', 12, false, 3)
on conflict (code) do nothing;

drop policy if exists "formules lisibles par tous" on public.formules;
create policy "formules lisibles par tous" on public.formules for select to anon, authenticated using (true);

-- ─── Les codes promo ────────────────────────────────────────────────────────────────────────────────
create table if not exists public.codes_promo (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9_-]{3,30}$'),
  type text not null check (type in ('pourcentage', 'montant')),
  valeur integer not null,
  debut timestamptz,
  fin timestamptz,
  -- Nombre total d'utilisations (paiements réussis) ; vide : sans limite.
  limite integer check (limite is null or limite > 0),
  actif boolean not null default true,
  cree_par uuid references public.profils (id) on delete set null,
  cree_le timestamptz not null default now(),
  constraint codes_promo_valeur check (valeur > 0 and (type <> 'pourcentage' or valeur <= 100))
);
alter table public.codes_promo enable row level security;

drop policy if exists "codes promo lus par l'équipe" on public.codes_promo;
create policy "codes promo lus par l'équipe" on public.codes_promo for select to authenticated using ((select public.equipe_contenus()));

-- ─── Les paiements ──────────────────────────────────────────────────────────────────────────────────
create table if not exists public.paiements (
  -- L'identifiant sert de référence (et de clé d'idempotence) chez Payiz.
  id uuid primary key default gen_random_uuid(),
  profil_id uuid references public.profils (id) on delete set null,
  formule_id uuid not null references public.formules (id),
  code_promo_id uuid references public.codes_promo (id) on delete set null,
  prix_initial integer not null,
  remise integer not null default 0,
  montant integer not null check (montant = 0 or montant >= 1000),
  statut text not null default 'en_attente' check (statut in ('en_attente', 'reussi', 'echoue', 'expire', 'annule')),
  payiz_id text unique,
  operateur text check (operateur in ('mtn', 'moov')),
  -- « +229 01 •• •• •• 00 » : le numéro complet n'est jamais enregistré.
  telephone_masque text,
  motif_echec text,
  essai_le timestamptz,
  cree_le timestamptz not null default now(),
  confirme_le timestamptz,
  -- « ET-R-2026-000123 », attribué à la réussite.
  numero_recu text unique
);
create index if not exists paiements_profil_idx on public.paiements (profil_id, cree_le desc);
create index if not exists paiements_code_idx on public.paiements (code_promo_id);
alter table public.paiements enable row level security;

drop policy if exists "chacun lit ses paiements, l'équipe tous" on public.paiements;
create policy "chacun lit ses paiements, l'équipe tous" on public.paiements for select to authenticated
  using (profil_id = (select auth.uid()) or (select public.equipe_contenus()));

create sequence if not exists public.numeros_recus;

-- ─── Les abonnements ────────────────────────────────────────────────────────────────────────────────
create table if not exists public.abonnements (
  id uuid primary key default gen_random_uuid(),
  profil_id uuid not null references public.profils (id) on delete cascade,
  formule_id uuid not null references public.formules (id),
  paiement_id uuid not null unique references public.paiements (id),
  debut timestamptz not null,
  fin timestamptz not null,
  -- Annulé par l'équipe (remboursement exceptionnel fait depuis Payiz) : il ne compte plus.
  annule_le timestamptz,
  motif_annulation text,
  -- Rappels d'expiration déjà envoyés (0052).
  rappel_7j_le timestamptz,
  rappel_veille_le timestamptz,
  rappel_fin_le timestamptz,
  cree_le timestamptz not null default now(),
  constraint abonnements_periode check (fin > debut)
);
create index if not exists abonnements_profil_idx on public.abonnements (profil_id, fin);
alter table public.abonnements enable row level security;

drop policy if exists "chacun lit ses abonnements, l'équipe tous" on public.abonnements;
create policy "chacun lit ses abonnements, l'équipe tous" on public.abonnements for select to authenticated
  using (profil_id = (select auth.uid()) or (select public.equipe_contenus()));

-- ─── Les notifications de Payiz déjà traitées, et le réglage des paiements ──────────────────────────
create table if not exists public.evenements_payiz (
  id text primary key,
  recu_le timestamptz not null default now()
);
alter table public.evenements_payiz enable row level security;

create table if not exists public.reglages_paiement (
  id boolean primary key default true check (id),
  -- « Payer » est proposé aux étudiants. Désactiver ne touche pas l'empreinte : un paiement déjà envoyé se confirme encore.
  ouverts boolean not null default false,
  -- Empreinte SHA-256 (hexadécimale) du jeton du serveur (tiré de la clé Payiz), posée à l'activation ; elle autorise
  -- le serveur à confirmer.
  empreinte text,
  active_le timestamptz,
  active_par uuid references public.profils (id) on delete set null
);
alter table public.reglages_paiement add column if not exists ouverts boolean not null default false;
alter table public.reglages_paiement enable row level security;
insert into public.reglages_paiement (id) values (true) on conflict (id) do nothing;

-- Personne n'écrit directement : seules les fonctions ci-dessous le font.
revoke insert, update, delete on public.formules, public.codes_promo, public.paiements, public.abonnements from anon, authenticated;
revoke all on public.evenements_payiz, public.reglages_paiement from anon, authenticated;
revoke all on sequence public.numeros_recus from anon, authenticated;

-- ─── Aides internes ─────────────────────────────────────────────────────────────────────────────────
-- L'argent (prix, codes, activation, annulation) : administrateurs seulement.
create or replace function public.equipe_paiements()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.roles where profil_id = (select auth.uid()) and role in ('admin', 'super_admin'));
$$;

create or replace function public.jeton_paiement_valide(p_jeton text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    coalesce(p_jeton, '') <> ''
    and encode(sha256(convert_to(p_jeton, 'UTF8')), 'hex') = (select r.empreinte from public.reglages_paiement r where r.id),
    false
  );
$$;

create or replace function public.exiger_jeton_paiement(p_jeton text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.jeton_paiement_valide(p_jeton) then
    raise exception 'Jeton de paiement non reconnu.' using errcode = '42501';
  end if;
end;
$$;

-- Un abonnement en cours : aujourd'hui entre son début et sa fin, et pas annulé.
create or replace function public.abonne(p_profil uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.abonnements a
    where a.profil_id = p_profil and a.annule_le is null and a.debut <= now() and now() < a.fin
  );
$$;

-- La fin réelle de l'accès : la dernière fin à venir (les abonnements pris en cours s'enchaînent).
create or replace function public.fin_abonnement(p_profil uuid)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select max(a.fin) from public.abonnements a where a.profil_id = p_profil and a.annule_le is null and a.fin > now();
$$;

-- Début + N mois, compté à l'heure du Bénin et ramené au dernier jour du mois (31 août + 6 mois = 28 février).
create or replace function public.fin_periode(p_debut timestamptz, p_mois integer)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select ((p_debut at time zone 'Africa/Porto-Novo') + make_interval(months => p_mois)) at time zone 'Africa/Porto-Novo';
$$;

-- La règle des codes promo, partagée par « Appliquer » et la préparation du paiement.
create or replace function public.remise_code(p_code text, p_formule uuid, p_profil uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_formule public.formules%rowtype;
  v_code public.codes_promo%rowtype;
  v_prix integer;
  v_remise integer;
  v_montant integer;
begin
  select * into v_formule from public.formules where id = p_formule;
  if not found or not v_formule.active or v_formule.prix_fcfa is null then
    return jsonb_build_object('ok', false, 'message', 'Cet abonnement n’est pas encore proposé.');
  end if;
  v_prix := v_formule.prix_fcfa;
  if coalesce(trim(p_code), '') = '' then
    return jsonb_build_object('ok', true, 'code_id', null, 'prix_initial', v_prix, 'remise', 0, 'montant', v_prix);
  end if;

  select * into v_code from public.codes_promo where code = upper(trim(p_code)) and actif;
  if not found then
    return jsonb_build_object('ok', false, 'message', 'Ce code n’existe pas.');
  end if;
  if v_code.debut is not null and now() < v_code.debut then
    return jsonb_build_object('ok', false, 'message', 'Ce code n’est pas encore valable.');
  end if;
  if v_code.fin is not null and now() >= v_code.fin then
    return jsonb_build_object('ok', false, 'message', 'Ce code a expiré.');
  end if;
  -- Seuls les paiements réussis consomment le code.
  if v_code.limite is not null
     and (select count(*) from public.paiements p where p.code_promo_id = v_code.id and p.statut = 'reussi') >= v_code.limite then
    return jsonb_build_object('ok', false, 'message', 'Ce code a atteint sa limite.');
  end if;
  if exists (select 1 from public.paiements p where p.code_promo_id = v_code.id and p.statut = 'reussi' and p.profil_id = p_profil) then
    return jsonb_build_object('ok', false, 'message', 'Vous avez déjà utilisé ce code.');
  end if;

  v_remise := case when v_code.type = 'pourcentage' then floor(v_prix * v_code.valeur / 100.0)::integer else least(v_code.valeur, v_prix) end;
  v_montant := v_prix - v_remise;
  -- Payiz n'accepte pas moins de 1 000 FCFA ; 0 (100 %) est un abonnement offert.
  if v_montant between 1 and 999 then
    return jsonb_build_object('ok', false, 'message', 'Ce code ne s’applique pas à cet abonnement.');
  end if;
  return jsonb_build_object('ok', true, 'code_id', v_code.id, 'prix_initial', v_prix, 'remise', v_remise, 'montant', v_montant);
end;
$$;

create or replace function public.carte_paiement(p public.paiements)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p.id,
    'statut', p.statut,
    'formule', (select jsonb_build_object('code', f.code, 'nom', f.nom, 'duree_mois', f.duree_mois) from public.formules f where f.id = p.formule_id),
    'prix_initial', p.prix_initial,
    'remise', p.remise,
    'montant', p.montant,
    'code', (select c.code from public.codes_promo c where c.id = p.code_promo_id),
    'operateur', p.operateur,
    'telephone_masque', p.telephone_masque,
    'motif_echec', p.motif_echec,
    'numero_recu', p.numero_recu,
    'payiz_id', p.payiz_id,
    'cree_le', p.cree_le,
    'essai_le', p.essai_le,
    'confirme_le', p.confirme_le,
    'abonnement', (select jsonb_build_object('debut', a.debut, 'fin', a.fin) from public.abonnements a where a.paiement_id = p.id)
  );
$$;

-- La réussite d'un paiement : une seule fois (verrou de la ligne), un numéro de reçu, et l'abonnement, qui commence à la
-- fin de celui en cours s'il y en a un.
create or replace function public.activer_paiement(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.paiements%rowtype;
  v_duree integer;
  v_debut timestamptz;
begin
  select * into v from public.paiements where id = p_id for update;
  if not found or v.statut = 'reussi' then
    return;
  end if;
  update public.paiements
  set statut = 'reussi',
      motif_echec = null,
      confirme_le = now(),
      numero_recu = 'ET-R-' || to_char(now() at time zone 'Africa/Porto-Novo', 'YYYY') || '-' || lpad(nextval('public.numeros_recus')::text, 6, '0')
  where id = p_id;
  if v.profil_id is null then
    return;
  end if;
  select duree_mois into v_duree from public.formules where id = v.formule_id;
  v_debut := greatest(now(), coalesce(public.fin_abonnement(v.profil_id), now()));
  insert into public.abonnements (profil_id, formule_id, paiement_id, debut, fin)
  values (v.profil_id, v.formule_id, v.id, v_debut, public.fin_periode(v_debut, v_duree))
  on conflict (paiement_id) do nothing;
end;
$$;

-- ─── Le réglage « Paiements activés » ───────────────────────────────────────────────────────────────
create or replace function public.paiements_ouverts()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.reglages_paiement where id and ouverts and empreinte is not null);
$$;

create or replace function public.activer_paiements(p_jeton text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.exiger_compte_actif();
  if not public.equipe_paiements() then
    raise exception 'Réservé aux administrateurs.' using errcode = '42501';
  end if;
  if char_length(coalesce(p_jeton, '')) < 32 then
    raise exception 'Le jeton de paiement doit compter au moins 32 caractères.';
  end if;
  update public.reglages_paiement
  set ouverts = true, empreinte = encode(sha256(convert_to(p_jeton, 'UTF8')), 'hex'), active_le = now(), active_par = (select auth.uid())
  where id;
end;
$$;

create or replace function public.desactiver_paiements()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.exiger_compte_actif();
  if not public.equipe_paiements() then
    raise exception 'Réservé aux administrateurs.' using errcode = '42501';
  end if;
  -- L'empreinte reste : les paiements déjà envoyés à Payiz se confirment encore.
  update public.reglages_paiement set ouverts = false where id;
end;
$$;

-- Le serveur avant d'appeler Payiz : paiements ouverts, et son jeton reconnu (sinon l'argent reçu ne pourrait pas être
-- confirmé).
create or replace function public.paiements_prets(p_jeton text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.paiements_ouverts() and public.jeton_paiement_valide(p_jeton);
$$;

-- Pour le back-office : les paiements sont-ils ouverts, et le jeton du serveur est-il celui enregistré ?
create or replace function public.etat_paiements(p_jeton text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.exiger_compte_actif();
  if not public.equipe_contenus() then
    raise exception 'Réservé à l’équipe.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'ouverts', public.paiements_ouverts(),
    'jeton_reconnu', case when coalesce(p_jeton, '') = '' then null else public.jeton_paiement_valide(p_jeton) end
  );
end;
$$;

-- ─── Ce que voit l'étudiant ─────────────────────────────────────────────────────────────────────────
create or replace function public.mon_abonnement()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_code text;
  v_nom text;
  v_fin timestamptz;
begin
  if v_uid is null then
    return jsonb_build_object('etat', 'gratuit');
  end if;
  select f.code, f.nom into v_code, v_nom
  from public.abonnements a join public.formules f on f.id = a.formule_id
  where a.profil_id = v_uid and a.annule_le is null and a.debut <= now() and now() < a.fin
  order by a.debut desc limit 1;
  if found then
    return jsonb_build_object('etat', 'actif', 'formule', jsonb_build_object('code', v_code, 'nom', v_nom), 'fin', public.fin_abonnement(v_uid));
  end if;
  select f.code, f.nom, a.fin into v_code, v_nom, v_fin
  from public.abonnements a join public.formules f on f.id = a.formule_id
  where a.profil_id = v_uid and a.annule_le is null and a.fin <= now()
  order by a.fin desc limit 1;
  if found then
    return jsonb_build_object('etat', 'expire', 'formule', jsonb_build_object('code', v_code, 'nom', v_nom), 'fin', v_fin);
  end if;
  return jsonb_build_object('etat', 'gratuit');
end;
$$;

create or replace function public.essayer_code(p_code text, p_formule uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.exiger_compte_actif();
  return public.remise_code(p_code, p_formule, (select auth.uid()));
end;
$$;

-- Le paiement à envoyer à Payiz. Un seul en cours par compte : un second « Payer » reprend celui qui attend la
-- validation sur le téléphone. À 100 %, l'abonnement est offert aussitôt, sans Payiz.
create or replace function public.preparer_paiement(p_formule uuid, p_code text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v public.paiements%rowtype;
  v_calcul jsonb;
begin
  perform public.exiger_compte_actif();
  if public.a_role('formateur') then
    raise exception 'Un compte formateur n’a pas d’abonnement.' using errcode = '42501';
  end if;
  -- Deux demandes simultanées d'un même compte passent l'une après l'autre ; un code promo est verrouillé le temps de
  -- compter ses utilisations (un code à 100 % active l'abonnement dans la même transaction).
  perform pg_advisory_xact_lock(hashtext('etudium.paiement.' || v_uid::text));
  if coalesce(trim(p_code), '') <> '' then
    perform 1 from public.codes_promo where code = upper(trim(p_code)) for update;
  end if;

  select * into v from public.paiements
  where profil_id = v_uid and statut = 'en_attente' and payiz_id is not null and essai_le > now() - interval '3 minutes'
  order by essai_le desc limit 1;
  if found then
    return public.carte_paiement(v) || jsonb_build_object('repris', true);
  end if;

  v_calcul := public.remise_code(p_code, p_formule, v_uid);
  if not (v_calcul ->> 'ok')::boolean then
    raise exception '%', v_calcul ->> 'message';
  end if;
  if (v_calcul ->> 'montant')::integer > 0 and not public.paiements_ouverts() then
    raise exception 'Les paiements ouvrent bientôt.';
  end if;

  insert into public.paiements (profil_id, formule_id, code_promo_id, prix_initial, remise, montant)
  values (v_uid, p_formule, (v_calcul ->> 'code_id')::uuid, (v_calcul ->> 'prix_initial')::integer,
          (v_calcul ->> 'remise')::integer, (v_calcul ->> 'montant')::integer)
  returning * into v;
  if v.montant = 0 then
    perform public.activer_paiement(v.id);
    select * into v from public.paiements where id = v.id;
  end if;
  return public.carte_paiement(v) || jsonb_build_object('repris', false);
end;
$$;

-- L'historique : les paiements jamais envoyés à Payiz (préparation abandonnée) n'y figurent pas.
create or replace function public.mes_paiements()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(public.carte_paiement(p) order by p.cree_le desc, p.id), '[]'::jsonb)
  from public.paiements p
  where p.profil_id = (select auth.uid()) and not (p.payiz_id is null and p.montant > 0);
$$;

create or replace function public.mon_paiement(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.carte_paiement(p) from public.paiements p where p.id = p_id and p.profil_id = (select auth.uid());
$$;

-- Le reçu d'un paiement réussi : à son compte et à l'équipe.
create or replace function public.recu(p_numero text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'numero', p.numero_recu,
    'date', p.confirme_le,
    'compte', jsonb_build_object('prenom', coalesce(pr.prenom, ''), 'nom', coalesce(pr.nom, '')),
    'formule', jsonb_build_object('nom', f.nom, 'duree_mois', f.duree_mois),
    'debut', a.debut,
    'fin', a.fin,
    'prix_initial', p.prix_initial,
    'remise', p.remise,
    'code', c.code,
    'montant', p.montant,
    'operateur', p.operateur,
    'telephone_masque', p.telephone_masque
  )
  from public.paiements p
  join public.formules f on f.id = p.formule_id
  left join public.profils pr on pr.id = p.profil_id
  left join public.abonnements a on a.paiement_id = p.id
  left join public.codes_promo c on c.id = p.code_promo_id
  where p.numero_recu = p_numero and p.statut = 'reussi'
    and (p.profil_id = (select auth.uid()) or public.equipe_contenus());
$$;

-- ─── Ce que seul le serveur fait (jeton tiré de la clé Payiz) ───────────────────────────────────────
-- Un essai lancé chez Payiz (premier envoi ou nouvel essai) : le paiement repasse en attente.
create or replace function public.noter_essai(p_paiement uuid, p_payiz text, p_operateur text, p_telephone_masque text, p_jeton text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.paiements%rowtype;
begin
  perform public.exiger_jeton_paiement(p_jeton);
  select * into v from public.paiements where id = p_paiement for update;
  if not found then
    raise exception 'Paiement inconnu.';
  end if;
  if v.statut not in ('en_attente', 'echoue') then
    raise exception 'Ce paiement n’attend plus de règlement.';
  end if;
  if v.payiz_id is not null and v.payiz_id is distinct from p_payiz then
    raise exception 'Paiement Payiz différent.';
  end if;
  update public.paiements
  set payiz_id = p_payiz,
      operateur = case when p_operateur in ('mtn', 'moov') then p_operateur else operateur end,
      telephone_masque = coalesce(nullif(p_telephone_masque, ''), telephone_masque),
      statut = 'en_attente',
      motif_echec = null,
      essai_le = now()
  where id = p_paiement
  returning * into v;
  return public.carte_paiement(v);
end;
$$;

-- Payiz dit « réussi » : le montant doit être celui enregistré. L'argent reçu l'emporte sur un état noté entre-temps
-- (expiré, annulé) ; un paiement déjà réussi est renvoyé tel quel (la relecture et la notification arrivent toutes deux).
create or replace function public.confirmer_paiement(p_paiement uuid, p_payiz text, p_montant integer, p_jeton text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.paiements%rowtype;
begin
  perform public.exiger_jeton_paiement(p_jeton);
  select * into v from public.paiements where id = p_paiement for update;
  if not found then
    raise exception 'Paiement inconnu.';
  end if;
  if v.statut <> 'reussi' then
    if v.payiz_id is not null and v.payiz_id is distinct from p_payiz then
      raise exception 'Paiement Payiz différent.';
    end if;
    if p_montant is distinct from v.montant then
      raise exception 'Montant différent du paiement enregistré.';
    end if;
    update public.paiements set payiz_id = coalesce(payiz_id, p_payiz) where id = p_paiement;
    perform public.activer_paiement(p_paiement);
  end if;
  select * into v from public.paiements where id = p_paiement;
  return public.carte_paiement(v);
end;
$$;

-- Un essai échoué (avec son motif Payiz), une demande expirée ou annulée. Sans effet sur un paiement réussi.
create or replace function public.noter_echec(p_paiement uuid, p_statut text, p_motif text, p_jeton text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.paiements%rowtype;
begin
  perform public.exiger_jeton_paiement(p_jeton);
  if p_statut is null or p_statut not in ('echoue', 'expire', 'annule') then
    raise exception 'État de paiement inconnu.';
  end if;
  select * into v from public.paiements where id = p_paiement for update;
  if not found then
    raise exception 'Paiement inconnu.';
  end if;
  if v.statut <> 'reussi' then
    update public.paiements
    set statut = p_statut,
        motif_echec = case
          when p_statut <> 'echoue' then null
          when p_motif in ('insufficient_funds', 'payer_declined', 'timeout', 'invalid_phone', 'operator_limit', 'operator_unavailable', 'declined', 'unknown') then p_motif
          else 'unknown'
        end
    where id = p_paiement
    returning * into v;
  end if;
  return public.carte_paiement(v);
end;
$$;

-- Les notifications de Payiz peuvent arriver deux fois : une notification déjà traitée est ignorée. Elle n'est notée
-- qu'une fois traitée : en cas d'échec, Payiz relance et la relance est traitée.
create or replace function public.evenement_payiz_traite(p_id text, p_jeton text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.exiger_jeton_paiement(p_jeton);
  return exists (select 1 from public.evenements_payiz where id = p_id);
end;
$$;

-- Note une notification traitée : vrai seulement la première fois.
create or replace function public.evenement_payiz(p_id text, p_jeton text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.exiger_jeton_paiement(p_jeton);
  insert into public.evenements_payiz (id) values (p_id) on conflict (id) do nothing;
  return found;
end;
$$;

-- ─── Droits ─────────────────────────────────────────────────────────────────────────────────────────
revoke execute on function public.equipe_paiements() from public, anon, authenticated;
revoke execute on function public.jeton_paiement_valide(text) from public, anon, authenticated;
revoke execute on function public.exiger_jeton_paiement(text) from public, anon, authenticated;
revoke execute on function public.abonne(uuid) from public, anon, authenticated;
revoke execute on function public.fin_abonnement(uuid) from public, anon, authenticated;
revoke execute on function public.fin_periode(timestamptz, integer) from public, anon, authenticated;
revoke execute on function public.remise_code(text, uuid, uuid) from public, anon, authenticated;
revoke execute on function public.carte_paiement(public.paiements) from public, anon, authenticated;
revoke execute on function public.activer_paiement(uuid) from public, anon, authenticated;

revoke execute on function public.paiements_ouverts() from public, anon, authenticated;
revoke execute on function public.paiements_prets(text) from public, anon, authenticated;
revoke execute on function public.activer_paiements(text) from public, anon, authenticated;
revoke execute on function public.desactiver_paiements() from public, anon, authenticated;
revoke execute on function public.etat_paiements(text) from public, anon, authenticated;
revoke execute on function public.mon_abonnement() from public, anon, authenticated;
revoke execute on function public.essayer_code(text, uuid) from public, anon, authenticated;
revoke execute on function public.preparer_paiement(uuid, text) from public, anon, authenticated;
revoke execute on function public.mes_paiements() from public, anon, authenticated;
revoke execute on function public.mon_paiement(uuid) from public, anon, authenticated;
revoke execute on function public.recu(text) from public, anon, authenticated;
revoke execute on function public.noter_essai(uuid, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.confirmer_paiement(uuid, text, integer, text) from public, anon, authenticated;
revoke execute on function public.noter_echec(uuid, text, text, text) from public, anon, authenticated;
revoke execute on function public.evenement_payiz(text, text) from public, anon, authenticated;
revoke execute on function public.evenement_payiz_traite(text, text) from public, anon, authenticated;

grant execute on function public.paiements_ouverts() to anon, authenticated;
grant execute on function public.paiements_prets(text) to anon, authenticated;
grant execute on function public.activer_paiements(text) to authenticated;
grant execute on function public.desactiver_paiements() to authenticated;
grant execute on function public.etat_paiements(text) to authenticated;
grant execute on function public.mon_abonnement() to authenticated;
grant execute on function public.essayer_code(text, uuid) to authenticated;
grant execute on function public.preparer_paiement(uuid, text) to authenticated;
grant execute on function public.mes_paiements() to authenticated;
grant execute on function public.mon_paiement(uuid) to authenticated;
grant execute on function public.recu(text) to authenticated;
-- Appelées par le serveur, avec ou sans session (notifications de Payiz) : le jeton les garde.
grant execute on function public.noter_essai(uuid, text, text, text, text) to anon, authenticated;
grant execute on function public.confirmer_paiement(uuid, text, integer, text) to anon, authenticated;
grant execute on function public.noter_echec(uuid, text, text, text) to anon, authenticated;
grant execute on function public.evenement_payiz(text, text) to anon, authenticated;
grant execute on function public.evenement_payiz_traite(text, text) to anon, authenticated;

commit;

-- ═══ 0050_acces_abonnes.sql ═══
-- Migration 0050 : ce qu'ouvre un abonnement (lot 2, spec du 1er novembre 2026, §5 et choix 1). Un abonnement actif ouvre
-- les leçons des formations payantes, tous les espaces de la communauté, les lives et leurs replays. L'équipe garde
-- tout ; le formateur garde ses lives et les replays qu'il publie ; le compte gratuit garde Général et les espaces des
-- parcours qu'il a commencés. Chaque fonction reprend sa dernière définition et n'ajoute que la condition. Rejouable.

begin;

-- ─── Les aides ──────────────────────────────────────────────────────────────────────────────────────
create or replace function public.acces_abonne()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.equipe_contenus() or public.abonne((select auth.uid()));
$$;

create or replace function public.acces_replays()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.acces_abonne() or public.peut_publier_replay();
$$;

-- Une publication lisible : son espace, et, pour un replay, l'accès aux replays.
create or replace function public.peut_lire_publication(p public.publications)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.peut_lire_espace(p.parcours_id) and (not p.replay or public.acces_replays());
$$;

-- Les leçons publiées des formations payantes : ouvertes à l'abonné (dernière définition : 0036_formateur_sans_espace_etudiant.sql).
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
          and (l.apercu or (f.gratuite and (select auth.uid()) is not null) or public.abonne((select auth.uid())))
      )
    )
  );
$$;

-- Les espaces des parcours : ouverts à l'abonné (restructuration, §5.4) (dernière définition : 0019_communaute.sql).
create or replace function public.peut_lire_espace(p_parcours uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and not public.compte_suspendu()
    and (
      p_parcours is null
      or public.equipe_contenus()
      or exists (
        select 1 from public.parcours pa
        where pa.id = p_parcours and pa.actif
          and (
            public.abonne((select auth.uid()))
            or exists (
              select 1
              from public.formations_parcours fp
              join public.formations f on f.id = fp.formation_id
              where fp.parcours_id = pa.id and f.formateur_id is not null and f.formateur_id = public.ma_fiche_formateur()
            )
            or exists (
              select 1
              from public.progression_lecons pr
              join public.lecons l on l.id = pr.lecon_id
              join public.modules m on m.id = l.module_id
              join public.formations_parcours fp on fp.formation_id = m.formation_id
              where fp.parcours_id = pa.id and pr.profil_id = (select auth.uid())
            )
          )
      )
    );
$$;

-- L'espace « Replays » : ouvert aux abonnés (dernière définition : 0046_replays.sql).
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
  -- Les replays des lives (0046) : réservés aux abonnés, à l’équipe et aux formateurs (0050) ; « publier » dit si le compte peut y publier.
  || jsonb_build_array(
    jsonb_build_object('id', 'replays', 'nom', 'Replays de live', 'nom_court', 'Replays', 'couleur', null, 'slug', null, 'ouvert', public.acces_replays(),
      'publier', public.peut_publier_replay())
  );
end;
$$;

-- Le fil : les replays aux seuls abonnés, dans leur espace comme dans Actualités (dernière définition : 0046_replays.sql).
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
  if v_replays and not public.acces_replays() then
    return v_vide;
  end if;
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
      where (case when v_general then p.parcours_id is null and not p.replay when v_replays then p.replay when v_parcours is not null then p.parcours_id = v_parcours else public.peut_lire_publication(p) end)
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
        and (case when v_general then p.parcours_id is null and not p.replay when v_replays then p.replay when v_parcours is not null then p.parcours_id = v_parcours else public.peut_lire_publication(p) end)
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
        and (case when v_general then p.parcours_id is null and not p.replay when v_replays then p.replay when v_parcours is not null then p.parcours_id = v_parcours else public.peut_lire_publication(p) end)
      order by p.cree_le, p.id
      offset v_debut
      limit v_nombre + 1
    ) x;
  else
    select array_agg(x.id order by x.cree_le desc, x.id desc) into v_ids
    from (
      select p.id, p.cree_le
      from public.publications p
      where (case when v_general then p.parcours_id is null and not p.replay when v_replays then p.replay when v_parcours is not null then p.parcours_id = v_parcours else public.peut_lire_publication(p) end)
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

-- Le bandeau « Nouvelles publications » : même règle (dernière définition : 0046_replays.sql).
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
  if v_replays and not public.acces_replays() then
    return v_vide;
  end if;
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
    where (case when v_general then p.parcours_id is null and not p.replay when v_replays then p.replay when v_parcours is not null then p.parcours_id = v_parcours else public.peut_lire_publication(p) end)
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

-- Une publication ouverte par son lien (dernière définition : 0020_moderation.sql).
create or replace function public.publication_communaute(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v public.publications%rowtype;
begin
  perform public.exiger_compte_actif();
  select * into v from public.publications where id = p_id;
  if not found or not public.peut_lire_publication(v) or not (public.publication_visible(v) or public.equipe_contenus()) then
    return null;
  end if;
  return public.carte_publication(v) || jsonb_build_object('toutes_reponses', coalesce((
    select jsonb_agg(public.carte_reponse(c) order by c.cree_le, c.id)
    from public.commentaires_publications c
    where c.publication_id = v.id
  ), '[]'::jsonb));
end;
$$;

-- Réagir, commenter, voter : sur ce qu'on peut lire (dernière définition : 0026_communaute_sondages.sql).
create or replace function public.publication_ouverte(p_id uuid)
returns public.publications
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v public.publications%rowtype;
begin
  perform public.exiger_compte_actif();
  select * into v from public.publications where id = p_id;
  if not found then
    raise exception 'Cette publication n’existe plus.';
  end if;
  if not public.peut_lire_publication(v) then
    raise exception 'Cet espace ne vous est pas ouvert.' using errcode = '42501';
  end if;
  if v.statut <> 'publiee' and not public.equipe_contenus() then
    if v.statut = 'en_attente' and v.auteur = (select auth.uid()) then
      raise exception 'Cette publication attend sa vérification.';
    end if;
    raise exception 'Cette publication n’existe plus.';
  end if;
  -- Programmée : rien avant son heure (l'auteur le sait ; pour les autres, elle n'existe pas encore).
  if v.cree_le > now() and not public.equipe_contenus() then
    if v.auteur = (select auth.uid()) then
      raise exception 'Cette publication n’est pas encore parue.';
    end if;
    raise exception 'Cette publication n’existe plus.';
  end if;
  return v;
end;
$$;

-- Les fichiers joints : sur ce qu'on peut lire (dernière définition : 0026_communaute_sondages.sql).
create or replace function public.fichier_communaute_lisible(p_nom text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.publications p
    where p.piece_jointe ->> 'chemin' = p_nom and p.statut = 'publiee' and p.cree_le <= now() and public.peut_lire_publication(p)
  ) or exists (
    select 1 from public.options_sondage o
    join public.publications p on p.id = o.publication_id
    where o.image ->> 'chemin' = p_nom and p.statut = 'publiee' and p.cree_le <= now() and public.peut_lire_publication(p)
  ) or exists (
    select 1 from public.annonce_communaute a
    where a.image_chemin = p_nom and public.annonce_visible(a)
  );
$$;

-- La colonne « Activité récente » : même règle (dernière définition : 0040_photos_colonne_communaute.sql).
create or replace function public.activites_recentes()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.exiger_compte_actif();
  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'type', a.type,
        'publication_id', a.publication_id,
        'auteur', jsonb_build_object('nom_court', public.nom_avis(pr.prenom, pr.nom), 'initiales', public.initiales_avis(pr.prenom, pr.nom), 'photo', pr.photo_url),
        'extrait', a.extrait,
        'cree_le', a.cree_le
      )
      order by a.cree_le desc
    )
    from (
      (
        select 'publication' as type, p.id as publication_id, p.auteur, p.cree_le, left(coalesce(nullif(p.titre, ''), p.texte), 80) as extrait
        from public.publications p
        where p.statut = 'publiee' and p.cree_le <= now() and public.peut_lire_publication(p)
        order by p.cree_le desc
        limit 6
      )
      union all
      (
        select 'commentaire', p.id, c.auteur, c.cree_le, left(coalesce(nullif(p.titre, ''), p.texte), 80)
        from public.commentaires_publications c
        join public.publications p on p.id = c.publication_id
        where p.statut = 'publiee' and p.cree_le <= now() and public.peut_lire_publication(p)
        order by c.cree_le desc
        limit 6
      )
      order by cree_le desc
      limit 6
    ) a
    join public.profils pr on pr.id = a.auteur
  ), '[]'::jsonb);
end;
$$;

-- La colonne « Tendances » : même règle (dernière définition : 0040_photos_colonne_communaute.sql).
create or replace function public.publications_tendances()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.exiger_compte_actif();
  return coalesce((
    select jsonb_agg(y.carte order by y.score desc, y.cree_le desc, y.id desc)
    from (
    select x.* from (
      select p.id, p.cree_le,
             (select count(*) from public.reactions_publications r where r.publication_id = p.id)
             + (select count(*) from public.commentaires_publications c where c.publication_id = p.id) as score,
             jsonb_build_object(
               'id', p.id,
               'extrait', left(coalesce(nullif(p.titre, ''), p.texte), 160),
               'auteur', jsonb_build_object(
                 'nom_court', public.nom_avis(pr.prenom, pr.nom),
                 'initiales', public.initiales_avis(pr.prenom, pr.nom),
                 'photo', pr.photo_url,
                 'equipe', coalesce(public.role_communaute(p.auteur) = 'equipe', false)
               )
             ) as carte
      from public.publications p
      join public.profils pr on pr.id = p.auteur
      where p.statut = 'publiee' and p.cree_le <= now() and p.cree_le > now() - interval '7 days' and public.peut_lire_publication(p)
    ) x
    where x.score > 0
    order by x.score desc, x.cree_le desc, x.id desc
    limit 5
    ) y
  ), '[]'::jsonb);
end;
$$;

-- S'inscrire à un live : abonnés et équipe (choix 1 de la spec ; dernière définition : 0023_sessions_rappels.sql).
create or replace function public.sinscrire_session(p_session uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.sessions_live%rowtype;
begin
  perform public.exiger_compte_actif();
  select * into v from public.sessions_live where id = p_session;
  if not found or v.statut <> 'programmee' or v.debut + make_interval(mins => v.duree_minutes) <= now() then
    raise exception 'Les inscriptions à cette session sont closes.';
  end if;
  if not public.acces_abonne() then
    raise exception 'Les lives sont réservés aux abonnés.' using errcode = '42501';
  end if;
  insert into public.inscriptions_sessions (session_id, profil_id, rappel_veille_le, rappel_heure_le, rappel_dix_le)
  values (
    p_session,
    (select auth.uid()),
    case when now() >= v.debut - interval '24 hours' then now() end,
    case when now() >= v.debut - interval '1 hour' then now() end,
    case when now() >= v.debut - interval '10 minutes' then now() end
  )
  on conflict do nothing;
end;
$$;

-- La carte d'un live : le lien aux seuls abonnés ; « reservee » pour le cadenas (dernière définition : 0018_sessions_live.sql).
create or replace function public.carte_session(s public.sessions_live)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', s.id,
    'titre', s.titre,
    'description', s.description,
    'debut', s.debut,
    'duree_minutes', s.duree_minutes,
    'plateforme', public.plateforme_session(s.lien),
    'lien', case
      when public.droit_session(s.formateur_id)
        or (public.acces_abonne() and s.statut = 'programmee'
            and now() >= s.debut - interval '10 minutes'
            and now() < s.debut + make_interval(mins => s.duree_minutes))
      then s.lien
    end,
    'parcours', (select jsonb_build_object('nom_court', p.nom_court, 'couleur', p.couleur) from public.parcours p where p.id = s.parcours_id),
    'animateur', public.animateur_session(s.formateur_id),
    'inscriptions', (select count(*)::int from public.inscriptions_sessions i where i.session_id = s.id),
    'inscrit', exists (select 1 from public.inscriptions_sessions i where i.session_id = s.id and i.profil_id = (select auth.uid())),
    'reservee', not (public.acces_abonne() or public.droit_session(s.formateur_id)),
    'statut', s.statut
  );
$$;

revoke execute on function public.acces_abonne() from public, anon, authenticated;
revoke execute on function public.acces_replays() from public, anon, authenticated;
revoke execute on function public.peut_lire_publication(public.publications) from public, anon, authenticated;
grant execute on function public.acces_abonne() to authenticated;
grant execute on function public.acces_replays() to authenticated;

commit;

-- ═══ 0051_paiements_equipe.sql ═══
-- Migration 0051 : le back-office des abonnements et des paiements (lot 2, spec du 1er novembre 2026, §6). L'équipe
-- (equipe_contenus) lit les formules, les codes promo et les paiements ; seuls les administrateurs (equipe_paiements,
-- 0049) touchent à l'argent : prix, codes promo, annulation d'un abonnement (remboursement fait depuis Payiz). Rejouable.

begin;

create or replace function public.exiger_equipe_paiements()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.exiger_compte_actif();
  if not public.equipe_paiements() then
    raise exception 'Réservé aux administrateurs.' using errcode = '42501';
  end if;
end;
$$;

-- ─── Les formules : prix, recommandée, proposée ─────────────────────────────────────────────────────
create or replace function public.regler_formule(p_formule uuid, p_prix integer, p_recommandee boolean, p_active boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.exiger_equipe_paiements();
  if p_prix is not null and p_prix < 1000 then
    raise exception 'Le prix doit être d’au moins 1 000 FCFA.';
  end if;
  if not exists (select 1 from public.formules where id = p_formule) then
    raise exception 'Abonnement inconnu.';
  end if;
  -- Une seule formule recommandée.
  if coalesce(p_recommandee, false) then
    update public.formules set recommandee = false where id <> p_formule and recommandee;
  end if;
  update public.formules
  set prix_fcfa = p_prix, recommandee = coalesce(p_recommandee, false), active = coalesce(p_active, true)
  where id = p_formule;
end;
$$;

-- ─── Les codes promo ────────────────────────────────────────────────────────────────────────────────
create or replace function public.codes_promo_equipe()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.exiger_equipe_moderation();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', c.id,
      'code', c.code,
      'type', c.type,
      'valeur', c.valeur,
      'debut', c.debut,
      'fin', c.fin,
      'limite', c.limite,
      'actif', c.actif,
      'cree_le', c.cree_le,
      -- Seuls les paiements réussis consomment un code.
      'utilisations', (select count(*)::integer from public.paiements p where p.code_promo_id = c.id and p.statut = 'reussi')
    ) order by c.cree_le desc, c.code)
    from public.codes_promo c
  ), '[]'::jsonb);
end;
$$;

-- Crée (p_id nul) ou modifie un code ; le code est rangé en majuscules.
create or replace function public.enregistrer_code_promo(
  p_id uuid, p_code text, p_type text, p_valeur integer, p_debut timestamptz, p_fin timestamptz, p_limite integer, p_actif boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_id uuid;
begin
  perform public.exiger_equipe_paiements();
  if v_code !~ '^[A-Z0-9_-]{3,30}$' then
    raise exception 'Le code compte 3 à 30 lettres, chiffres, tirets ou soulignés.';
  end if;
  if p_type is null or p_type not in ('pourcentage', 'montant') then
    raise exception 'Choisissez le type de remise.';
  end if;
  if p_type = 'pourcentage' and (p_valeur is null or p_valeur < 1 or p_valeur > 100) then
    raise exception 'Un pourcentage va de 1 à 100.';
  end if;
  if p_type = 'montant' and (p_valeur is null or p_valeur < 1) then
    raise exception 'Le montant de la remise doit être positif.';
  end if;
  if p_debut is not null and p_fin is not null and p_fin <= p_debut then
    raise exception 'La fin doit suivre le début.';
  end if;
  if p_limite is not null and p_limite < 1 then
    raise exception 'La limite doit être d’au moins 1.';
  end if;
  begin
    if p_id is null then
      insert into public.codes_promo (code, type, valeur, debut, fin, limite, actif, cree_par)
      values (v_code, p_type, p_valeur, p_debut, p_fin, p_limite, coalesce(p_actif, true), (select auth.uid()))
      returning id into v_id;
    else
      update public.codes_promo
      set code = v_code, type = p_type, valeur = p_valeur, debut = p_debut, fin = p_fin, limite = p_limite, actif = coalesce(p_actif, true)
      where id = p_id
      returning id into v_id;
      if v_id is null then
        raise exception 'Ce code n’existe plus.';
      end if;
    end if;
  exception when unique_violation then
    raise exception 'Ce code existe déjà.';
  end;
  return v_id;
end;
$$;

-- ─── Les paiements ──────────────────────────────────────────────────────────────────────────────────
-- Filtre : vide (tous), reussi, en_attente, echoue, expire (avec les annulés). Recherche : nom, adresse, numéro de reçu.
-- 20 par page. Les paiements jamais envoyés à Payiz (préparation abandonnée) n'y figurent pas.
create or replace function public.paiements_equipe(p_statut text, p_recherche text, p_page integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_q text := lower(btrim(coalesce(p_recherche, '')));
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_resultat jsonb;
begin
  perform public.exiger_equipe_moderation();
  with lignes as (
    select p.id, p.cree_le, p.montant, p.statut, p.operateur, p.telephone_masque, p.numero_recu, p.profil_id,
           coalesce(pr.prenom, '') as prenom, coalesce(pr.nom, '') as nom, coalesce(u.email, '') as email,
           f.code as formule_code, f.nom as formule_nom, f.duree_mois
    from public.paiements p
    join public.formules f on f.id = p.formule_id
    left join public.profils pr on pr.id = p.profil_id
    left join auth.users u on u.id = p.profil_id
    where not (p.payiz_id is null and p.montant > 0)
      and case
        when coalesce(p_statut, '') = '' then true
        when p_statut = 'expire' then p.statut in ('expire', 'annule')
        else p.statut = p_statut
      end
      and (
        v_q = ''
        or strpos(lower(coalesce(p.numero_recu, '')), v_q) > 0
        or strpos(lower(coalesce(u.email, '')), v_q) > 0
        or strpos(public.sans_accents(coalesce(pr.prenom, '') || ' ' || coalesce(pr.nom, '')), public.sans_accents(v_q)) > 0
      )
  ),
  page as (
    select * from lignes order by cree_le desc, id limit 20 offset (v_page - 1) * 20
  )
  select jsonb_build_object(
    'total', (select count(*) from lignes),
    'lignes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', g.id,
        'cree_le', g.cree_le,
        'compte', jsonb_build_object('id', g.profil_id, 'prenom', g.prenom, 'nom', g.nom, 'email', g.email),
        'formule', jsonb_build_object('code', g.formule_code, 'nom', g.formule_nom, 'duree_mois', g.duree_mois),
        'montant', g.montant,
        'statut', g.statut,
        'operateur', g.operateur,
        'telephone_masque', g.telephone_masque,
        'numero_recu', g.numero_recu
      ) order by g.cree_le desc, g.id)
      from page g
    ), '[]'::jsonb)
  ) into v_resultat;
  return v_resultat;
end;
$$;

-- Le détail d'un paiement : sa carte, le compte, et l'abonnement qu'il a ouvert.
create or replace function public.paiement_equipe(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v public.paiements%rowtype;
begin
  perform public.exiger_equipe_moderation();
  select * into v from public.paiements where id = p_id;
  if not found then
    return null;
  end if;
  return public.carte_paiement(v) || jsonb_build_object(
    'compte', (
      select jsonb_build_object('id', pr.id, 'prenom', pr.prenom, 'nom', pr.nom, 'email', coalesce(u.email, ''))
      from public.profils pr left join auth.users u on u.id = pr.id
      where pr.id = v.profil_id
    ),
    'abonnement', (
      select jsonb_build_object('id', a.id, 'debut', a.debut, 'fin', a.fin, 'annule_le', a.annule_le, 'motif_annulation', a.motif_annulation)
      from public.abonnements a where a.paiement_id = v.id
    )
  );
end;
$$;

-- Un remboursement exceptionnel se fait depuis Payiz ; l'équipe annule alors l'abonnement ici (choix 4 de la spec).
create or replace function public.annuler_abonnement(p_abonnement uuid, p_motif text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_motif text := btrim(coalesce(p_motif, ''));
  v_profil uuid;
begin
  perform public.exiger_equipe_paiements();
  if char_length(v_motif) < 3 or char_length(v_motif) > 300 then
    raise exception 'Indiquez le motif (3 à 300 caractères).';
  end if;
  update public.abonnements
  set annule_le = now(), motif_annulation = v_motif
  where id = p_abonnement and annule_le is null
  returning profil_id into v_profil;
  if v_profil is null then
    raise exception 'Cet abonnement est déjà annulé.';
  end if;
  perform public.notifier(array[v_profil], 'service', 'Votre abonnement a été annulé', v_motif, '/abonnement');
end;
$$;

-- Les chiffres en tête de la page : le mois en cours, à l'heure du Bénin.
create or replace function public.resume_paiements()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_mois timestamptz := date_trunc('month', now() at time zone 'Africa/Porto-Novo') at time zone 'Africa/Porto-Novo';
begin
  perform public.exiger_equipe_moderation();
  return jsonb_build_object(
    'revenus_mois', coalesce((select sum(p.montant) from public.paiements p where p.statut = 'reussi' and p.confirme_le >= v_mois), 0),
    'reussis_mois', (select count(*) from public.paiements p where p.statut = 'reussi' and p.confirme_le >= v_mois),
    'echoues_mois', (select count(*) from public.paiements p where p.statut = 'echoue' and p.cree_le >= v_mois),
    'abonnes_actifs', (
      select count(distinct a.profil_id) from public.abonnements a
      where a.annule_le is null and a.debut <= now() and now() < a.fin
    )
  );
end;
$$;

-- ─── Le tableau de bord : les tuiles du lot 2 (dernière définition : 0031_quiz.sql) ─────────────────────────
create or replace function public.statistiques_back_office(p_maintenant timestamptz default now())
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_mois timestamptz := date_trunc('month', p_maintenant);
  -- Le mois en cours au Bénin, pour l'argent (lot 2).
  v_mois_local timestamp := date_trunc('month', p_maintenant at time zone 'Africa/Porto-Novo');
  v_resultat jsonb;
begin
  if not public.equipe_contenus() then
    raise exception 'Les statistiques sont réservées à l’équipe.' using errcode = '42501';
  end if;

  with
    -- Une ligne par étudiant et par formation commencée : sa part de leçons terminées.
    suivis as (
      select p.profil_id, m.formation_id, count(p.terminee_le) as terminees
      from public.progression_lecons p
      join public.lecons l on l.id = p.lecon_id
      join public.modules m on m.id = l.module_id
      where l.publiee and l.type = 'lecon'
      group by p.profil_id, m.formation_id
    ),
    totaux as (
      select m.formation_id, count(*) as lecons
      from public.lecons l
      join public.modules m on m.id = l.module_id
      where l.publiee and l.type = 'lecon'
      group by m.formation_id
    ),
    top as (
      select f.titre, f.slug, count(*)::integer as etudiants
      from suivis s
      join public.formations f on f.id = s.formation_id
      where f.statut = 'publiee'
      group by f.id, f.titre, f.slug
      order by count(*) desc, f.titre
      limit 5
    )
  select jsonb_build_object(
    'utilisateurs', (select count(*) from public.profils),
    'inscrits_semaine', (select count(*) from public.profils where cree_le > p_maintenant - interval '7 days' and cree_le <= p_maintenant),
    'inscrits_mois', (select count(*) from public.profils where cree_le >= v_mois and cree_le <= p_maintenant),
    'inscrits_mois_precedent', (select count(*) from public.profils where cree_le >= v_mois - interval '1 month' and cree_le < v_mois),
    'progression_moyenne', (
      select round(avg(100.0 * s.terminees / t.lecons))::integer
      from suivis s
      join totaux t on t.formation_id = s.formation_id
      where t.lecons > 0
    ),
    'formations_suivies', coalesce((select jsonb_agg(jsonb_build_object('titre', titre, 'slug', slug, 'etudiants', etudiants) order by etudiants desc, titre) from top), '[]'::jsonb),
    -- Lot 2 : abonnés, conversion, chiffre d'affaires (paiements réussis), revenus par formule.
    'abonnes_actifs', (
      select count(distinct a.profil_id) from public.abonnements a
      where a.annule_le is null and a.debut <= p_maintenant and p_maintenant < a.fin
    ),
    'etudiants', (
      select count(*) from public.profils pr
      where not exists (
        select 1 from public.roles r where r.profil_id = pr.id and r.role in ('formateur', 'moderateur', 'admin', 'super_admin')
      )
    ),
    'ca_mois', coalesce((
      select sum(p.montant) from public.paiements p
      where p.statut = 'reussi' and p.confirme_le at time zone 'Africa/Porto-Novo' >= v_mois_local and p.confirme_le <= p_maintenant
    ), 0),
    'ca_total', coalesce((select sum(p.montant) from public.paiements p where p.statut = 'reussi' and p.confirme_le <= p_maintenant), 0),
    'ca_par_mois', (
      select jsonb_agg(jsonb_build_object(
        'mois', to_char(m, 'YYYY-MM'),
        'montant', coalesce((
          select sum(p.montant) from public.paiements p
          where p.statut = 'reussi'
            and p.confirme_le at time zone 'Africa/Porto-Novo' >= m
            and p.confirme_le at time zone 'Africa/Porto-Novo' < m + interval '1 month'
        ), 0)
      ) order by m)
      from generate_series(v_mois_local - interval '5 months', v_mois_local, interval '1 month') as m
    ),
    'revenus_par_formule', coalesce((
      select jsonb_agg(jsonb_build_object(
        'code', f.code,
        'nom', f.nom,
        'montant', coalesce((select sum(p.montant) from public.paiements p where p.formule_id = f.id and p.statut = 'reussi'), 0),
        'nombre', (select count(*) from public.paiements p where p.formule_id = f.id and p.statut = 'reussi')
      ) order by f.ordre)
      from public.formules f
    ), '[]'::jsonb)
  )
  into v_resultat;

  return v_resultat;
end;
$$;

-- ─── La liste des comptes : la formule de chacun (dernière définition : 0013_utilisateurs.sql) ────────────────────
create or replace function public.comptes_equipe(p_recherche text default '', p_filtre text default 'tous', p_page integer default 1)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_q text := public.sans_accents(btrim(coalesce(p_recherche, '')));
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_resultat jsonb;
begin
  if not public.equipe_contenus() then
    raise exception 'Accès réservé à l’équipe.' using errcode = '42501';
  end if;

  with comptes as (
    select
      p.id, p.prenom, p.nom, coalesce(u.email, '') as email, p.cree_le, u.last_sign_in_at,
      coalesce((select array_agg(r.role order by r.role) from public.roles r where r.profil_id = p.id), '{}') as roles,
      exists (select 1 from public.suspensions s where s.profil_id = p.id) as suspendu
    from public.profils p
    left join auth.users u on u.id = p.id
  ),
  retenus as (
    select * from comptes c
    where (v_q = '' or strpos(public.sans_accents(c.prenom || ' ' || c.nom), v_q) > 0 or strpos(lower(c.email), v_q) > 0)
      and case p_filtre
        when 'etudiants' then not (c.roles && array['formateur', 'moderateur', 'admin', 'super_admin']::public.role_etudium[])
        when 'formateurs' then 'formateur' = any (c.roles)
        when 'equipe' then c.roles && array['moderateur', 'admin', 'super_admin']::public.role_etudium[]
        when 'suspendus' then c.suspendu
        else true
      end
  ),
  page as (
    select * from retenus order by cree_le desc, id limit 25 offset (v_page - 1) * 25
  )
  select jsonb_build_object(
    'total', (select count(*) from retenus),
    'comptes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', g.id,
        'prenom', g.prenom,
        'nom', g.nom,
        'email', g.email,
        'roles', to_jsonb(g.roles::text[]),
        'inscrit_le', g.cree_le,
        'derniere_connexion', g.last_sign_in_at,
        'suspendu', g.suspendu,
        -- Le nom de l'abonnement en cours (lot 2) ; null sans abonnement.
        'formule', (
          select f.nom from public.abonnements a join public.formules f on f.id = a.formule_id
          where a.profil_id = g.id and a.annule_le is null and a.debut <= now() and now() < a.fin
          order by a.debut desc limit 1
        )
      ) order by g.cree_le desc, g.id)
      from page g
    ), '[]'::jsonb)
  ) into v_resultat;
  return v_resultat;
end;
$$;

-- ─── Droits ─────────────────────────────────────────────────────────────────────────────────────────
revoke execute on function public.exiger_equipe_paiements() from public, anon, authenticated;
revoke execute on function public.regler_formule(uuid, integer, boolean, boolean) from public, anon, authenticated;
revoke execute on function public.codes_promo_equipe() from public, anon, authenticated;
revoke execute on function public.enregistrer_code_promo(uuid, text, text, integer, timestamptz, timestamptz, integer, boolean) from public, anon, authenticated;
revoke execute on function public.paiements_equipe(text, text, integer) from public, anon, authenticated;
revoke execute on function public.paiement_equipe(uuid) from public, anon, authenticated;
revoke execute on function public.annuler_abonnement(uuid, text) from public, anon, authenticated;
revoke execute on function public.resume_paiements() from public, anon, authenticated;

grant execute on function public.regler_formule(uuid, integer, boolean, boolean) to authenticated;
grant execute on function public.codes_promo_equipe() to authenticated;
grant execute on function public.enregistrer_code_promo(uuid, text, text, integer, timestamptz, timestamptz, integer, boolean) to authenticated;
grant execute on function public.paiements_equipe(text, text, integer) to authenticated;
grant execute on function public.paiement_equipe(uuid) to authenticated;
grant execute on function public.annuler_abonnement(uuid, text) to authenticated;
grant execute on function public.resume_paiements() to authenticated;

commit;

-- ═══ 0052_rappels_abonnements.sql ═══
-- Migration 0052 : les rappels d'expiration des abonnements (lot 2, spec du 1er novembre 2026, §8). Des notifications
-- dans l'appli (catégorie « Expiration et renouvellement ») 7 jours avant la fin, la veille et le jour de l'expiration,
-- chacune une seule fois, sur la fin réelle de l'accès (un abonnement suivi d'un autre n'en reçoit pas). Elles partent
-- par la tâche planifiée et à l'ouverture de la cloche, comme les rappels des lives. Au passage, une préparation jamais
-- envoyée à Payiz est notée expirée après une heure ; un paiement envoyé attend la réponse de Payiz (relecture,
-- notification). Les e-mails de rappel viendront avec le lot 5 B. Rejouable.

begin;

-- « 14 mars 2027 », « 1er mai 2027 », à l'heure du Bénin.
create or replace function public.date_longue(p timestamptz)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case when extract(day from l) = 1 then '1er' else extract(day from l)::integer::text end
    || ' '
    || (array['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'])[extract(month from l)::integer]
    || ' '
    || extract(year from l)::integer::text
  from (select p at time zone 'Africa/Porto-Novo' as l) x;
$$;

create or replace function public.traiter_abonnements()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_total integer := 0;
  v_jours integer;
  v_prolonger constant text := 'Prolongez-le pour garder l’accès à tout.';
begin
  -- Le compte qui ouvre sa cloche reçoit aussi ses propres rappels (notifier exclut sinon l'auteur de l'appel).
  -- Une seule exécution à la fois (tâche planifiée et cloches ouvertes en même temps).
  if not pg_try_advisory_xact_lock(hashtext('etudium.traiter_abonnements')) then
    return 0;
  end if;

  -- Les préparations jamais envoyées à Payiz n'aboutiront plus. Un paiement envoyé garde son état : seul Payiz sait
  -- s'il a été payé (relecture de « Mon abonnement », notification).
  update public.paiements
  set statut = 'expire'
  where statut = 'en_attente' and payiz_id is null and cree_le < now() - interval '1 hour';

  -- Le jour de l'expiration (et les 3 jours suivants, si la tâche ne passe pas) : les deux autres rappels sont notés
  -- envoyés, pour ne jamais les recevoir après coup.
  for r in
    update public.abonnements a
    set rappel_fin_le = now(), rappel_veille_le = coalesce(a.rappel_veille_le, now()), rappel_7j_le = coalesce(a.rappel_7j_le, now())
    where a.rappel_fin_le is null and a.annule_le is null
      and a.fin <= now() and now() < a.fin + interval '3 days'
      and not exists (select 1 from public.abonnements b where b.profil_id = a.profil_id and b.annule_le is null and b.fin > a.fin)
    returning a.profil_id, a.formule_id
  loop
    perform public.notifier(
      array[r.profil_id], 'expiration_renouvellement',
      'Votre abonnement ' || (select f.nom from public.formules f where f.id = r.formule_id) || ' a expiré',
      'Vos formations payantes sont verrouillées. Votre progression et vos certificats restent sur votre compte.',
      '/abonnement/souscrire',
      true
    );
    v_total := v_total + 1;
  end loop;

  -- La veille.
  for r in
    update public.abonnements a
    set rappel_veille_le = now(), rappel_7j_le = coalesce(a.rappel_7j_le, now())
    where a.rappel_veille_le is null and a.annule_le is null
      and a.fin - interval '1 day' <= now() and now() < a.fin
      and not exists (select 1 from public.abonnements b where b.profil_id = a.profil_id and b.annule_le is null and b.fin > a.fin)
    returning a.profil_id, a.formule_id, a.fin
  loop
    perform public.notifier(
      array[r.profil_id], 'expiration_renouvellement',
      'Votre abonnement ' || (select f.nom from public.formules f where f.id = r.formule_id) || ' se termine demain',
      'Il prend fin le ' || public.date_longue(r.fin) || '. ' || v_prolonger,
      '/abonnement/souscrire',
      true
    );
    v_total := v_total + 1;
  end loop;

  -- 7 jours avant (ou plus tard si la tâche n'est pas passée : le titre dit le vrai nombre de jours).
  for r in
    update public.abonnements a
    set rappel_7j_le = now()
    where a.rappel_7j_le is null and a.annule_le is null
      and a.fin - interval '7 days' <= now() and now() < a.fin - interval '1 day'
      and not exists (select 1 from public.abonnements b where b.profil_id = a.profil_id and b.annule_le is null and b.fin > a.fin)
    returning a.profil_id, a.formule_id, a.fin
  loop
    v_jours := ceil(extract(epoch from (r.fin - now())) / 86400)::integer;
    perform public.notifier(
      array[r.profil_id], 'expiration_renouvellement',
      'Votre abonnement ' || (select f.nom from public.formules f where f.id = r.formule_id) || ' se termine dans ' || v_jours || ' jours',
      'Il prend fin le ' || public.date_longue(r.fin) || '. ' || v_prolonger,
      '/abonnement/souscrire',
      true
    );
    v_total := v_total + 1;
  end loop;

  return v_total;
end;
$$;

-- La cloche (dernière définition : 0041) : les publications programmées, les rappels d'abonnement, puis les lives.
create or replace function public.rappels_sessions()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.exiger_compte_actif();
  -- Les publications programmées qui viennent de paraître (0041), les rappels d'abonnement (0052), puis les sessions live.
  perform public.traiter_publications_programmees();
  perform public.traiter_abonnements();
  return public.traiter_sessions_live();
end;
$$;

revoke execute on function public.date_longue(timestamptz) from public, anon, authenticated;
revoke execute on function public.traiter_abonnements() from public, anon, authenticated;

commit;

-- ─── La tâche planifiée, toutes les 15 minutes ──────────────────────────────────────────────────────
-- Sans pg_cron, la cloche suffit (rappels_sessions) : le rappel part au prochain chargement d'une cloche.
do $cron$
begin
  begin
    create extension if not exists pg_cron with schema pg_catalog;
  exception when others then
    raise notice 'pg_cron indisponible (%) : activez Cron dans Supabase, puis relancez ce bloc.', sqlerrm;
    return;
  end;
  begin
    perform cron.schedule('etudium-abonnements', '*/15 * * * *', 'select public.traiter_abonnements()');
  exception when others then
    raise notice 'Tâche planifiée non créée (%) : voir le guide « Ce qui te revient », section 56.', sqlerrm;
  end;
end
$cron$;

-- ═══ 0053_finitions_paiement.sql ═══
-- Migration 0053 : les finitions du paiement (relecture du lot 2, 1er novembre 2026). Une préparation jamais partie
-- chez Payiz est reprise au lieu d'en créer une autre ; deux confirmations simultanées d'un même compte s'enchaînent ;
-- annuler un abonnement avance ceux qui le suivaient ; les essais de codes promo sont limités (10 par 10 minutes et par
-- compte). Chaque fonction reprend sa dernière définition. Rejouable.

begin;

-- ─── Les essais de codes promo ──────────────────────────────────────────────────────────────────────
create table if not exists public.essais_codes (
  profil_id uuid not null references public.profils (id) on delete cascade,
  essaye_le timestamptz not null default now()
);
create index if not exists essais_codes_profil_idx on public.essais_codes (profil_id, essaye_le);
alter table public.essais_codes enable row level security;
revoke all on public.essais_codes from anon, authenticated;

-- Note un essai du compte ; faux (et rien de noté) au-delà de 10 essais en 10 minutes. Les essais de plus d'un jour
-- sont effacés au passage.
create or replace function public.noter_essai_code()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  delete from public.essais_codes where profil_id = v_uid and essaye_le < now() - interval '1 day';
  if (select count(*) from public.essais_codes where profil_id = v_uid and essaye_le > now() - interval '10 minutes') >= 10 then
    return false;
  end if;
  insert into public.essais_codes (profil_id) values (v_uid);
  return true;
end;
$$;

-- « Appliquer » (dernière définition : 0049), avec la limite d'essais.
create or replace function public.essayer_code(p_code text, p_formule uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.exiger_compte_actif();
  if not public.noter_essai_code() then
    return jsonb_build_object('ok', false, 'message', 'Trop d’essais de code. Réessayez dans quelques minutes.');
  end if;
  return public.remise_code(p_code, p_formule, (select auth.uid()));
end;
$$;

-- Préparer un paiement (dernière définition : 0049_abonnements_paiements.sql).
create or replace function public.preparer_paiement(p_formule uuid, p_code text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v public.paiements%rowtype;
  v_calcul jsonb;
begin
  perform public.exiger_compte_actif();
  if public.a_role('formateur') then
    raise exception 'Un compte formateur n’a pas d’abonnement.' using errcode = '42501';
  end if;
  -- Deux demandes simultanées d'un même compte passent l'une après l'autre ; un code promo est verrouillé le temps de
  -- compter ses utilisations (un code à 100 % active l'abonnement dans la même transaction).
  perform pg_advisory_xact_lock(hashtext('etudium.paiement.' || v_uid::text));
  if coalesce(trim(p_code), '') <> '' then
    perform 1 from public.codes_promo where code = upper(trim(p_code)) for update;
    -- Un code saisi compte comme un essai (limite contre les codes devinés, 0053).
    if not public.noter_essai_code() then
      raise exception 'Trop d’essais de code. Réessayez dans quelques minutes.';
    end if;
  end if;

  select * into v from public.paiements
  where profil_id = v_uid and statut = 'en_attente' and payiz_id is not null and essai_le > now() - interval '3 minutes'
  order by essai_le desc limit 1;
  if found then
    return public.carte_paiement(v) || jsonb_build_object('repris', true);
  end if;

  v_calcul := public.remise_code(p_code, p_formule, v_uid);
  if not (v_calcul ->> 'ok')::boolean then
    raise exception '%', v_calcul ->> 'message';
  end if;
  if (v_calcul ->> 'montant')::integer > 0 and not public.paiements_ouverts() then
    raise exception 'Les paiements ouvrent bientôt.';
  end if;

  -- Une préparation jamais partie chez Payiz (coupure réseau, Payiz lent) est reprise pour le même abonnement, le même
  -- code et le même montant : même identifiant, donc même clé d'idempotence, et pas de seconde demande au téléphone (0053).
  select * into v from public.paiements
  where profil_id = v_uid and statut = 'en_attente' and payiz_id is null
    and formule_id = p_formule
    and code_promo_id is not distinct from (v_calcul ->> 'code_id')::uuid
    and montant = (v_calcul ->> 'montant')::integer
    and cree_le > now() - interval '15 minutes'
  order by cree_le desc limit 1;
  if found then
    return public.carte_paiement(v) || jsonb_build_object('repris', false);
  end if;

  insert into public.paiements (profil_id, formule_id, code_promo_id, prix_initial, remise, montant)
  values (v_uid, p_formule, (v_calcul ->> 'code_id')::uuid, (v_calcul ->> 'prix_initial')::integer,
          (v_calcul ->> 'remise')::integer, (v_calcul ->> 'montant')::integer)
  returning * into v;
  if v.montant = 0 then
    perform public.activer_paiement(v.id);
    select * into v from public.paiements where id = v.id;
  end if;
  return public.carte_paiement(v) || jsonb_build_object('repris', false);
end;
$$;

-- Activer un paiement réussi (dernière définition : 0049_abonnements_paiements.sql).
create or replace function public.activer_paiement(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.paiements%rowtype;
  v_duree integer;
  v_debut timestamptz;
begin
  select * into v from public.paiements where id = p_id for update;
  if not found or v.statut = 'reussi' then
    return;
  end if;
  update public.paiements
  set statut = 'reussi',
      motif_echec = null,
      confirme_le = now(),
      numero_recu = 'ET-R-' || to_char(now() at time zone 'Africa/Porto-Novo', 'YYYY') || '-' || lpad(nextval('public.numeros_recus')::text, 6, '0')
  where id = p_id;
  if v.profil_id is null then
    return;
  end if;
  -- Deux paiements du même compte confirmés en même temps : le second attend le premier, et s'enchaîne après (0053).
  perform pg_advisory_xact_lock(hashtext('etudium.abonnement.' || v.profil_id::text));
  select duree_mois into v_duree from public.formules where id = v.formule_id;
  v_debut := greatest(now(), coalesce(public.fin_abonnement(v.profil_id), now()));
  insert into public.abonnements (profil_id, formule_id, paiement_id, debut, fin)
  values (v.profil_id, v.formule_id, v.id, v_debut, public.fin_periode(v_debut, v_duree))
  on conflict (paiement_id) do nothing;
end;
$$;

-- Annuler un abonnement (dernière définition : 0051_paiements_equipe.sql).
create or replace function public.annuler_abonnement(p_abonnement uuid, p_motif text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_motif text := btrim(coalesce(p_motif, ''));
  v_profil uuid;
  v_debut timestamptz;
  v_fin timestamptz;
begin
  perform public.exiger_equipe_paiements();
  if char_length(v_motif) < 3 or char_length(v_motif) > 300 then
    raise exception 'Indiquez le motif (3 à 300 caractères).';
  end if;
  update public.abonnements
  set annule_le = now(), motif_annulation = v_motif
  where id = p_abonnement and annule_le is null
  returning profil_id, debut, fin into v_profil, v_debut, v_fin;
  if v_profil is null then
    raise exception 'Cet abonnement est déjà annulé.';
  end if;
  -- Les abonnements qui le suivaient avancent d'autant (0053) : pas de trou dans l'accès, et chacun garde sa durée.
  if v_fin > now() then
    update public.abonnements
    set debut = debut - (v_fin - greatest(now(), v_debut)), fin = fin - (v_fin - greatest(now(), v_debut))
    where profil_id = v_profil and annule_le is null and debut >= v_fin;
  end if;
  perform public.notifier(array[v_profil], 'service', 'Votre abonnement a été annulé', v_motif, '/abonnement');
end;
$$;

revoke execute on function public.noter_essai_code() from public, anon, authenticated;

commit;

-- ═══ 0054_abonnements_manuels.sql ═══
-- Migration 0054 : les abonnements attribués à la main au back-office (demande du 1er novembre 2026). Un paiement reçu
-- hors plateforme (Mobile Money sur le numéro de l'équipe, espèces, virement) ou un abonnement offert : l'administrateur
-- l'enregistre, l'accès s'ouvre aussitôt (à la suite de l'abonnement en cours), avec un reçu et une notification. Il peut
-- aussi résilier : tout l'accès s'arrête. Réservé aux administrateurs ; l'équipe voit. Rejouable.

begin;

-- ─── L'origine d'un paiement ────────────────────────────────────────────────────────────────────────
alter table public.paiements add column if not exists source text not null default 'payiz';
alter table public.paiements add column if not exists moyen_manuel text;
alter table public.paiements add column if not exists reference_manuelle text;
alter table public.paiements add column if not exists attribue_par uuid references public.profils (id) on delete set null;
alter table public.paiements drop constraint if exists paiements_source_valide;
alter table public.paiements add constraint paiements_source_valide check (
  source in ('payiz', 'manuel')
  and (moyen_manuel is null or moyen_manuel in ('mobile_money', 'especes', 'virement', 'offert'))
  and (source = 'manuel' or moyen_manuel is null)
);
-- Le minimum de Payiz (1 000 FCFA) ne vaut pas pour un montant reçu hors plateforme.
alter table public.paiements drop constraint if exists paiements_montant_check;
alter table public.paiements drop constraint if exists paiements_montant_valide;
alter table public.paiements add constraint paiements_montant_valide check (montant >= 0 and (source = 'manuel' or montant = 0 or montant >= 1000));

-- La carte d'un paiement, avec son origine (dernière définition : 0049_abonnements_paiements.sql).
create or replace function public.carte_paiement(p public.paiements)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p.id,
    'statut', p.statut,
    'formule', (select jsonb_build_object('code', f.code, 'nom', f.nom, 'duree_mois', f.duree_mois) from public.formules f where f.id = p.formule_id),
    'prix_initial', p.prix_initial,
    'remise', p.remise,
    'montant', p.montant,
    'code', (select c.code from public.codes_promo c where c.id = p.code_promo_id),
    'operateur', p.operateur,
    'telephone_masque', p.telephone_masque,
    'motif_echec', p.motif_echec,
    'numero_recu', p.numero_recu,
    'payiz_id', p.payiz_id,
    'source', p.source,
    'moyen_manuel', p.moyen_manuel,
    'reference_manuelle', p.reference_manuelle,
    'cree_le', p.cree_le,
    'essai_le', p.essai_le,
    'confirme_le', p.confirme_le,
    'abonnement', (select jsonb_build_object('debut', a.debut, 'fin', a.fin) from public.abonnements a where a.paiement_id = p.id)
  );
$$;

-- L'historique de l'étudiant : un paiement manuel y figure (dernière définition : 0049_abonnements_paiements.sql).
create or replace function public.mes_paiements()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(public.carte_paiement(p) order by p.cree_le desc, p.id), '[]'::jsonb)
  from public.paiements p
  where p.profil_id = (select auth.uid()) and not (p.source = 'payiz' and p.payiz_id is null and p.montant > 0);
$$;

-- Le reçu, avec le moyen et la référence d'un paiement manuel (dernière définition : 0049_abonnements_paiements.sql).
create or replace function public.recu(p_numero text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'numero', p.numero_recu,
    'date', p.confirme_le,
    'compte', jsonb_build_object('prenom', coalesce(pr.prenom, ''), 'nom', coalesce(pr.nom, '')),
    'formule', jsonb_build_object('nom', f.nom, 'duree_mois', f.duree_mois),
    'debut', a.debut,
    'fin', a.fin,
    'prix_initial', p.prix_initial,
    'remise', p.remise,
    'code', c.code,
    'montant', p.montant,
    'operateur', p.operateur,
    'telephone_masque', p.telephone_masque,
    'moyen_manuel', p.moyen_manuel,
    'reference_manuelle', p.reference_manuelle
  )
  from public.paiements p
  join public.formules f on f.id = p.formule_id
  left join public.profils pr on pr.id = p.profil_id
  left join public.abonnements a on a.paiement_id = p.id
  left join public.codes_promo c on c.id = p.code_promo_id
  where p.numero_recu = p_numero and p.statut = 'reussi'
    and (p.profil_id = (select auth.uid()) or public.equipe_contenus());
$$;

-- La liste du back-office, avec l'origine (dernière définition : 0051_paiements_equipe.sql).
create or replace function public.paiements_equipe(p_statut text, p_recherche text, p_page integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_q text := lower(btrim(coalesce(p_recherche, '')));
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_resultat jsonb;
begin
  perform public.exiger_equipe_moderation();
  with lignes as (
    select p.id, p.cree_le, p.montant, p.statut, p.operateur, p.telephone_masque, p.numero_recu, p.profil_id, p.source, p.moyen_manuel,
           coalesce(pr.prenom, '') as prenom, coalesce(pr.nom, '') as nom, coalesce(u.email, '') as email,
           f.code as formule_code, f.nom as formule_nom, f.duree_mois
    from public.paiements p
    join public.formules f on f.id = p.formule_id
    left join public.profils pr on pr.id = p.profil_id
    left join auth.users u on u.id = p.profil_id
    where not (p.source = 'payiz' and p.payiz_id is null and p.montant > 0)
      and case
        when coalesce(p_statut, '') = '' then true
        when p_statut = 'expire' then p.statut in ('expire', 'annule')
        else p.statut = p_statut
      end
      and (
        v_q = ''
        or strpos(lower(coalesce(p.numero_recu, '')), v_q) > 0
        or strpos(lower(coalesce(u.email, '')), v_q) > 0
        or strpos(public.sans_accents(coalesce(pr.prenom, '') || ' ' || coalesce(pr.nom, '')), public.sans_accents(v_q)) > 0
      )
  ),
  page as (
    select * from lignes order by cree_le desc, id limit 20 offset (v_page - 1) * 20
  )
  select jsonb_build_object(
    'total', (select count(*) from lignes),
    'lignes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', g.id,
        'cree_le', g.cree_le,
        'compte', jsonb_build_object('id', g.profil_id, 'prenom', g.prenom, 'nom', g.nom, 'email', g.email),
        'formule', jsonb_build_object('code', g.formule_code, 'nom', g.formule_nom, 'duree_mois', g.duree_mois),
        'montant', g.montant,
        'statut', g.statut,
        'operateur', g.operateur,
        'telephone_masque', g.telephone_masque,
        'numero_recu', g.numero_recu,
        'source', g.source,
        'moyen_manuel', g.moyen_manuel
      ) order by g.cree_le desc, g.id)
      from page g
    ), '[]'::jsonb)
  ) into v_resultat;
  return v_resultat;
end;
$$;

-- L'état d'un compte (la logique de mon_abonnement, 0049_abonnements_paiements.sql), pour le compte connecté comme pour la fiche du back-office.
create or replace function public.etat_abonnement(p_profil uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := p_profil;
  v_code text;
  v_nom text;
  v_fin timestamptz;
begin
  if v_uid is null then
    return jsonb_build_object('etat', 'gratuit');
  end if;
  select f.code, f.nom into v_code, v_nom
  from public.abonnements a join public.formules f on f.id = a.formule_id
  where a.profil_id = v_uid and a.annule_le is null and a.debut <= now() and now() < a.fin
  order by a.debut desc limit 1;
  if found then
    return jsonb_build_object('etat', 'actif', 'formule', jsonb_build_object('code', v_code, 'nom', v_nom), 'fin', public.fin_abonnement(v_uid));
  end if;
  select f.code, f.nom, a.fin into v_code, v_nom, v_fin
  from public.abonnements a join public.formules f on f.id = a.formule_id
  where a.profil_id = v_uid and a.annule_le is null and a.fin <= now()
  order by a.fin desc limit 1;
  if found then
    return jsonb_build_object('etat', 'expire', 'formule', jsonb_build_object('code', v_code, 'nom', v_nom), 'fin', v_fin);
  end if;
  return jsonb_build_object('etat', 'gratuit');
end;
$$;

create or replace function public.mon_abonnement()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when (select auth.uid()) is null then jsonb_build_object('etat', 'gratuit') else public.etat_abonnement((select auth.uid())) end;
$$;

-- ─── Attribuer ──────────────────────────────────────────────────────────────────────────────────────
create or replace function public.attribuer_abonnement(p_compte uuid, p_formule uuid, p_moyen text, p_montant integer, p_reference text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_formule public.formules%rowtype;
  v_reference text := nullif(btrim(coalesce(p_reference, '')), '');
  v_montant integer;
  v_prix integer;
  v public.paiements%rowtype;
begin
  perform public.exiger_equipe_paiements();
  if not exists (select 1 from public.profils where id = p_compte) then
    raise exception 'Compte inconnu.';
  end if;
  if exists (select 1 from public.roles r where r.profil_id = p_compte and r.role = 'formateur') then
    raise exception 'Un compte formateur n’a pas d’abonnement.';
  end if;
  select * into v_formule from public.formules where id = p_formule;
  if not found then
    raise exception 'Abonnement inconnu.';
  end if;
  if p_moyen is null or p_moyen not in ('mobile_money', 'especes', 'virement', 'offert') then
    raise exception 'Choisissez le moyen de paiement.';
  end if;
  if p_moyen = 'offert' then
    v_montant := 0;
  elsif p_montant is null or p_montant < 0 then
    raise exception 'Indiquez le montant reçu.';
  else
    v_montant := p_montant;
  end if;
  if char_length(coalesce(v_reference, '')) > 120 then
    raise exception 'La référence compte 120 caractères au plus.';
  end if;
  v_prix := coalesce(v_formule.prix_fcfa, v_montant);

  insert into public.paiements (profil_id, formule_id, prix_initial, remise, montant, source, moyen_manuel, reference_manuelle, attribue_par)
  values (p_compte, p_formule, v_prix, greatest(v_prix - v_montant, 0), v_montant, 'manuel', p_moyen, v_reference, (select auth.uid()))
  returning * into v;
  -- Le numéro de reçu et l'abonnement, à la suite de celui en cours (comme un paiement en ligne).
  perform public.activer_paiement(v.id);
  select * into v from public.paiements where id = v.id;

  perform public.notifier(
    array[p_compte], 'service', 'Votre abonnement ' || v_formule.nom || ' est actif',
    'Jusqu’au ' || public.date_longue(public.fin_abonnement(p_compte)) || '.', '/abonnement'
  );
  return public.carte_paiement(v);
end;
$$;

-- ─── Résilier : tout l'accès s'arrête (l'abonnement en cours et ceux qui suivent) ───────────────────
create or replace function public.resilier_abonnements(p_compte uuid, p_motif text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_motif text := btrim(coalesce(p_motif, ''));
  v_nombre integer;
begin
  perform public.exiger_equipe_paiements();
  if char_length(v_motif) < 3 or char_length(v_motif) > 300 then
    raise exception 'Indiquez le motif (3 à 300 caractères).';
  end if;
  update public.abonnements
  set annule_le = now(), motif_annulation = v_motif
  where profil_id = p_compte and annule_le is null and fin > now();
  get diagnostics v_nombre = row_count;
  if v_nombre = 0 then
    raise exception 'Ce compte n’a pas d’abonnement en cours.';
  end if;
  perform public.notifier(array[p_compte], 'service', 'Votre abonnement a été résilié', v_motif, '/abonnement');
  return v_nombre;
end;
$$;

-- ─── La fiche d'un compte au back-office : son état et ses abonnements ──────────────────────────────
create or replace function public.abonnements_compte(p_compte uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.exiger_equipe_moderation();
  return jsonb_build_object(
    'etat', public.etat_abonnement(p_compte),
    'abonnements', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id,
        'formule', jsonb_build_object('code', f.code, 'nom', f.nom, 'duree_mois', f.duree_mois),
        'debut', a.debut,
        'fin', a.fin,
        'annule_le', a.annule_le,
        'motif_annulation', a.motif_annulation,
        'paiement_id', p.id,
        'source', p.source,
        'moyen_manuel', p.moyen_manuel,
        'operateur', p.operateur,
        'montant', p.montant,
        'numero_recu', p.numero_recu
      ) order by a.debut desc)
      from public.abonnements a
      join public.formules f on f.id = a.formule_id
      join public.paiements p on p.id = a.paiement_id
      where a.profil_id = p_compte
    ), '[]'::jsonb)
  );
end;
$$;

revoke execute on function public.etat_abonnement(uuid) from public, anon, authenticated;
revoke execute on function public.attribuer_abonnement(uuid, uuid, text, integer, text) from public, anon, authenticated;
revoke execute on function public.resilier_abonnements(uuid, text) from public, anon, authenticated;
revoke execute on function public.abonnements_compte(uuid) from public, anon, authenticated;
grant execute on function public.attribuer_abonnement(uuid, uuid, text, integer, text) to authenticated;
grant execute on function public.resilier_abonnements(uuid, text) to authenticated;
grant execute on function public.abonnements_compte(uuid) to authenticated;

commit;

-- ═══ 0055_contenu_riche.sql ═══
-- Migration 0055 : le contenu riche des leçons (fin du lot 4, spec §1 ; demande du 1er novembre 2026). Le contenu d'une
-- leçon devient le document de l'éditeur (titres, listes, images, tableaux, blocs d'information, vidéos), vérifié par
-- l'application (liste fermée) ; la colonne `texte` garde le texte brut. Les images vivent dans un espace privé, au
-- dossier de la formation : l'équipe et le formateur de la formation y déposent ; elles se lisent par des liens signés,
-- pour qui a accès à au moins une leçon de la formation. Rejouable.

begin;

-- ─── Le document ────────────────────────────────────────────────────────────────────────────────────
-- Vide pour une leçon ancienne : son texte (Markdown restreint) s'affiche comme avant. 300 Ko au plus.
alter table public.lecons_contenus add column if not exists document jsonb;
alter table public.lecons_contenus drop constraint if exists lecons_contenus_document_valide;
alter table public.lecons_contenus add constraint lecons_contenus_document_valide
  check (document is null or (jsonb_typeof(document) = 'object' and octet_length(document::text) <= 307200));

-- ─── Espace « images_lecons » : privé, 5 Mo, images seulement ───────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('images_lecons', 'images_lecons', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Lire une image : l'équipe ; le formateur de la formation du dossier ; qui a accès à au moins une de ses leçons (une
-- image d'une version ancienne reste lisible : une leçon supprimée depuis ne la rend pas orpheline).
create or replace function public.lecture_images_formation(p_nom text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_dossier text := (storage.foldername(p_nom))[1];
  v_formation uuid;
begin
  if public.equipe_contenus() then
    return true;
  end if;
  if v_dossier is null or v_dossier !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  v_formation := v_dossier::uuid;
  return public.formateur_de(v_formation) or exists (
    select 1
    from public.lecons l
    join public.modules m on m.id = l.module_id
    where m.formation_id = v_formation and public.acces_lecon(l.id)
  );
end;
$$;
revoke execute on function public.lecture_images_formation(text) from public;
grant execute on function public.lecture_images_formation(text) to anon, authenticated;

drop policy if exists "images_lecons : lecture avec l'accès à la formation" on storage.objects;
create policy "images_lecons : lecture avec l'accès à la formation" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'images_lecons' and public.lecture_images_formation(name));

drop policy if exists "images_lecons : dépôt" on storage.objects;
create policy "images_lecons : dépôt" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'images_lecons' and ((select public.equipe_contenus()) or public.formateur_du_dossier(name)));

drop policy if exists "images_lecons : remplacement" on storage.objects;
create policy "images_lecons : remplacement" on storage.objects
  for update to authenticated
  using (bucket_id = 'images_lecons' and ((select public.equipe_contenus()) or public.formateur_du_dossier(name)))
  with check (bucket_id = 'images_lecons' and ((select public.equipe_contenus()) or public.formateur_du_dossier(name)));

drop policy if exists "images_lecons : suppression" on storage.objects;
create policy "images_lecons : suppression" on storage.objects
  for delete to authenticated
  using (bucket_id = 'images_lecons' and ((select public.equipe_contenus()) or public.formateur_du_dossier(name)));

-- ─── L'écran de correction : la consigne riche ──────────────────────────────────────────────────────
-- Même définition qu'en 0032, avec le document de la consigne en plus.
create or replace function public.rendu_a_corriger(p_rendu uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_r public.rendus_exercices;
begin
  select * into v_r from public.rendus_exercices r where r.id = p_rendu;
  if not found or not public.editeur_de_lecon(v_r.lecon_id) then
    return null;
  end if;
  return (
    select jsonb_build_object(
      'etudiant', coalesce(public.nom_du_profil(v_r.profil_id), 'Étudiant'),
      'exercice', jsonb_build_object(
        'id', l.id, 'titre', l.titre, 'genre', l.genre_exercice, 'consigne', coalesce(c.texte, ''), 'consigne_document', c.document
      ),
      'formation', jsonb_build_object('id', f.id, 'titre', f.titre, 'slug', f.slug),
      'module', jsonb_build_object('titre', m.titre, 'rang', public.rang_du_module(m.id)),
      'version', public.version_rendu(v_r),
      'derniere', not exists (
        select 1 from public.rendus_exercices r where r.lecon_id = v_r.lecon_id and r.profil_id = v_r.profil_id and r.version > v_r.version
      ),
      'historique', (
        select jsonb_agg(public.version_rendu(r) order by r.version desc)
        from public.rendus_exercices r
        where r.lecon_id = v_r.lecon_id and r.profil_id = v_r.profil_id
      ),
      'suivant', (
        select d.id
        from public.derniers_rendus d
        join public.lecons l2 on l2.id = d.lecon_id
        join public.modules m2 on m2.id = l2.module_id
        where d.statut = 'en_attente' and d.id <> v_r.id and (public.equipe_contenus() or public.formateur_de(m2.formation_id))
        order by d.cree_le
        limit 1
      )
    )
    from public.lecons l
    join public.modules m on m.id = l.module_id
    join public.formations f on f.id = m.formation_id
    left join public.lecons_contenus c on c.lecon_id = l.id
    where l.id = v_r.lecon_id
  );
end;
$$;
revoke execute on function public.rendu_a_corriger(uuid) from public, anon;
grant execute on function public.rendu_a_corriger(uuid) to authenticated;

commit;
