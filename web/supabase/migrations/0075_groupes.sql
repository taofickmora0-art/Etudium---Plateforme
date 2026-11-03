-- Migration 0075 : les groupes de discussion en direct (spec du 3 novembre 2026, docs/superpowers/specs/2026-11-03-groupes-
-- discussion-design.md). Comme un groupe WhatsApp, dans le site : la messagerie privée ne change pas, les groupes sont
-- l'endroit où les étudiants échangent entre eux.
--   - Les groupes : « Général », un par parcours (créé, renommé et désactivé avec lui, par un déclencheur sur parcours)
--     et, activé un par un par le formateur de la formation ou l'équipe des contenus, un par formation (nom : son titre ;
--     désactivé par défaut ; le désactiver le cache aux étudiants sans effacer ses messages). Chacun a une adresse
--     /groupes/<slug>.
--   - Qui lit et écrit (peut_lire_groupe) : le Général, tout compte connecté non suspendu ; le groupe d'un parcours,
--     l'équipe, les abonnés, le formateur d'une formation du parcours et les inscrits d'une formation du parcours ; le
--     groupe d'une formation, ses inscrits, son formateur et l'équipe (pas les abonnés non inscrits). peut_lire_espace
--     (la communauté) suit désormais les inscriptions (0069), et non plus les leçons ouvertes.
--   - Les messages : 2 000 caractères, une image facultative (espace de fichiers privé « groupes », 5 Mo, JPEG, PNG ou
--     WebP), une réponse citée, modifiables 15 minutes par leur auteur, supprimés par lui (« Message supprimé » reste),
--     ou par le formateur et l'équipe du groupe. 20 messages par minute et par compte. Réactions (6 emojis), un message
--     épinglé par groupe, lectures (non-lus), groupes coupés.
--   - Une notification (catégorie « communaute ») quand quelqu'un répond à votre message, sauf si vous avez coupé le
--     groupe ou que vous vous répondez à vous-même.
--   - Le temps réel (diffuser, 0044) sur le sujet privé « groupe:<id> » : « message » à chaque message ajouté,
--     « changement » à chaque modification, suppression, réaction ou épingle. Rien du contenu n'y passe : la page relit.
--   - La modération : signalements (signaler_message_groupe) dans la file de l'équipe, avec « Garder » et
--     « Supprimer » ; analyse automatique active, le message paraît tout de suite, puis le serveur l'analyse et transmet
--     le verdict (verdict_message_groupe, avec le jeton de modération, comme publier en 0020) : bloqué, il est retiré
--     (« Message retiré par la modération »), son auteur est prévenu et il entre dans « Bloquées ».
-- À appliquer après la 0074 (elle n'en dépend pas). Rejouable.

begin;

-- ─── Les groupes ────────────────────────────────────────────────────────────────────────────────────
-- Un seul des deux rattachements au plus : aucun, c'est le Général. Fermée aux comptes : tout passe par les fonctions.
create table if not exists public.groupes (
  id uuid primary key default gen_random_uuid(),
  parcours_id uuid references public.parcours (id) on delete cascade,
  formation_id uuid references public.formations (id) on delete cascade,
  slug text not null,
  nom text not null,
  -- Le groupe d'un parcours suit le parcours ; celui d'une formation, le réglage de son formateur ou de l'équipe.
  actif boolean not null default true,
  -- Le message épinglé (un par groupe ; clé étrangère ajoutée plus bas, la table des messages n'existant pas encore).
  epingle_id uuid,
  epingle_par uuid references public.profils (id) on delete set null,
  epingle_le timestamptz,
  cree_le timestamptz not null default now(),
  constraint groupes_slug_unique unique (slug),
  constraint groupes_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint groupes_un_rattachement check (num_nonnulls(parcours_id, formation_id) <= 1)
);
create unique index if not exists groupes_parcours_unique on public.groupes (parcours_id) where parcours_id is not null;
create unique index if not exists groupes_formation_unique on public.groupes (formation_id) where formation_id is not null;
create unique index if not exists groupes_general_unique on public.groupes ((true)) where parcours_id is null and formation_id is null;
alter table public.groupes enable row level security;
revoke all on public.groupes from anon, authenticated;

-- ─── Les messages ───────────────────────────────────────────────────────────────────────────────────
-- moderation : « visible » ; « bloque » (retiré par l'analyse automatique : son texte reste pour l'équipe, qui peut le
-- rétablir) ; « retire » (retiré par l'équipe : texte et image effacés). Supprimé par son auteur ou un modérateur du
-- groupe : supprime_le, texte et image effacés, « Message supprimé » reste dans le fil.
create table if not exists public.messages_groupes (
  id uuid primary key default gen_random_uuid(),
  groupe_id uuid not null references public.groupes (id) on delete cascade,
  auteur_id uuid not null references public.profils (id) on delete cascade,
  texte text not null default '',
  -- Le chemin dans l'espace « groupes » (« <compte>/<nom>.jpg »), son type et sa taille ; null sans image.
  image text,
  image_type text,
  image_taille bigint,
  reponse_a uuid references public.messages_groupes (id) on delete set null,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz,
  -- Chaque modification change de version : le verdict d'une version dépassée est ignoré.
  version integer not null default 1,
  supprime_le timestamptz,
  supprime_par uuid references public.profils (id) on delete set null,
  moderation text not null default 'visible',
  verdict jsonb,
  -- L'analyse automatique était active à l'envoi (ou à la modification) et son verdict n'est pas encore arrivé.
  analyse_attendue boolean not null default false,
  -- Signalé par l'analyse (ou analyse impossible) : dans la file de l'équipe.
  a_examiner boolean not null default false,
  constraint messages_groupes_texte check (char_length(texte) <= 2000),
  constraint messages_groupes_moderation check (moderation in ('visible', 'bloque', 'retire')),
  constraint messages_groupes_contenu check (texte <> '' or image is not null or supprime_le is not null or moderation = 'retire')
);
create index if not exists messages_groupes_fil_idx on public.messages_groupes (groupe_id, cree_le desc, id desc);
create index if not exists messages_groupes_auteur_idx on public.messages_groupes (auteur_id, cree_le);
create index if not exists messages_groupes_reponse_idx on public.messages_groupes (reponse_a) where reponse_a is not null;
create unique index if not exists messages_groupes_image_unique on public.messages_groupes (image) where image is not null;
create index if not exists messages_groupes_examen_idx on public.messages_groupes (cree_le) where a_examiner or analyse_attendue or moderation = 'bloque';
alter table public.messages_groupes enable row level security;
revoke all on public.messages_groupes from anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'groupes_epingle_fk') then
    alter table public.groupes add constraint groupes_epingle_fk foreign key (epingle_id) references public.messages_groupes (id) on delete set null;
  end if;
end;
$$;

-- Les six réactions, dans leur ordre d'affichage.
create or replace function public.reactions_groupes()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['👍', '❤️', '😂', '😮', '😢', '🙏'];
$$;

-- Une réaction par compte et par emoji.
create table if not exists public.reactions_messages_groupes (
  message_id uuid not null references public.messages_groupes (id) on delete cascade,
  profil_id uuid not null references public.profils (id) on delete cascade,
  emoji text not null,
  cree_le timestamptz not null default now(),
  primary key (message_id, profil_id, emoji),
  constraint reactions_groupes_emoji check (emoji = any (public.reactions_groupes()))
);
create index if not exists reactions_groupes_profil_idx on public.reactions_messages_groupes (profil_id);

-- Le dernier message lu, par compte et par groupe (les non-lus se comptent à partir de là).
create table if not exists public.lectures_groupes (
  groupe_id uuid not null references public.groupes (id) on delete cascade,
  profil_id uuid not null references public.profils (id) on delete cascade,
  lu_le timestamptz not null,
  message_id uuid references public.messages_groupes (id) on delete set null,
  primary key (groupe_id, profil_id)
);
create index if not exists lectures_groupes_profil_idx on public.lectures_groupes (profil_id);

-- « Couper les notifications » : plus de notification de réponse pour ce groupe.
create table if not exists public.groupes_coupes (
  groupe_id uuid not null references public.groupes (id) on delete cascade,
  profil_id uuid not null references public.profils (id) on delete cascade,
  coupe_le timestamptz not null default now(),
  primary key (groupe_id, profil_id)
);
create index if not exists groupes_coupes_profil_idx on public.groupes_coupes (profil_id);

-- L'image d'un message supprimé ou retiré : notée pour qui l'a supprimé, qui l'efface ensuite du stockage avec sa
-- session (le stockage n'efface que ce qu'on peut lire). Sans clé étrangère : la note survit au message.
create table if not exists public.images_groupes_a_effacer (
  chemin text primary key,
  par uuid not null,
  note_le timestamptz not null default now()
);

alter table public.reactions_messages_groupes enable row level security;
alter table public.lectures_groupes enable row level security;
alter table public.groupes_coupes enable row level security;
alter table public.images_groupes_a_effacer enable row level security;
revoke all on public.reactions_messages_groupes from anon, authenticated;
revoke all on public.lectures_groupes from anon, authenticated;
revoke all on public.groupes_coupes from anon, authenticated;
revoke all on public.images_groupes_a_effacer from public, anon, authenticated;

-- Les signalements visent aussi un message de groupe (dernière définition de la contrainte : 0028).
alter table public.signalements add column if not exists message_groupe_id uuid references public.messages_groupes (id) on delete cascade;
alter table public.signalements drop constraint if exists signalements_une_cible;
alter table public.signalements add constraint signalements_une_cible check (num_nonnulls(publication_id, commentaire_id, commentaire_lecon_id, message_groupe_id) = 1);
create unique index if not exists signalements_message_groupe_unique on public.signalements (auteur, message_groupe_id) where message_groupe_id is not null;
create index if not exists signalements_message_groupe_idx on public.signalements (message_groupe_id) where traite_le is null;

-- ─── Les adresses ───────────────────────────────────────────────────────────────────────────────────
-- Celle du parcours ou de la formation ; prise par un autre groupe (« general », ou un parcours et une formation de même
-- adresse) : « <adresse>-2 », « -3 »…
create or replace function public.slug_groupe_libre(p_base text, p_groupe uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_slug text := p_base;
  v_n integer := 1;
begin
  while exists (select 1 from public.groupes g where g.slug = v_slug and g.id is distinct from p_groupe) loop
    v_n := v_n + 1;
    v_slug := p_base || '-' || v_n;
  end loop;
  return v_slug;
end;
$$;

-- ─── Qui entre dans un groupe ───────────────────────────────────────────────────────────────────────
-- Jamais pour un visiteur ni un compte suspendu. Le groupe d'un parcours désactivé : fermé à tous. Le groupe d'une
-- formation désactivé : seuls l'équipe et son formateur le lisent (marqué « Désactivé »), personne n'y écrit.
create or replace function public.peut_lire_groupe(p_groupe uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and not public.compte_suspendu()
    and exists (
      select 1 from public.groupes g
      where g.id = p_groupe
        and (
          (g.formation_id is null and g.actif and (
            g.parcours_id is null
            or public.equipe_communaute()
            or public.abonne((select auth.uid()))
            or exists (
              select 1
              from public.formations_parcours fp
              join public.formations f on f.id = fp.formation_id
              where fp.parcours_id = g.parcours_id and f.formateur_id is not null and f.formateur_id = public.ma_fiche_formateur()
            )
            or exists (
              select 1
              from public.inscriptions_formations i
              join public.formations_parcours fp on fp.formation_id = i.formation_id
              where fp.parcours_id = g.parcours_id and i.profil_id = (select auth.uid())
            )
          ))
          or (g.formation_id is not null and (
            public.equipe_communaute()
            or public.formateur_de(g.formation_id)
            or (g.actif and exists (
              select 1
              from public.inscriptions_formations i
              join public.formations f on f.id = i.formation_id
              where i.formation_id = g.formation_id and i.profil_id = (select auth.uid()) and f.statut in ('publiee', 'archivee')
            ))
          ))
        )
    );
$$;

-- Supprimer n'importe quel message et épingler : l'équipe ; le formateur d'une formation du parcours (groupe d'un
-- parcours) ou de la formation (groupe d'une formation). Le Général : l'équipe seule.
create or replace function public.peut_moderer_groupe(p_groupe uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.peut_lire_groupe(p_groupe) and (
    public.equipe_communaute()
    or exists (
      select 1 from public.groupes g
      where g.id = p_groupe
        and (
          (g.formation_id is not null and public.formateur_de(g.formation_id))
          or (g.parcours_id is not null and exists (
            select 1
            from public.formations_parcours fp
            join public.formations f on f.id = fp.formation_id
            where fp.parcours_id = g.parcours_id and f.formateur_id is not null and f.formateur_id = public.ma_fiche_formateur()
          ))
        )
    )
  );
$$;

-- La communauté (dernière définition : 0060_domaines_equipe.sql) : un espace de parcours suit les inscriptions (0069)
-- au lieu des leçons ouvertes. Même signature, mêmes usages (publier, fil, stockage « communaute »…).
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
      or public.equipe_communaute()
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
              from public.inscriptions_formations i
              join public.formations_parcours fp on fp.formation_id = i.formation_id
              where fp.parcours_id = pa.id and i.profil_id = (select auth.uid())
            )
          )
      )
    );
$$;

-- ─── Petits outils ──────────────────────────────────────────────────────────────────────────────────
create or replace function public.type_groupe(g public.groupes)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when g.formation_id is not null then 'formation' when g.parcours_id is not null then 'parcours' else 'general' end;
$$;

-- La couleur du parcours (celle du premier parcours de la formation pour un groupe de formation) ; null : le Général.
create or replace function public.couleur_groupe(g public.groupes)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when g.parcours_id is not null then (select pa.couleur::text from public.parcours pa where pa.id = g.parcours_id)
    when g.formation_id is not null then (
      select pa.couleur::text
      from public.formations_parcours fp
      join public.parcours pa on pa.id = fp.parcours_id
      where fp.formation_id = g.formation_id
      order by fp.ordre, pa.ordre, pa.nom
      limit 1
    )
  end;
$$;

-- Le lien d'un groupe, vers un message, pour ce compte : le formateur a ses groupes dans son espace.
create or replace function public.lien_groupe(p_profil uuid, p_slug text, p_message uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case when exists (select 1 from public.roles r where r.profil_id = p_profil and r.role = 'formateur') then '/formateur/groupes/' else '/groupes/' end
    || p_slug || coalesce('?message=' || p_message::text, '');
$$;

-- Le début d'un message pour une notification : une ligne, 100 caractères ; « Image » pour une image seule.
create or replace function public.extrait_message_groupe(p_texte text, p_image boolean)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when btrim(regexp_replace(coalesce(p_texte, ''), '\s+', ' ', 'g')) = '' then case when p_image then 'Image' else '' end
    when char_length(btrim(regexp_replace(p_texte, '\s+', ' ', 'g'))) <= 100 then btrim(regexp_replace(p_texte, '\s+', ' ', 'g'))
    else left(btrim(regexp_replace(p_texte, '\s+', ' ', 'g')), 99) || '…'
  end;
$$;

-- Les messages des autres, visibles, écrits depuis sa dernière lecture (un groupe jamais ouvert : depuis 7 jours) ;
-- 100 au plus.
create or replace function public.non_lus_groupe(p_groupe uuid, p_profil uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int from (
    select 1
    from public.messages_groupes m
    where m.groupe_id = p_groupe
      and m.auteur_id <> p_profil
      and m.supprime_le is null
      and m.moderation = 'visible'
      and m.cree_le > coalesce(
        (select l.lu_le from public.lectures_groupes l where l.groupe_id = p_groupe and l.profil_id = p_profil),
        now() - interval '7 days'
      )
    limit 100
  ) x;
$$;

-- La lecture n'avance que vers l'avant.
create or replace function public.avancer_lecture_groupe(p_groupe uuid, p_profil uuid, p_message uuid, p_le timestamptz)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.lectures_groupes (groupe_id, profil_id, lu_le, message_id)
  values (p_groupe, p_profil, p_le, p_message)
  on conflict (groupe_id, profil_id) do update
    set lu_le = excluded.lu_le, message_id = excluded.message_id
    where public.lectures_groupes.lu_le < excluded.lu_le;
$$;

-- Le nombre de comptes qui ont accès au groupe (la règle de peut_lire_groupe, vue pour chaque compte).
create or replace function public.compter_membres_groupe(p_groupe uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int
  from public.groupes g
  cross join public.profils p
  where g.id = p_groupe
    and not exists (select 1 from public.suspensions s where s.profil_id = p.id)
    and (
      (g.parcours_id is null and g.formation_id is null)
      or exists (select 1 from public.roles r where r.profil_id = p.id and 'communaute' = any (public.domaines_role(r.role::text)))
      or (g.parcours_id is not null and (
        public.abonne(p.id)
        or exists (
          select 1
          from public.formations_parcours fp
          join public.formations f on f.id = fp.formation_id
          join public.formateurs fo on fo.id = f.formateur_id
          where fp.parcours_id = g.parcours_id and fo.compte_id = p.id
            and exists (select 1 from public.roles r where r.profil_id = p.id and r.role = 'formateur')
        )
        or exists (
          select 1
          from public.inscriptions_formations i
          join public.formations_parcours fp on fp.formation_id = i.formation_id
          where fp.parcours_id = g.parcours_id and i.profil_id = p.id
        )
      ))
      or (g.formation_id is not null and (
        exists (
          select 1 from public.formations f
          join public.formateurs fo on fo.id = f.formateur_id
          where f.id = g.formation_id and fo.compte_id = p.id
            and exists (select 1 from public.roles r where r.profil_id = p.id and r.role = 'formateur')
        )
        or exists (
          select 1 from public.inscriptions_formations i
          join public.formations f on f.id = i.formation_id
          where i.formation_id = g.formation_id and i.profil_id = p.id and f.statut in ('publiee', 'archivee')
        )
      ))
    );
$$;

-- Les réactions d'un message, dans l'ordre des six emojis : nombre, et la mienne.
create or replace function public.reactions_message_groupe(p_message uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('emoji', x.emoji, 'nombre', x.nombre, 'moi', x.moi) order by x.rang), '[]'::jsonb)
  from (
    select r.emoji, count(*)::int as nombre, bool_or(r.profil_id = (select auth.uid())) as moi, array_position(public.reactions_groupes(), r.emoji) as rang
    from public.reactions_messages_groupes r
    where r.message_id = p_message
    group by r.emoji
  ) x;
$$;

-- Un message tel que le voit le compte qui demande. Jamais d'adresse e-mail : prénom, nom, photo et badge (« formateur »,
-- « equipe »). Supprimé ou retiré : ni texte, ni image, ni réactions.
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
    'image', case when m.supprime_le is null and m.moderation = 'visible' and m.image is not null
      then jsonb_build_object('chemin', m.image, 'type', m.image_type) end,
    'reponse', (
      select jsonb_build_object(
        'id', c.id,
        'auteur', jsonb_build_object('prenom', coalesce(pc.prenom, ''), 'nom', coalesce(pc.nom, '')),
        'texte', case when c.supprime_le is null and c.moderation = 'visible' then left(c.texte, 140) else '' end,
        'image', c.supprime_le is null and c.moderation = 'visible' and c.image is not null,
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

-- Un groupe dans la liste « Mes groupes » : son dernier message, mes non-lus, coupé ou non.
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
        'image', m.supprime_le is null and m.moderation = 'visible' and m.image is not null,
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

-- Le libellé d'une catégorie de l'analyse (src/lib/moderation/regles.ts, LIBELLES_CATEGORIES).
create or replace function public.libelle_categorie_moderation(p_categorie text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_categorie
    when 'spam' then 'Spam' when 'harcelement' then 'Harcèlement' when 'haine' then 'Haine'
    when 'sexuel' then 'Contenu sexuel ou inapproprié' when 'arnaque' then 'Arnaque' when 'hameconnage' then 'Hameçonnage'
    when 'publicite' then 'Publicité abusive' when 'illegal' then 'Contenu illégal' when 'hors_sujet' then 'Hors sujet'
    else 'Autre violation des règles'
  end;
$$;

-- ─── Les groupes suivent les parcours et les formations ─────────────────────────────────────────────
create or replace function public.groupe_du_parcours()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.groupes (parcours_id, slug, nom, actif)
    values (new.id, public.slug_groupe_libre(new.slug, null), new.nom, new.actif)
    on conflict do nothing;
  else
    update public.groupes g
    set nom = new.nom,
        actif = new.actif,
        slug = case when old.slug is distinct from new.slug then public.slug_groupe_libre(new.slug, g.id) else g.slug end
    where g.parcours_id = new.id;
  end if;
  return null;
end;
$$;
drop trigger if exists parcours_groupe on public.parcours;
create trigger parcours_groupe
  after insert or update of slug, nom, actif on public.parcours
  for each row execute function public.groupe_du_parcours();

-- Le nom du groupe d'une formation suit son titre (en ligne : après « Publier les modifications » d'un brouillon, 0056).
create or replace function public.groupe_de_la_formation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.groupes g
  set nom = new.titre,
      slug = case when old.slug is distinct from new.slug then public.slug_groupe_libre(new.slug, g.id) else g.slug end
  where g.formation_id = new.id;
  return null;
end;
$$;
drop trigger if exists formations_groupe on public.formations;
create trigger formations_groupe
  after update of titre, slug on public.formations
  for each row when (old.titre is distinct from new.titre or old.slug is distinct from new.slug)
  execute function public.groupe_de_la_formation();

-- Les groupes de départ : le Général, puis un par parcours (rejouée : les noms et l'état suivent les parcours).
insert into public.groupes (slug, nom)
select 'general', 'Général'
where not exists (select 1 from public.groupes g where g.parcours_id is null and g.formation_id is null);

insert into public.groupes (parcours_id, slug, nom, actif)
select pa.id, public.slug_groupe_libre(pa.slug, null), pa.nom, pa.actif
from public.parcours pa
where not exists (select 1 from public.groupes g where g.parcours_id = pa.id)
order by pa.ordre, pa.nom;

update public.groupes g
set nom = pa.nom, actif = pa.actif
from public.parcours pa
where g.parcours_id = pa.id and (g.nom is distinct from pa.nom or g.actif is distinct from pa.actif);

-- ─── Lire ───────────────────────────────────────────────────────────────────────────────────────────
-- Mes groupes : le Général, ceux des parcours (dans leur ordre), puis ceux des formations (par titre).
create or replace function public.mes_groupes()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.exiger_compte_actif();
  return coalesce((
    select jsonb_agg(public.resume_groupe(g) order by
      case when g.formation_id is not null then 2 when g.parcours_id is not null then 1 else 0 end,
      pa.ordre, pa.nom, f.titre, g.nom)
    from public.groupes g
    left join public.parcours pa on pa.id = g.parcours_id
    left join public.formations f on f.id = g.formation_id
    where public.peut_lire_groupe(g.id)
  ), '[]'::jsonb);
end;
$$;

-- Un groupe par son adresse. Inconnu (ou groupe d'un parcours désactivé) : null. Fermé au compte : son nom et la raison
-- (« abonnement », « formateur », « inscription », « desactive »), pour proposer les abonnements ou la formation.
create or replace function public.groupe_par_slug(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  g public.groupes%rowtype;
  v_ouvert boolean;
  v_base jsonb;
begin
  perform public.exiger_compte_actif();
  select * into g from public.groupes where slug = lower(btrim(coalesce(p_slug, '')));
  if not found or (g.formation_id is null and not g.actif) then
    return null;
  end if;
  v_ouvert := public.peut_lire_groupe(g.id);
  v_base := jsonb_build_object(
    'id', g.id,
    'slug', g.slug,
    'nom', g.nom,
    'type', public.type_groupe(g),
    'couleur', public.couleur_groupe(g),
    'actif', g.actif,
    'ouvert', v_ouvert,
    'parcours', (select jsonb_build_object('nom', pa.nom, 'slug', pa.slug) from public.parcours pa where pa.id = g.parcours_id),
    'formation', (select jsonb_build_object('titre', f.titre, 'slug', f.slug) from public.formations f where f.id = g.formation_id)
  );
  if not v_ouvert then
    return v_base || jsonb_build_object('raison', case
      when g.formation_id is not null and not g.actif then 'desactive'
      when g.formation_id is not null then 'inscription'
      when public.a_role('formateur') then 'formateur'
      else 'abonnement'
    end);
  end if;
  return v_base || jsonb_build_object(
    'raison', null,
    'membres', public.compter_membres_groupe(g.id),
    'coupe', exists (select 1 from public.groupes_coupes c where c.groupe_id = g.id and c.profil_id = (select auth.uid())),
    'peut_moderer', public.peut_moderer_groupe(g.id),
    -- L'équipe modère depuis la file : elle ne signale pas.
    'equipe', public.equipe_communaute(),
    'peut_ecrire', g.actif,
    'non_lus', public.non_lus_groupe(g.id, (select auth.uid())),
    'epingle', (
      select public.message_groupe_json(m)
      from public.messages_groupes m
      where m.id = g.epingle_id and m.supprime_le is null and m.moderation = 'visible'
    )
  );
end;
$$;

-- Les messages d'un groupe, par pages : les plus récents (ou ceux d'avant le message p_avant), rendus du plus ancien au
-- plus récent ; « plus_anciens » dit s'il en reste avant. 50 par page (100 au plus).
create or replace function public.messages_groupe(p_groupe uuid, p_avant uuid default null, p_limite integer default 50)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limite integer := greatest(1, least(coalesce(p_limite, 50), 100));
  v_avant public.messages_groupes%rowtype;
  v_ids uuid[];
  v_messages jsonb;
begin
  perform public.exiger_compte_actif();
  if not public.peut_lire_groupe(p_groupe) then
    raise exception 'Ce groupe ne vous est pas ouvert.' using errcode = '42501';
  end if;
  if p_avant is not null then
    select * into v_avant from public.messages_groupes where id = p_avant and groupe_id = p_groupe;
    if not found then
      return jsonb_build_object('messages', '[]'::jsonb, 'plus_anciens', false);
    end if;
  end if;
  select array_agg(x.id order by x.cree_le desc, x.id desc) into v_ids
  from (
    select m.id, m.cree_le
    from public.messages_groupes m
    where m.groupe_id = p_groupe
      and (p_avant is null or (m.cree_le, m.id) < (v_avant.cree_le, v_avant.id))
    order by m.cree_le desc, m.id desc
    limit v_limite + 1
  ) x;
  select coalesce(jsonb_agg(public.message_groupe_json(m) order by m.cree_le, m.id), '[]'::jsonb) into v_messages
  from public.messages_groupes m
  where m.id = any (coalesce(v_ids[1:v_limite], '{}'));
  return jsonb_build_object('messages', v_messages, 'plus_anciens', coalesce(cardinality(v_ids), 0) > v_limite);
end;
$$;

-- Le nombre de membres d'un groupe (en-tête du groupe).
create or replace function public.membres_groupe(p_groupe uuid)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.exiger_compte_actif();
  if not public.peut_lire_groupe(p_groupe) then
    raise exception 'Ce groupe ne vous est pas ouvert.' using errcode = '42501';
  end if;
  return public.compter_membres_groupe(p_groupe);
end;
$$;

-- ─── Écrire ─────────────────────────────────────────────────────────────────────────────────────────
-- Un message : du texte, une image déposée dans son dossier de l'espace « groupes », ou les deux ; en réponse à un
-- message du même groupe, éventuellement. Rend le message, avec « analyser » (l'analyse automatique est attendue), sa
-- version et le nom du groupe (pour l'analyse).
create or replace function public.envoyer_message_groupe(p_groupe uuid, p_texte text, p_image text default null, p_reponse_a uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_groupe public.groupes%rowtype;
  v_texte text := regexp_replace(coalesce(p_texte, ''), '^\s+|\s+$', '', 'g');
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
  if (select count(*) from public.messages_groupes m where m.auteur_id = v_uid and m.cree_le > now() - interval '1 minute') >= 20 then
    raise exception 'Vous envoyez beaucoup de messages. Patientez une minute avant d’écrire de nouveau.';
  end if;
  if p_image is not null then
    select o.metadata ->> 'mimetype', (o.metadata ->> 'size')::bigint into v_type, v_taille
    from storage.objects o
    where o.bucket_id = 'groupes' and o.name = p_image and (storage.foldername(o.name))[1] = v_uid::text;
    if not found or exists (select 1 from public.messages_groupes m where m.image = p_image) then
      raise exception 'Cette image n’a pas été reçue. Ajoutez-la de nouveau.';
    end if;
    if v_type is null or v_type not in ('image/jpeg', 'image/png', 'image/webp') then
      raise exception 'L’image doit être au format JPEG, PNG ou WebP.';
    end if;
    if coalesce(v_taille, 0) > 5242880 then
      raise exception 'L’image dépasse 5 Mo.';
    end if;
  end if;
  if p_reponse_a is not null then
    select * into v_cible from public.messages_groupes where id = p_reponse_a;
    if not found or v_cible.groupe_id <> p_groupe or v_cible.supprime_le is not null or v_cible.moderation <> 'visible' then
      raise exception 'Ce message n’existe plus.';
    end if;
  end if;

  insert into public.messages_groupes (groupe_id, auteur_id, texte, image, image_type, image_taille, reponse_a, analyse_attendue)
  values (p_groupe, v_uid, v_texte, p_image, case when p_image is not null then v_type end, case when p_image is not null then v_taille end, p_reponse_a, public.moderation_active())
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
      coalesce(v_nom, 'Un membre') || ' a répondu à votre message : « ' || public.extrait_message_groupe(v_message.texte, v_message.image is not null) || ' »',
      public.lien_groupe(v_cible.auteur_id, v_groupe.slug, v_message.id),
      false
    );
  end if;
  return public.message_groupe_json(v_message) || jsonb_build_object('analyser', v_message.analyse_attendue, 'version', v_message.version, 'groupe_nom', v_groupe.nom);
end;
$$;

-- Son auteur, pendant 15 minutes. Analyse active : la nouvelle version sera analysée à son tour.
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

-- Son auteur, ou un modérateur du groupe (formateur, équipe) : « Message supprimé » reste. Rend le chemin de l'image,
-- à effacer du stockage par l'appelant.
create or replace function public.supprimer_message_groupe(p_message uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.messages_groupes%rowtype;
  v_uid uuid := (select auth.uid());
begin
  perform public.exiger_compte_actif();
  select * into v from public.messages_groupes where id = p_message for update;
  if not found or not public.peut_lire_groupe(v.groupe_id) then
    raise exception 'Ce message n’existe plus.';
  end if;
  if v.auteur_id <> v_uid and not public.peut_moderer_groupe(v.groupe_id) then
    raise exception 'Vous ne pouvez pas supprimer ce message.' using errcode = '42501';
  end if;
  if v.supprime_le is not null then
    return null;
  end if;
  if v.image is not null then
    insert into public.images_groupes_a_effacer (chemin, par) values (v.image, v_uid)
    on conflict (chemin) do update set par = excluded.par, note_le = now();
  end if;
  update public.messages_groupes
  set supprime_le = now(), supprime_par = v_uid, texte = '', image = null, image_type = null, image_taille = null,
      a_examiner = false, analyse_attendue = false
  where id = p_message;
  update public.signalements set traite_le = now() where message_groupe_id = p_message and traite_le is null;
  -- Les notifications de réponse qui citaient ce message partent avec lui.
  delete from public.notifications n where n.categorie = 'communaute' and n.lien like '%?message=' || p_message::text;
  return v.image;
end;
$$;

-- Mettre ou enlever une réaction (bascule). Rend les réactions du message.
create or replace function public.reagir_message_groupe(p_message uuid, p_emoji text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.messages_groupes%rowtype;
  v_uid uuid := (select auth.uid());
begin
  perform public.exiger_compte_actif();
  select * into v from public.messages_groupes where id = p_message;
  if not found or not public.peut_lire_groupe(v.groupe_id) or v.supprime_le is not null or v.moderation <> 'visible' then
    raise exception 'Ce message n’existe plus.';
  end if;
  if not (select g.actif from public.groupes g where g.id = v.groupe_id) then
    raise exception 'Ce groupe est désactivé.';
  end if;
  if p_emoji is null or not (p_emoji = any (public.reactions_groupes())) then
    raise exception 'Cette réaction n’est pas proposée.';
  end if;
  delete from public.reactions_messages_groupes r where r.message_id = p_message and r.profil_id = v_uid and r.emoji = p_emoji;
  if not found then
    insert into public.reactions_messages_groupes (message_id, profil_id, emoji) values (p_message, v_uid, p_emoji);
  end if;
  return jsonb_build_object('reactions', public.reactions_message_groupe(p_message));
end;
$$;

-- Épingler (un message par groupe : il remplace le précédent) ou désépingler : le formateur et l'équipe.
create or replace function public.epingler_message_groupe(p_message uuid, p_epingle boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.messages_groupes%rowtype;
begin
  perform public.exiger_compte_actif();
  select * into v from public.messages_groupes where id = p_message;
  if not found or not public.peut_lire_groupe(v.groupe_id) then
    raise exception 'Ce message n’existe plus.';
  end if;
  if not public.peut_moderer_groupe(v.groupe_id) then
    raise exception 'Seuls le formateur et l’équipe épinglent un message.' using errcode = '42501';
  end if;
  if coalesce(p_epingle, false) then
    if v.supprime_le is not null or v.moderation <> 'visible' then
      raise exception 'Ce message n’existe plus.';
    end if;
    update public.groupes
    set epingle_id = v.id, epingle_par = (select auth.uid()), epingle_le = now()
    where id = v.groupe_id and epingle_id is distinct from v.id;
  else
    update public.groupes set epingle_id = null, epingle_par = null, epingle_le = null
    where id = v.groupe_id and epingle_id = v.id;
  end if;
end;
$$;

-- Lu jusqu'à ce message (jamais en arrière). Rend les non-lus qui restent dans le groupe.
create or replace function public.marquer_groupe_lu(p_groupe uuid, p_message uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.messages_groupes%rowtype;
begin
  perform public.exiger_compte_actif();
  if not public.peut_lire_groupe(p_groupe) then
    raise exception 'Ce groupe ne vous est pas ouvert.' using errcode = '42501';
  end if;
  select * into v from public.messages_groupes where id = p_message and groupe_id = p_groupe;
  if not found then
    raise exception 'Ce message n’existe plus.';
  end if;
  perform public.avancer_lecture_groupe(p_groupe, (select auth.uid()), v.id, v.cree_le);
  return public.non_lus_groupe(p_groupe, (select auth.uid()));
end;
$$;

-- « Couper les notifications » (vrai) ou les rétablir (faux). Rend l'état.
create or replace function public.couper_groupe(p_groupe uuid, p_coupe boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.exiger_compte_actif();
  if not public.peut_lire_groupe(p_groupe) then
    raise exception 'Ce groupe ne vous est pas ouvert.' using errcode = '42501';
  end if;
  if coalesce(p_coupe, false) then
    insert into public.groupes_coupes (groupe_id, profil_id) values (p_groupe, (select auth.uid())) on conflict do nothing;
  else
    delete from public.groupes_coupes where groupe_id = p_groupe and profil_id = (select auth.uid());
  end if;
  return coalesce(p_coupe, false);
end;
$$;

-- ─── Les groupes des formations ─────────────────────────────────────────────────────────────────────
-- Activer (le premier réglage le crée : nom, le titre ; adresse, celle de la formation) ou désactiver (caché aux
-- étudiants, ses messages gardés). Le formateur de la formation et l'équipe des contenus ; tout de suite, même pour une
-- formation publiée : c'est un réglage, pas un contenu des brouillons (0056).
create or replace function public.activer_groupe_formation(p_formation uuid, p_actif boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  f public.formations%rowtype;
  g public.groupes%rowtype;
begin
  perform public.exiger_compte_actif();
  select * into f from public.formations where id = p_formation;
  if not found then
    raise exception 'Cette formation n’existe plus.';
  end if;
  if not (public.equipe_contenus() or public.formateur_de(p_formation)) then
    raise exception 'Seuls le formateur de la formation et l’équipe règlent son groupe.' using errcode = '42501';
  end if;
  select * into g from public.groupes where formation_id = p_formation for update;
  if not found then
    if not coalesce(p_actif, false) then
      return jsonb_build_object('slug', null, 'actif', false);
    end if;
    insert into public.groupes (formation_id, slug, nom, actif)
    values (p_formation, public.slug_groupe_libre(f.slug, null), f.titre, true)
    returning * into g;
  else
    update public.groupes set actif = coalesce(p_actif, false) where id = g.id returning * into g;
  end if;
  return jsonb_build_object('slug', g.slug, 'actif', g.actif);
end;
$$;

-- Le groupe d'une formation, pour sa fiche, ses leçons et son réglage : actif, son adresse (si l'on peut s'y rendre ou
-- le régler), ouvert au compte (« Rejoindre le groupe de discussion »), réglable par lui.
create or replace function public.groupe_formation(p_formation uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  g public.groupes%rowtype;
  v_regler boolean := (select auth.uid()) is not null and not public.compte_suspendu()
    and (public.equipe_contenus() or public.formateur_de(p_formation));
begin
  select * into g from public.groupes where formation_id = p_formation;
  return jsonb_build_object(
    'actif', coalesce(g.actif, false),
    'slug', case when g.id is not null and (g.actif or v_regler) then g.slug end,
    'ouvert', g.id is not null and g.actif and public.peut_lire_groupe(g.id),
    'peut_regler', v_regler
  );
end;
$$;

-- ─── La modération ──────────────────────────────────────────────────────────────────────────────────
-- Le verdict de l'analyse automatique, transmis par le serveur juste après l'envoi, avec la session de l'auteur et le
-- jeton de modération (0020). Une version dépassée (message modifié depuis), un message supprimé ou déjà jugé : rien.
create or replace function public.verdict_message_groupe(p_message uuid, p_analyse jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.messages_groupes%rowtype;
  v_groupe public.groupes%rowtype;
  v_analyse jsonb;
  v_decision text;
begin
  perform public.exiger_compte_actif();
  select * into v from public.messages_groupes where id = p_message for update;
  if not found or v.auteur_id <> (select auth.uid()) or not public.verdict_valide(p_analyse) then
    raise exception 'Verdict refusé.' using errcode = '42501';
  end if;
  if v.supprime_le is not null or v.moderation <> 'visible' or not v.analyse_attendue
     or coalesce(p_analyse ->> 'version', '') <> v.version::text then
    return jsonb_build_object('decision', null);
  end if;
  select * into v_groupe from public.groupes where id = v.groupe_id;
  v_analyse := public.analyse_retenue(p_analyse);
  v_decision := v_analyse ->> 'decision';
  update public.reglages_moderation set derniere_analyse = now() where id;
  if v_decision = 'bloquer' then
    update public.messages_groupes set verdict = v_analyse, analyse_attendue = false, moderation = 'bloque' where id = p_message;
    delete from public.notifications n where n.categorie = 'communaute' and n.lien like '%?message=' || p_message::text;
    perform public.notifier(
      array[v.auteur_id], 'service', 'Message retiré',
      'Votre message dans le groupe ' || v_groupe.nom || ' a été retiré par la modération automatique : il semble enfreindre les règles de la communauté ('
        || public.libelle_categorie_moderation(v_analyse ->> 'categorie') || '). Si c’est une erreur, l’équipe Étudium pourra le rétablir.',
      public.lien_groupe(v.auteur_id, v_groupe.slug, null),
      true
    );
  elsif v_decision in ('signaler', 'echec') then
    update public.messages_groupes set verdict = v_analyse, analyse_attendue = false, a_examiner = true where id = p_message;
    perform public.prevenir_equipe('Un message du groupe ' || v_groupe.nom || ' attend votre examen.');
  else
    update public.messages_groupes set verdict = v_analyse, analyse_attendue = false where id = p_message;
  end if;
  return jsonb_build_object('decision', v_decision);
end;
$$;

-- Signaler : un membre du groupe, sauf l'auteur et l'équipe (qui modère depuis la file). L'équipe est prévenue au
-- premier signalement d'un message qui n'était pas déjà dans sa file.
create or replace function public.signaler_message_groupe(p_message uuid, p_motif text, p_precisions text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.messages_groupes%rowtype;
  v_precisions text := regexp_replace(coalesce(p_precisions, ''), '^\s+|\s+$', '', 'g');
  v_dans_la_file boolean;
begin
  perform public.exiger_compte_actif();
  select * into v from public.messages_groupes where id = p_message;
  if not found or not public.peut_lire_groupe(v.groupe_id) or v.supprime_le is not null or v.moderation <> 'visible' then
    raise exception 'Ce contenu n’existe plus.';
  end if;
  if v.auteur_id = (select auth.uid()) then
    raise exception 'Vous ne pouvez pas signaler votre propre contenu.';
  end if;
  if public.equipe_communaute() then
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
  v_dans_la_file := v.a_examiner or exists (select 1 from public.signalements s where s.message_groupe_id = p_message and s.traite_le is null);
  begin
    insert into public.signalements (message_groupe_id, auteur, motif, precisions)
    values (p_message, (select auth.uid()), p_motif, v_precisions);
  exception when unique_violation then
    raise exception 'Vous avez déjà signalé ce contenu.';
  end;
  if not v_dans_la_file then
    perform public.prevenir_equipe('Un message du groupe ' || (select g.nom from public.groupes g where g.id = v.groupe_id) || ' attend votre examen.');
  end if;
end;
$$;

-- Un message dans la file de l'équipe (mêmes champs que element_publication, 0020) : son groupe, l'image, le verdict
-- (ou « Analyse automatique non reçue »), le message cité, les signalements.
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
      then jsonb_build_object('chemin', m.image, 'nom', 'Image', 'type', coalesce(m.image_type, 'image/jpeg'), 'taille', coalesce(m.image_taille, 0)) end,
    'statut', case when m.moderation = 'bloque' then 'bloquee' else 'publiee' end,
    'analyse', coalesce(m.verdict, case when m.analyse_attendue
      then jsonb_build_object('decision', 'echec', 'categorie', 'aucune', 'raison', 'Analyse automatique non reçue.') end),
    'extrait', (
      select left(coalesce(nullif(c.texte, ''), 'Image'), 140)
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

-- Les messages « À examiner » : visibles, et signalés par l'analyse ou par des membres, ou restés sans verdict plus de
-- 5 minutes (analyse active).
create or replace function public.message_groupe_a_examiner(m public.messages_groupes)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select m.supprime_le is null and m.moderation = 'visible' and (
    m.a_examiner
    or (m.analyse_attendue and coalesce(m.modifie_le, m.cree_le) < now() - interval '5 minutes')
    or exists (select 1 from public.signalements s where s.message_groupe_id = m.id and s.traite_le is null)
  );
$$;

-- La file de l'équipe (dernière définition : 0028_discussions_lecons.sql), avec les messages des groupes.
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
      select jsonb_agg(b.element order by b.cree_le desc, b.id desc)
      from (
        select public.element_publication(p) as element, p.cree_le, p.id
        from public.publications p where p.statut = 'bloquee'
        union all
        select public.element_message_groupe(m), m.cree_le, m.id
        from public.messages_groupes m where m.moderation = 'bloque' and m.supprime_le is null
        order by 2 desc, 3 desc
        limit 50
      ) b
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
      union all
      select public.element_message_groupe(m), m.cree_le, m.id
      from public.messages_groupes m
      where (m.a_examiner or m.analyse_attendue or exists (select 1 from public.signalements s where s.message_groupe_id = m.id and s.traite_le is null))
        and public.message_groupe_a_examiner(m)
      order by 2, 3
      limit 50
    ) e
  ), '[]'::jsonb);
end;
$$;

-- Le nombre à examiner (dernière définition : 0028_discussions_lecons.sql), avec les messages des groupes.
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
  ) + (
    select count(*)::int from public.messages_groupes m
    where (m.a_examiner or m.analyse_attendue or exists (select 1 from public.signalements s where s.message_groupe_id = m.id and s.traite_le is null))
      and public.message_groupe_a_examiner(m)
  );
end;
$$;

-- Garder : les signalements sont classés, le message quitte la file.
create or replace function public.garder_message_groupe(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.exiger_equipe_moderation();
  if not exists (select 1 from public.messages_groupes where id = p_id) then
    raise exception 'Ce contenu n’existe plus.';
  end if;
  update public.signalements set traite_le = now() where message_groupe_id = p_id and traite_le is null;
  update public.messages_groupes set a_examiner = false, analyse_attendue = false where id = p_id;
end;
$$;

-- Supprimer depuis la file : « Message retiré par la modération » ; son auteur est prévenu (sauf un message déjà retiré
-- par l'analyse : il l'a été alors). Rend le chemin de l'image, à effacer du stockage par l'appelant.
create or replace function public.retirer_message_groupe(p_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.messages_groupes%rowtype;
  v_groupe public.groupes%rowtype;
begin
  perform public.exiger_equipe_moderation();
  select * into v from public.messages_groupes where id = p_id for update;
  if not found then
    raise exception 'Ce contenu n’existe plus.';
  end if;
  select * into v_groupe from public.groupes where id = v.groupe_id;
  if v.image is not null then
    insert into public.images_groupes_a_effacer (chemin, par) values (v.image, (select auth.uid()))
    on conflict (chemin) do update set par = excluded.par, note_le = now();
  end if;
  update public.messages_groupes
  set moderation = 'retire', texte = '', image = null, image_type = null, image_taille = null, a_examiner = false, analyse_attendue = false
  where id = p_id;
  update public.signalements set traite_le = now() where message_groupe_id = p_id and traite_le is null;
  delete from public.notifications n where n.categorie = 'communaute' and n.lien like '%?message=' || p_id::text;
  if v.moderation = 'visible' and v.supprime_le is null then
    perform public.notifier(
      array[v.auteur_id], 'service', 'Message retiré',
      'Votre message dans le groupe ' || v_groupe.nom || ' a été retiré par l’équipe Étudium : il ne respecte pas les règles de la communauté.',
      public.lien_groupe(v.auteur_id, v_groupe.slug, null),
      false
    );
  end if;
  return v.image;
end;
$$;

-- Rétablir un message retiré par l'analyse par erreur : de nouveau visible, son auteur prévenu.
create or replace function public.retablir_message_groupe(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.messages_groupes%rowtype;
  v_groupe public.groupes%rowtype;
begin
  perform public.exiger_equipe_moderation();
  select * into v from public.messages_groupes where id = p_id for update;
  if not found then
    raise exception 'Ce contenu n’existe plus.';
  end if;
  if v.moderation <> 'bloque' then
    return;
  end if;
  select * into v_groupe from public.groupes where id = v.groupe_id;
  update public.messages_groupes set moderation = 'visible', a_examiner = false where id = p_id;
  perform public.notifier(
    array[v.auteur_id], 'service', 'Message rétabli',
    'Votre message dans le groupe ' || v_groupe.nom || ' a été vérifié par l’équipe Étudium et rétabli.',
    public.lien_groupe(v.auteur_id, v_groupe.slug, v.id),
    false
  );
end;
$$;

-- ─── Le temps réel (0044) : « groupe:<id> » ─────────────────────────────────────────────────────────
create or replace function public.diffuser_message_groupe()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.diffuser('groupe:' || new.groupe_id, case when tg_op = 'INSERT' then 'message' else 'changement' end);
  return null;
end;
$$;

drop trigger if exists messages_groupes_temps_reel_ajout on public.messages_groupes;
create trigger messages_groupes_temps_reel_ajout
  after insert on public.messages_groupes
  for each row execute function public.diffuser_message_groupe();

-- Seulement ce que les membres voient : le texte, l'image, la suppression, le retrait (pas un verdict qui autorise).
drop trigger if exists messages_groupes_temps_reel_changement on public.messages_groupes;
create trigger messages_groupes_temps_reel_changement
  after update on public.messages_groupes
  for each row when (
    old.texte is distinct from new.texte
    or old.image is distinct from new.image
    or old.supprime_le is distinct from new.supprime_le
    or old.moderation is distinct from new.moderation
  )
  execute function public.diffuser_message_groupe();

create or replace function public.diffuser_reactions_groupes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_groupe uuid;
begin
  for v_groupe in select distinct m.groupe_id from lignes x join public.messages_groupes m on m.id = x.message_id loop
    perform public.diffuser('groupe:' || v_groupe, 'changement');
  end loop;
  return null;
end;
$$;

drop trigger if exists reactions_groupes_temps_reel_ajout on public.reactions_messages_groupes;
create trigger reactions_groupes_temps_reel_ajout
  after insert on public.reactions_messages_groupes
  referencing new table as lignes
  for each statement execute function public.diffuser_reactions_groupes();

drop trigger if exists reactions_groupes_temps_reel_retrait on public.reactions_messages_groupes;
create trigger reactions_groupes_temps_reel_retrait
  after delete on public.reactions_messages_groupes
  referencing old table as lignes
  for each statement execute function public.diffuser_reactions_groupes();

create or replace function public.diffuser_epingle_groupe()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.diffuser('groupe:' || new.id, 'changement');
  return null;
end;
$$;

drop trigger if exists groupes_temps_reel_epingle on public.groupes;
create trigger groupes_temps_reel_epingle
  after update of epingle_id on public.groupes
  for each row when (old.epingle_id is distinct from new.epingle_id)
  execute function public.diffuser_epingle_groupe();

-- Le droit de s'abonner au sujet « groupe:<id> » (règle sur realtime.messages, plus bas) : être membre du groupe.
create or replace function public.peut_lire_sujet_groupe(p_sujet text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_sujet is null or p_sujet !~ '^groupe:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return public.peut_lire_groupe(substr(p_sujet, 8)::uuid);
end;
$$;

-- ─── L'espace des images ────────────────────────────────────────────────────────────────────────────
-- L'image d'un message visible d'un groupe que l'on lit (l'équipe : toutes, pour la file de modération).
create or replace function public.image_groupe_lisible(p_nom text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.messages_groupes m
    where m.image = p_nom
      and (public.equipe_communaute() or (m.supprime_le is null and m.moderation = 'visible' and public.peut_lire_groupe(m.groupe_id)))
  );
$$;

-- Une image jointe à un message : son auteur ne l'efface pas tant que le message la montre.
create or replace function public.image_groupe_attachee(p_nom text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.messages_groupes m where m.image = p_nom);
$$;

-- L'image d'un message que l'appelant a supprimé ou retiré, que plus aucun message ne montre.
create or replace function public.image_groupe_a_effacer(p_nom text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.images_groupes_a_effacer a where a.chemin = p_nom and a.par = (select auth.uid()))
     and not public.image_groupe_attachee(p_nom);
$$;

-- Privé, 5 Mo, JPEG, PNG ou WebP (règles calquées sur l'espace « messages », 0035). Chacun dépose dans son dossier
-- (« <compte>/… ») et y efface ce qu'aucun message ne montre ; on lit le sien et les images des messages de ses groupes.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('groupes', 'groupes', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "groupes : déposer dans son dossier" on storage.objects;
create policy "groupes : déposer dans son dossier" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'groupes'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and not (select public.compte_suspendu())
  );

drop policy if exists "groupes : lire" on storage.objects;
create policy "groupes : lire" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'groupes'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or (select public.image_groupe_lisible(objects.name))
      or (select public.image_groupe_a_effacer(objects.name))
    )
  );

drop policy if exists "groupes : supprimer" on storage.objects;
create policy "groupes : supprimer" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'groupes'
    and (
      ((storage.foldername(name))[1] = (select auth.uid())::text and not (select public.image_groupe_attachee(objects.name)))
      or (select public.image_groupe_a_effacer(objects.name))
    )
  );

-- ─── Droits ─────────────────────────────────────────────────────────────────────────────────────────
-- Les outils internes : appelés par les fonctions plus bas seulement.
revoke execute on function public.reactions_groupes() from public, anon, authenticated;
revoke execute on function public.slug_groupe_libre(text, uuid) from public, anon, authenticated;
revoke execute on function public.peut_moderer_groupe(uuid) from public, anon, authenticated;
revoke execute on function public.type_groupe(public.groupes) from public, anon, authenticated;
revoke execute on function public.couleur_groupe(public.groupes) from public, anon, authenticated;
revoke execute on function public.lien_groupe(uuid, text, uuid) from public, anon, authenticated;
revoke execute on function public.extrait_message_groupe(text, boolean) from public, anon, authenticated;
revoke execute on function public.non_lus_groupe(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.avancer_lecture_groupe(uuid, uuid, uuid, timestamptz) from public, anon, authenticated;
revoke execute on function public.compter_membres_groupe(uuid) from public, anon, authenticated;
revoke execute on function public.reactions_message_groupe(uuid) from public, anon, authenticated;
revoke execute on function public.message_groupe_json(public.messages_groupes) from public, anon, authenticated;
revoke execute on function public.resume_groupe(public.groupes) from public, anon, authenticated;
revoke execute on function public.libelle_categorie_moderation(text) from public, anon, authenticated;
revoke execute on function public.groupe_du_parcours() from public, anon, authenticated;
revoke execute on function public.groupe_de_la_formation() from public, anon, authenticated;
revoke execute on function public.element_message_groupe(public.messages_groupes) from public, anon, authenticated;
revoke execute on function public.message_groupe_a_examiner(public.messages_groupes) from public, anon, authenticated;
revoke execute on function public.diffuser_message_groupe() from public, anon, authenticated;
revoke execute on function public.diffuser_reactions_groupes() from public, anon, authenticated;
revoke execute on function public.diffuser_epingle_groupe() from public, anon, authenticated;

-- Les règles du stockage et du temps réel les appellent avec la session du compte.
revoke execute on function public.peut_lire_groupe(uuid) from public;
revoke execute on function public.peut_lire_sujet_groupe(text) from public, anon;
revoke execute on function public.image_groupe_lisible(text) from public, anon;
revoke execute on function public.image_groupe_attachee(text) from public, anon;
revoke execute on function public.image_groupe_a_effacer(text) from public, anon;
-- Un visiteur obtient « non », sans erreur.
grant execute on function public.peut_lire_groupe(uuid) to anon, authenticated;
grant execute on function public.peut_lire_sujet_groupe(text) to authenticated;
grant execute on function public.image_groupe_lisible(text) to authenticated;
grant execute on function public.image_groupe_attachee(text) to authenticated;
grant execute on function public.image_groupe_a_effacer(text) to authenticated;

-- Ce que l'appli appelle.
revoke execute on function public.mes_groupes() from public, anon;
revoke execute on function public.groupe_par_slug(text) from public, anon;
revoke execute on function public.messages_groupe(uuid, uuid, integer) from public, anon;
revoke execute on function public.membres_groupe(uuid) from public, anon;
revoke execute on function public.envoyer_message_groupe(uuid, text, text, uuid) from public, anon;
revoke execute on function public.modifier_message_groupe(uuid, text) from public, anon;
revoke execute on function public.supprimer_message_groupe(uuid) from public, anon;
revoke execute on function public.reagir_message_groupe(uuid, text) from public, anon;
revoke execute on function public.epingler_message_groupe(uuid, boolean) from public, anon;
revoke execute on function public.marquer_groupe_lu(uuid, uuid) from public, anon;
revoke execute on function public.couper_groupe(uuid, boolean) from public, anon;
revoke execute on function public.activer_groupe_formation(uuid, boolean) from public, anon;
revoke execute on function public.groupe_formation(uuid) from public, anon;
revoke execute on function public.verdict_message_groupe(uuid, jsonb) from public, anon;
revoke execute on function public.signaler_message_groupe(uuid, text, text) from public, anon;
revoke execute on function public.garder_message_groupe(uuid) from public, anon;
revoke execute on function public.retirer_message_groupe(uuid) from public, anon;
revoke execute on function public.retablir_message_groupe(uuid) from public, anon;
revoke execute on function public.file_moderation(text) from public, anon;
revoke execute on function public.nombre_a_examiner() from public, anon;
grant execute on function public.mes_groupes() to authenticated;
grant execute on function public.groupe_par_slug(text) to authenticated;
grant execute on function public.messages_groupe(uuid, uuid, integer) to authenticated;
grant execute on function public.membres_groupe(uuid) to authenticated;
grant execute on function public.envoyer_message_groupe(uuid, text, text, uuid) to authenticated;
grant execute on function public.modifier_message_groupe(uuid, text) to authenticated;
grant execute on function public.supprimer_message_groupe(uuid) to authenticated;
grant execute on function public.reagir_message_groupe(uuid, text) to authenticated;
grant execute on function public.epingler_message_groupe(uuid, boolean) to authenticated;
grant execute on function public.marquer_groupe_lu(uuid, uuid) to authenticated;
grant execute on function public.couper_groupe(uuid, boolean) to authenticated;
grant execute on function public.activer_groupe_formation(uuid, boolean) to authenticated;
grant execute on function public.groupe_formation(uuid) to authenticated;
grant execute on function public.verdict_message_groupe(uuid, jsonb) to authenticated;
grant execute on function public.signaler_message_groupe(uuid, text, text) to authenticated;
grant execute on function public.garder_message_groupe(uuid) to authenticated;
grant execute on function public.retirer_message_groupe(uuid) to authenticated;
grant execute on function public.retablir_message_groupe(uuid) to authenticated;
grant execute on function public.file_moderation(text) to authenticated;
grant execute on function public.nombre_a_examiner() to authenticated;

commit;

-- ─── Qui peut s'abonner au sujet « groupe:<id> » : un membre du groupe ──────────────────────────────
-- Une règle de plus sur realtime.messages, à côté de celle de la 0044 (« compte:<id> », « communaute ») : Supabase
-- vérifie ce droit en lisant realtime.messages avec le sujet demandé (realtime.topic()) et le compte connecté.
do $temps_reel$
begin
  if to_regclass('realtime.messages') is null then
    raise notice 'Temps réel indisponible : règle d''abonnement aux groupes non créée (voir le guide « Ce qui te revient », section 49).';
    return;
  end if;
  execute 'drop policy if exists etudium_temps_reel_groupes on realtime.messages';
  execute $regle$
    create policy etudium_temps_reel_groupes on realtime.messages
    for select to authenticated
    using (
      realtime.messages.extension = 'broadcast'
      and (select public.peut_lire_sujet_groupe((select realtime.topic())))
    )
  $regle$;
end
$temps_reel$;
