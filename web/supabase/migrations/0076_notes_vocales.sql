-- Migration 0076 : les notes vocales (spec du 4 novembre 2026, docs/superpowers/specs/2026-11-04-messagerie-deux-
-- volets-vocaux-design.md). Dans les messages privés (0035) comme dans les groupes (0075), on enregistre une note dans
-- le navigateur et on l'envoie comme un message.
--   - Une note vocale est une pièce jointe audio, rangée là où sont déjà les pièces jointes (messages.fichier ;
--     messages_groupes.image et ses colonnes) : elle en garde les règles de lecture, de suppression et de retrait. Elle
--     a en plus sa durée (duree_ms, de 0,5 s à 5 minutes) et son onde (ondes : 64 barres au plus, de 0 à 100), dessinée
--     dans la bulle.
--   - Les formats : ceux que les navigateurs enregistrent (MP4/AAC, WebM ou Ogg/Opus…), 10 Mo au plus. Une note ne
--     porte pas de texte, ne se modifie pas, et n'est pas analysée par l'IA (qui ne lit que le texte et les images) :
--     elle se signale comme un message.
--   - envoyer_message et envoyer_message_groupe reçoivent la durée et l'onde (paramètres facultatifs : l'appli d'avant
--     marche encore). Les lectures (fil, liste, réponse citée, notification, file de modération) disent « Note vocale ».
--   - Les espaces de fichiers « messages » et « groupes » acceptent les formats audio (« groupes » passe à 10 Mo ; les
--     images restent limitées à 5 Mo par envoyer_message_groupe).
-- À appliquer après la 0075. Rejouable.

begin;

-- ─── Les outils ─────────────────────────────────────────────────────────────────────────────────────
-- Ce que MediaRecorder enregistre selon le navigateur (Safari, Chrome et Edge récents : MP4/AAC ; Firefox : WebM ou Ogg).
create or replace function public.formats_vocaux()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['audio/mp4', 'audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/aac'];
$$;

-- Une note vocale valide : de 0,5 s à 5 minutes ; une onde de 64 barres au plus, chacune de 0 à 100.
create or replace function public.note_vocale_valide(p_duree_ms integer, p_ondes integer[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_duree_ms between 500 and 300000
     and coalesce(array_length(p_ondes, 1), 0) <= 64
     and not exists (select 1 from unnest(coalesce(p_ondes, '{}'::integer[])) o where o is null or o < 0 or o > 100);
$$;

-- « 0:07 », « 1:42 », « 5:00 ».
create or replace function public.duree_vocale(p_duree_ms integer)
returns text
language sql
immutable
set search_path = ''
as $$
  select (round(p_duree_ms / 1000.0)::int / 60)::text || ':' || lpad((round(p_duree_ms / 1000.0)::int % 60)::text, 2, '0');
$$;

-- ─── Les colonnes ───────────────────────────────────────────────────────────────────────────────────
alter table public.messages add column if not exists duree_ms integer;
alter table public.messages add column if not exists ondes smallint[];
alter table public.messages drop constraint if exists messages_vocal;
alter table public.messages add constraint messages_vocal
  check (duree_ms is null or (duree_ms between 500 and 300000 and fichier is not null and texte = ''));

alter table public.messages_groupes add column if not exists duree_ms integer;
alter table public.messages_groupes add column if not exists ondes smallint[];
alter table public.messages_groupes drop constraint if exists messages_groupes_vocal;
alter table public.messages_groupes add constraint messages_groupes_vocal
  check (duree_ms is null or (duree_ms between 500 and 300000 and texte = ''));

-- ─── Les messages privés ────────────────────────────────────────────────────────────────────────────
-- message_json : dernière définition en 0035_messagerie.sql ; + « vocal » (chemin, durée et onde : le serveur de l'appli
-- signe le lien d'écoute avec la session du participant).
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
    'vocal', case when p_message.fichier is not null and p_message.duree_ms is not null
      then jsonb_build_object('chemin', p_message.fichier, 'duree_ms', p_message.duree_ms, 'ondes', coalesce(to_jsonb(p_message.ondes), '[]'::jsonb)) end,
    'de_moi', p_message.de_etudiant = (p_cote = 'etudiant'),
    'auteur', case when p_cote = 'equipe' and not p_message.de_etudiant and p_message.auteur_id is distinct from (select auth.uid())
      then coalesce(public.nom_du_profil(p_message.auteur_id), 'Équipe Étudium') end,
    'cree_le', p_message.cree_le
  );
$$;

-- resume_conversation : dernière définition en 0035_messagerie.sql ; + « vocal » (la durée) dans le dernier message.
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
      select jsonb_build_object(
        'texte', m.texte, 'fichier', nullif(m.nom_fichier, ''), 'vocal', m.duree_ms,
        'de_moi', m.de_etudiant = (p_cote = 'etudiant'), 'cree_le', m.cree_le)
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

-- envoyer_message : dernière définition en 0035_messagerie.sql ; + la note vocale (p_duree_ms, p_ondes). Changer ses
-- paramètres demande de la recréer (droits compris) : les quatre premiers ne changent pas, l'appli d'avant marche encore.
drop function if exists public.envoyer_message(uuid, text, text, text);
create or replace function public.envoyer_message(
  p_conversation uuid,
  p_texte text,
  p_fichier text default null,
  p_nom text default null,
  p_duree_ms integer default null,
  p_ondes integer[] default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_cote text := public.cote_conversation(p_conversation);
  v_texte text := btrim(coalesce(p_texte, ''));
  v_vocal boolean := p_duree_ms is not null;
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
  if v_vocal then
    if p_fichier is null then
      raise exception 'Cette note vocale n’a pas été reçue. Enregistrez-la à nouveau.';
    end if;
    if v_texte <> '' then
      raise exception 'Une note vocale ne porte pas de texte.';
    end if;
    if not public.note_vocale_valide(p_duree_ms, p_ondes) then
      raise exception 'Une note vocale dure de 1 seconde à 5 minutes.';
    end if;
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
    if v_format is null or not (v_format = any (case when v_vocal then public.formats_vocaux() else public.formats_rendu() end)) then
      raise exception 'Ce format n’est pas accepté.';
    end if;
    if coalesce(v_taille, 0) > 10485760 then
      raise exception 'Le fichier dépasse 10 Mo.';
    end if;
    v_nom := case when v_vocal then 'Note vocale' else coalesce(nullif(left(btrim(coalesce(p_nom, '')), 200), ''), 'fichier') end;
  end if;

  insert into public.messages (conversation_id, auteur_id, de_etudiant, texte, fichier, nom_fichier, format, taille_octets, duree_ms, ondes)
  values (
    p_conversation, v_uid, v_cote = 'etudiant', v_texte, p_fichier, v_nom, coalesce(v_format, ''), coalesce(v_taille, 0),
    case when v_vocal then p_duree_ms end, case when v_vocal then coalesce(p_ondes, '{}'::integer[])::smallint[] end
  )
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
    case
      when v_vocal then 'Note vocale (' || public.duree_vocale(p_duree_ms) || ')'
      when v_texte <> '' then left(v_texte, 140)
      else 'Pièce jointe : ' || v_nom
    end,
    v_lien
  );
  return public.message_json(v_message, v_cote);
end;
$$;

-- Privé, 10 Mo : les formats des rendus (0035) et ceux des notes vocales.
update storage.buckets set allowed_mime_types = public.formats_rendu() || public.formats_vocaux() where id = 'messages';

-- ─── Les groupes ────────────────────────────────────────────────────────────────────────────────────
-- message_groupe_json : dernière définition en 0075_groupes.sql ; une note vocale sort en « vocal » (et non en
-- « image »), la réponse citée dit si c'en est une.
create or replace function public.message_groupe_json(m public.messages_groupes)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', m.id,
    'groupe_id', m.groupe_id,
    'auteur', jsonb_build_object(
      'id', m.auteur_id,
      'prenom', coalesce(pr.prenom, ''),
      'nom', coalesce(pr.nom, ''),
      'photo', pr.photo_url,
      'badge', public.role_communaute(m.auteur_id)
    ),
    'de_moi', m.auteur_id = (select auth.uid()),
    'texte', case when m.supprime_le is null and m.moderation = 'visible' then m.texte else '' end,
    'image', case when m.supprime_le is null and m.moderation = 'visible' and m.image is not null and m.duree_ms is null
      then jsonb_build_object('chemin', m.image, 'type', m.image_type) end,
    'vocal', case when m.supprime_le is null and m.moderation = 'visible' and m.image is not null and m.duree_ms is not null
      then jsonb_build_object('chemin', m.image, 'type', m.image_type, 'duree_ms', m.duree_ms, 'ondes', coalesce(to_jsonb(m.ondes), '[]'::jsonb)) end,
    'reponse', (
      select jsonb_build_object(
        'id', c.id,
        'auteur', jsonb_build_object('prenom', coalesce(pc.prenom, ''), 'nom', coalesce(pc.nom, '')),
        'texte', case when c.supprime_le is null and c.moderation = 'visible' then left(c.texte, 140) else '' end,
        'image', c.supprime_le is null and c.moderation = 'visible' and c.image is not null and c.duree_ms is null,
        'vocal', c.supprime_le is null and c.moderation = 'visible' and c.image is not null and c.duree_ms is not null,
        'supprime', c.supprime_le is not null or c.moderation <> 'visible'
      )
      from public.messages_groupes c
      left join public.profils pc on pc.id = c.auteur_id
      where c.id = m.reponse_a
    ),
    'cree_le', m.cree_le,
    'modifie_le', m.modifie_le,
    'supprime', m.supprime_le is not null,
    'retire', m.supprime_le is null and m.moderation <> 'visible',
    'reactions', case when m.supprime_le is null and m.moderation = 'visible' then public.reactions_message_groupe(m.id) else '[]'::jsonb end,
    'epingle', m.supprime_le is null and m.moderation = 'visible'
      and exists (select 1 from public.groupes g where g.id = m.groupe_id and g.epingle_id = m.id)
  )
  from (select 1) as un
  left join public.profils pr on pr.id = m.auteur_id;
$$;

-- resume_groupe : dernière définition en 0075_groupes.sql ; + « vocal » (la durée) dans le dernier message.
create or replace function public.resume_groupe(g public.groupes)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', g.id,
    'slug', g.slug,
    'nom', g.nom,
    'type', public.type_groupe(g),
    'couleur', public.couleur_groupe(g),
    'actif', g.actif,
    'non_lus', case when g.actif then public.non_lus_groupe(g.id, (select auth.uid())) else 0 end,
    'coupe', exists (select 1 from public.groupes_coupes c where c.groupe_id = g.id and c.profil_id = (select auth.uid())),
    'dernier', (
      select jsonb_build_object(
        'id', m.id,
        'auteur', jsonb_build_object('prenom', coalesce(pr.prenom, ''), 'nom', coalesce(pr.nom, '')),
        'de_moi', m.auteur_id = (select auth.uid()),
        'texte', case when m.supprime_le is null and m.moderation = 'visible' then left(m.texte, 140) else '' end,
        'image', m.supprime_le is null and m.moderation = 'visible' and m.image is not null and m.duree_ms is null,
        'vocal', case when m.supprime_le is null and m.moderation = 'visible' and m.image is not null then m.duree_ms end,
        'supprime', m.supprime_le is not null,
        'retire', m.supprime_le is null and m.moderation <> 'visible',
        'cree_le', m.cree_le
      )
      from public.messages_groupes m
      left join public.profils pr on pr.id = m.auteur_id
      where m.groupe_id = g.id
      order by m.cree_le desc, m.id desc
      limit 1
    )
  );
$$;

-- envoyer_message_groupe : dernière définition en 0075_groupes.sql ; + la note vocale (p_duree_ms, p_ondes), rangée
-- dans les colonnes de la pièce jointe. Pas d'analyse automatique pour une note (l'IA ne lit que le texte et les
-- images). Recréée pour ses nouveaux paramètres, droits compris.
drop function if exists public.envoyer_message_groupe(uuid, text, text, uuid);
create or replace function public.envoyer_message_groupe(
  p_groupe uuid,
  p_texte text,
  p_image text default null,
  p_reponse_a uuid default null,
  p_duree_ms integer default null,
  p_ondes integer[] default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_groupe public.groupes%rowtype;
  v_texte text := regexp_replace(coalesce(p_texte, ''), '^\s+|\s+$', '', 'g');
  v_vocal boolean := p_duree_ms is not null;
  v_type text;
  v_taille bigint;
  v_cible public.messages_groupes%rowtype;
  v_message public.messages_groupes%rowtype;
  v_nom text;
begin
  perform public.exiger_compte_actif();
  select * into v_groupe from public.groupes where id = p_groupe;
  if not found or not public.peut_lire_groupe(p_groupe) then
    raise exception 'Ce groupe ne vous est pas ouvert.' using errcode = '42501';
  end if;
  if not v_groupe.actif then
    raise exception 'Ce groupe est désactivé.';
  end if;
  if char_length(v_texte) > 2000 then
    raise exception 'Votre message dépasse 2 000 caractères.';
  end if;
  if v_texte = '' and p_image is null then
    raise exception 'Écrivez un message ou ajoutez une image.';
  end if;
  if v_vocal then
    if p_image is null then
      raise exception 'Cette note vocale n’a pas été reçue. Enregistrez-la à nouveau.';
    end if;
    if v_texte <> '' then
      raise exception 'Une note vocale ne porte pas de texte.';
    end if;
    if not public.note_vocale_valide(p_duree_ms, p_ondes) then
      raise exception 'Une note vocale dure de 1 seconde à 5 minutes.';
    end if;
  end if;
  if (select count(*) from public.messages_groupes m where m.auteur_id = v_uid and m.cree_le > now() - interval '1 minute') >= 20 then
    raise exception 'Vous envoyez beaucoup de messages. Patientez une minute avant d’écrire de nouveau.';
  end if;
  if p_image is not null then
    select o.metadata ->> 'mimetype', (o.metadata ->> 'size')::bigint into v_type, v_taille
    from storage.objects o
    where o.bucket_id = 'groupes' and o.name = p_image and (storage.foldername(o.name))[1] = v_uid::text;
    if not found or exists (select 1 from public.messages_groupes m where m.image = p_image) then
      raise exception '%', case when v_vocal then 'Cette note vocale n’a pas été reçue. Enregistrez-la à nouveau.' else 'Cette image n’a pas été reçue. Ajoutez-la de nouveau.' end;
    end if;
    if v_vocal then
      if v_type is null or not (v_type = any (public.formats_vocaux())) then
        raise exception 'Ce format de note vocale n’est pas accepté.';
      end if;
      if coalesce(v_taille, 0) > 10485760 then
        raise exception 'La note vocale dépasse 10 Mo.';
      end if;
    else
      if v_type is null or v_type not in ('image/jpeg', 'image/png', 'image/webp') then
        raise exception 'L’image doit être au format JPEG, PNG ou WebP.';
      end if;
      if coalesce(v_taille, 0) > 5242880 then
        raise exception 'L’image dépasse 5 Mo.';
      end if;
    end if;
  end if;
  if p_reponse_a is not null then
    select * into v_cible from public.messages_groupes where id = p_reponse_a;
    if not found or v_cible.groupe_id <> p_groupe or v_cible.supprime_le is not null or v_cible.moderation <> 'visible' then
      raise exception 'Ce message n’existe plus.';
    end if;
  end if;

  insert into public.messages_groupes (groupe_id, auteur_id, texte, image, image_type, image_taille, reponse_a, analyse_attendue, duree_ms, ondes)
  values (
    p_groupe, v_uid, v_texte, p_image, case when p_image is not null then v_type end, case when p_image is not null then v_taille end,
    p_reponse_a, public.moderation_active() and not v_vocal,
    case when v_vocal then p_duree_ms end, case when v_vocal then coalesce(p_ondes, '{}'::integer[])::smallint[] end
  )
  returning * into v_message;
  -- Écrire, c'est avoir lu jusque-là.
  perform public.avancer_lecture_groupe(p_groupe, v_uid, v_message.id, v_message.cree_le);

  -- L'auteur du message cité est prévenu : pas soi-même, ni s'il a coupé le groupe.
  if v_cible.id is not null and v_cible.auteur_id <> v_uid
     and not exists (select 1 from public.groupes_coupes c where c.groupe_id = p_groupe and c.profil_id = v_cible.auteur_id) then
    select public.nom_avis(p.prenom, p.nom) into v_nom from public.profils p where p.id = v_uid;
    perform public.notifier(
      array[v_cible.auteur_id], 'communaute',
      'Nouvelle réponse dans le groupe ' || v_groupe.nom,
      coalesce(v_nom, 'Un membre') || ' a répondu à votre message : « '
        || case when v_vocal then 'Note vocale' else public.extrait_message_groupe(v_message.texte, v_message.image is not null) end || ' »',
      public.lien_groupe(v_cible.auteur_id, v_groupe.slug, v_message.id),
      false
    );
  end if;
  return public.message_groupe_json(v_message) || jsonb_build_object('analyser', v_message.analyse_attendue, 'version', v_message.version, 'groupe_nom', v_groupe.nom);
end;
$$;

-- modifier_message_groupe : dernière définition en 0075_groupes.sql ; une note vocale ne se modifie pas.
create or replace function public.modifier_message_groupe(p_message uuid, p_texte text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.messages_groupes%rowtype;
  v_texte text := regexp_replace(coalesce(p_texte, ''), '^\s+|\s+$', '', 'g');
begin
  perform public.exiger_compte_actif();
  select * into v from public.messages_groupes where id = p_message for update;
  if not found or not public.peut_lire_groupe(v.groupe_id) or v.supprime_le is not null or v.moderation <> 'visible' then
    raise exception 'Ce message n’existe plus.';
  end if;
  if v.auteur_id <> (select auth.uid()) then
    raise exception 'Ce message n’est pas le vôtre.' using errcode = '42501';
  end if;
  if v.duree_ms is not null then
    raise exception 'Une note vocale ne se modifie pas.';
  end if;
  if not (select g.actif from public.groupes g where g.id = v.groupe_id) then
    raise exception 'Ce groupe est désactivé.';
  end if;
  if now() - v.cree_le > interval '15 minutes' then
    raise exception 'Ce message ne peut plus être modifié : 15 minutes sont passées.';
  end if;
  if char_length(v_texte) > 2000 then
    raise exception 'Votre message dépasse 2 000 caractères.';
  end if;
  if v_texte = '' and v.image is null then
    raise exception 'Écrivez un message ou ajoutez une image.';
  end if;
  if v_texte = v.texte then
    return public.message_groupe_json(v) || jsonb_build_object('analyser', false, 'version', v.version, 'groupe_nom', (select g.nom from public.groupes g where g.id = v.groupe_id));
  end if;
  update public.messages_groupes
  set texte = v_texte, modifie_le = now(), version = version + 1, analyse_attendue = public.moderation_active()
  where id = p_message
  returning * into v;
  return public.message_groupe_json(v) || jsonb_build_object('analyser', v.analyse_attendue, 'version', v.version, 'groupe_nom', (select g.nom from public.groupes g where g.id = v.groupe_id));
end;
$$;

-- element_message_groupe : dernière définition en 0075_groupes.sql ; la note vocale paraît dans la file de modération
-- comme une pièce jointe « Note vocale (0:12) », que l'équipe écoute avant de garder ou de supprimer.
create or replace function public.element_message_groupe(m public.messages_groupes)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with s as (select * from public.signalements where traite_le is null and message_groupe_id = m.id)
  select jsonb_build_object(
    'type', 'message_groupe',
    'id', m.id,
    'publication_id', null,
    'lien', '/groupes/' || g.slug || '?message=' || m.id,
    'espace', jsonb_build_object('id', null, 'nom', g.nom),
    'auteur', jsonb_build_object('id', m.auteur_id, 'prenom', coalesce(pr.prenom, ''), 'nom', coalesce(pr.nom, '')),
    'cree_le', m.cree_le,
    'titre', '',
    'texte', m.texte,
    'piece_jointe', case when m.image is not null
      then jsonb_build_object(
        'chemin', m.image,
        'nom', case when m.duree_ms is not null then 'Note vocale (' || public.duree_vocale(m.duree_ms) || ')' else 'Image' end,
        'type', coalesce(m.image_type, 'image/jpeg'),
        'taille', coalesce(m.image_taille, 0)) end,
    'statut', case when m.moderation = 'bloque' then 'bloquee' else 'publiee' end,
    'analyse', coalesce(m.verdict, case when m.analyse_attendue
      then jsonb_build_object('decision', 'echec', 'categorie', 'aucune', 'raison', 'Analyse automatique non reçue.') end),
    'extrait', (
      select left(coalesce(nullif(c.texte, ''), case when c.duree_ms is not null then 'Note vocale' else 'Image' end), 140)
      from public.messages_groupes c
      where c.id = m.reponse_a and c.supprime_le is null and c.moderation = 'visible'
    ),
    'signalements', jsonb_build_object(
      'nombre', (select count(*)::int from s),
      'motifs', coalesce((
        select jsonb_agg(jsonb_build_object('motif', x.motif, 'nombre', x.n) order by x.n desc, x.motif)
        from (select motif, count(*)::int as n from s group by motif) x
      ), '[]'::jsonb),
      'details', coalesce((
        select jsonb_agg(jsonb_build_object('motif', s.motif, 'precisions', s.precisions, 'par', public.nom_avis(p2.prenom, p2.nom), 'le', s.cree_le) order by s.cree_le, s.id)
        from s join public.profils p2 on p2.id = s.auteur
      ), '[]'::jsonb)
    )
  )
  from public.groupes g
  left join public.profils pr on pr.id = m.auteur_id
  where g.id = m.groupe_id;
$$;

-- Privé, 10 Mo : les images (5 Mo au plus, vérifié à l'envoi) et les notes vocales.
update storage.buckets
set file_size_limit = 10485760,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'] || public.formats_vocaux()
where id = 'groupes';

-- ─── Droits ─────────────────────────────────────────────────────────────────────────────────────────
revoke execute on function public.formats_vocaux() from public, anon, authenticated;
revoke execute on function public.note_vocale_valide(integer, integer[]) from public, anon, authenticated;
revoke execute on function public.duree_vocale(integer) from public, anon, authenticated;
revoke execute on function public.message_json(public.messages, text) from public, anon, authenticated;
revoke execute on function public.resume_conversation(public.conversations, text) from public, anon, authenticated;
revoke execute on function public.message_groupe_json(public.messages_groupes) from public, anon, authenticated;
revoke execute on function public.resume_groupe(public.groupes) from public, anon, authenticated;
revoke execute on function public.element_message_groupe(public.messages_groupes) from public, anon, authenticated;
revoke execute on function public.envoyer_message(uuid, text, text, text, integer, integer[]) from public, anon;
grant execute on function public.envoyer_message(uuid, text, text, text, integer, integer[]) to authenticated;
revoke execute on function public.envoyer_message_groupe(uuid, text, text, uuid, integer, integer[]) from public, anon;
grant execute on function public.envoyer_message_groupe(uuid, text, text, uuid, integer, integer[]) to authenticated;
revoke execute on function public.modifier_message_groupe(uuid, text) from public, anon;
grant execute on function public.modifier_message_groupe(uuid, text) to authenticated;

commit;
