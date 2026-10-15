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
    -- Ses notifications de cette conversation sont lues (pour l'équipe : celles de tous ses membres).
    update public.notifications n set lue_le = now()
    where n.categorie = 'messages' and n.lue_le is null
      and n.lien like '%?c=' || p_conversation::text
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
    v_auteur := coalesce(public.nom_du_profil(v_uid), 'Un étudiant');
    if v_conversation.formateur_id is null then
      v_destinataires := public.membres_equipe();
      v_titre := 'Nouvelle demande d’assistance de ' || v_auteur;
      v_lien := '/admin/messages?c=' || p_conversation::text;
    else
      v_destinataires := array[v_conversation.formateur_id];
      v_titre := 'Nouveau message de ' || v_auteur;
      v_lien := '/formateur/messages?c=' || p_conversation::text;
    end if;
  else
    v_auteur := case when v_cote = 'equipe' then 'Équipe Étudium' else coalesce(public.nom_du_formateur(v_uid), 'Votre formateur') end;
    v_destinataires := array[v_conversation.etudiant_id];
    v_titre := 'Nouveau message de ' || v_auteur;
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
-- Ses conversations (comme étudiant ou formateur) partent, des deux côtés, avec tous leurs fichiers : ils sont rendus
-- pour être effacés de l'espace « messages ». Ceux de l'autre personne sont notés dans `messages_fichiers_a_effacer`,
-- ce qui permet à l'appelant, et à lui seul, de les effacer. Ceux qu'il a joints à l'assistance comme membre de
-- l'équipe sont détachés et rendus aussi.
create table if not exists public.messages_fichiers_a_effacer (
  chemin text primary key,
  par uuid not null references public.profils (id) on delete cascade
);
alter table public.messages_fichiers_a_effacer enable row level security;
revoke all on public.messages_fichiers_a_effacer from public, anon, authenticated;

create or replace function public.oublier_mes_messages()
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_chemins text[];
begin
  if v_uid is null then
    return '{}';
  end if;
  select coalesce(array_agg(m.fichier), '{}') into v_chemins
  from public.messages m
  join public.conversations c on c.id = m.conversation_id
  where m.fichier is not null
    and (c.etudiant_id = v_uid or c.formateur_id = v_uid or (storage.foldername(m.fichier))[1] = v_uid::text);
  insert into public.messages_fichiers_a_effacer (chemin, par)
  select f, v_uid from unnest(v_chemins) f where (storage.foldername(f))[1] <> v_uid::text
  on conflict (chemin) do update set par = excluded.par;
  delete from public.conversations where etudiant_id = v_uid or formateur_id = v_uid;
  delete from public.messages where fichier = any (v_chemins) and texte = '';
  update public.messages set fichier = null, nom_fichier = '', format = '', taille_octets = 0 where fichier = any (v_chemins);
  return v_chemins;
end;
$$;

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

-- Un fichier de l'autre personne, noté par `oublier_mes_messages` quand l'appelant supprime son compte.
create or replace function public.message_a_effacer(p_nom text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.messages_fichiers_a_effacer a where a.chemin = p_nom and a.par = (select auth.uid()));
$$;

-- Privé, 10 Mo, les formats des rendus. Chacun dépose et supprime dans son dossier (« <compte>/… ») ; on lit le sien,
-- ou un fichier joint à une conversation dont on est participant. Qui supprime son compte lit et efface aussi les
-- fichiers que l'autre personne avait joints à leurs conversations (le stockage n'efface que ce qu'on peut lire).
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
    and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.message_a_effacer(objects.name)))
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
revoke execute on function public.oublier_mes_messages() from public, anon;
grant execute on function public.oublier_mes_messages() to authenticated;

commit;
