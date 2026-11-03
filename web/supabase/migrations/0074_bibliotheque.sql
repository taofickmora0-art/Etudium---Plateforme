-- Migration 0074 : la Bibliothèque numérique (spec du 3 novembre 2026, lot 7). Une seule migration pour les étapes A
-- (base et back-office), B (pages des étudiants, lecteur) et C (favoris, « Continuer la lecture », livres recommandés
-- dans les formations, statistiques). Choix de l'utilisateur : l'équipe des contenus seule dépose ; un nouveau livre est
-- « inclus dans l'abonnement » et non téléchargeable ; pas de filigrane ; classement par parcours et par catégories
-- libres ; PDF seulement, 50 Mo au plus ; la case « J'ai le droit de diffuser ce livre » obligatoire pour publier.
--   - Tables : categories_livres, livres, livres_parcours (aucun, un ou plusieurs parcours), livres_formations (« Pour
--     aller plus loin » d'une formation), lectures_livres (dernière page, terminé), favoris_livres, telechargements_livres.
--   - Les téléchargements sont des événements (une ligne par téléchargement) plutôt qu'un compteur dans livres : on peut
--     les compter sur une période (30 derniers jours), sans l'équipe ni les formateurs (règle des statistiques, 0029),
--     limiter leur débit par compte, et la fiche d'un livre n'est pas réécrite (ni son « modifie_le ») à chaque clic.
--   - L'écriture suit les formations : l'équipe des contenus écrit directement par l'API, les règles d'accès (RLS) et des
--     déclencheurs gardent les règles (publier exige le PDF et les droits ; on ne supprime qu'un brouillon jamais publié ;
--     l'adresse d'un livre publié est figée). Seuls les rangements passent par des fonctions.
--   - La table livres n'est lue que par l'équipe : le chemin du PDF ne sort jamais. Les fiches publiées se lisent, pour
--     tous (visiteurs compris), par bibliotheque_catalogue, livre_fiche, livres_formation ; mes_lectures et
--     mes_favoris_livres pour le compte connecté ; chemin_livre donne le chemin du PDF à qui a l'accès (lien signé).
--   - Fichiers : l'espace privé « bibliotheque » (PDF, 50 Mo), lu selon acces_livre, écrit par l'équipe ; les couvertures
--     dans l'espace public « couvertures » existant, sous livres/<id>/ (mêmes adresses publiques que les formations).
--   - Le journal (0061) trace la publication, l'archivage et la suppression des livres, comme pour les formations.
-- À appliquer après la 0073. Rejouable.

begin;

-- ─── Les catégories (créées par l'équipe) ───────────────────────────────────────────────────────────
create table if not exists public.categories_livres (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  slug text not null,
  ordre integer not null default 0,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now(),
  constraint categories_livres_slug_unique unique (slug),
  constraint categories_livres_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  constraint categories_livres_nom_longueur check (char_length(btrim(nom)) between 1 and 60)
);

-- ─── Les livres ─────────────────────────────────────────────────────────────────────────────────────
create table if not exists public.livres (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  titre text not null,
  auteur text not null default '',
  resume text not null default '',
  -- Code de langue à deux lettres (fr, en…).
  langue text not null default 'fr',
  annee smallint,
  mots_cles text[] not null default '{}',
  -- Lu dans le PDF au dépôt (pdf.js, au back-office).
  nb_pages integer,
  categorie_id uuid references public.categories_livres (id) on delete set null,
  -- Le PDF dans l'espace privé « bibliotheque » : <id du livre>/<uuid>.pdf.
  fichier text,
  taille_octets bigint,
  -- L'image dans l'espace public « couvertures » : livres/<id du livre>/<uuid>.<jpg|png|webp>.
  couverture text,
  acces text not null default 'abonnes',
  telechargeable boolean not null default false,
  -- « J'ai le droit de diffuser ce livre » : obligatoire pour publier.
  droits_confirmes boolean not null default false,
  statut text not null default 'brouillon',
  cree_par uuid default auth.uid() references public.profils (id) on delete set null,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now(),
  -- La première publication : elle fige l'adresse.
  publie_le timestamptz,
  constraint livres_slug_unique unique (slug),
  constraint livres_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 90),
  constraint livres_fichier_unique unique (fichier),
  constraint livres_titre_longueur check (char_length(btrim(titre)) between 1 and 200),
  constraint livres_auteur_longueur check (char_length(auteur) <= 120),
  constraint livres_resume_longueur check (char_length(resume) <= 2000),
  constraint livres_langue check (langue ~ '^[a-z]{2}$'),
  constraint livres_annee check (annee is null or annee between 1000 and 2100),
  constraint livres_mots_cles check (cardinality(mots_cles) <= 20 and char_length(array_to_string(mots_cles, ',')) <= 600),
  constraint livres_nb_pages check (nb_pages is null or nb_pages between 1 and 100000),
  constraint livres_fichier_chemin check (fichier is null or fichier ~ ('^' || id::text || '/[0-9a-f-]{36}\.pdf$')),
  constraint livres_taille check (taille_octets is null or taille_octets between 1 and 52428800),
  constraint livres_couverture_chemin check (couverture is null or couverture ~ ('^livres/' || id::text || '/[0-9a-f-]{36}\.(jpg|png|webp)$')),
  constraint livres_acces check (acces in ('gratuit', 'abonnes')),
  constraint livres_statut check (statut in ('brouillon', 'publie', 'archive')),
  -- Le filet de la règle de publication (le déclencheur livres_regles donne le message, plus bas).
  constraint livres_publication check (statut = 'brouillon' or (fichier is not null and droits_confirmes))
);
create index if not exists livres_statut_idx on public.livres (statut);
create index if not exists livres_categorie_idx on public.livres (categorie_id);
create index if not exists livres_cree_par_idx on public.livres (cree_par);

-- ─── Les parcours d'un livre (aucun, un ou plusieurs) ───────────────────────────────────────────────
create table if not exists public.livres_parcours (
  livre_id uuid not null references public.livres (id) on delete cascade,
  parcours_id uuid not null references public.parcours (id) on delete cascade,
  primary key (livre_id, parcours_id)
);
create index if not exists livres_parcours_parcours_idx on public.livres_parcours (parcours_id);

-- ─── Les livres recommandés par une formation (« Pour aller plus loin ») ────────────────────────────
create table if not exists public.livres_formations (
  formation_id uuid not null references public.formations (id) on delete cascade,
  livre_id uuid not null references public.livres (id) on delete cascade,
  ordre integer not null default 0,
  ajoute_le timestamptz not null default now(),
  primary key (formation_id, livre_id)
);
create index if not exists livres_formations_livre_idx on public.livres_formations (livre_id);

-- ─── Les lectures (une ligne par compte et par livre ouvert) ────────────────────────────────────────
-- derniere_page : où reprendre ; page_max : la page la plus loin atteinte (le pourcentage) ; nb_pages : le total vu par
-- le lecteur ; terminee : la dernière page a été atteinte une fois (et le reste).
create table if not exists public.lectures_livres (
  profil_id uuid not null references public.profils (id) on delete cascade,
  livre_id uuid not null references public.livres (id) on delete cascade,
  derniere_page integer not null default 1,
  page_max integer not null default 1,
  nb_pages integer not null default 1,
  pourcentage smallint not null default 0,
  terminee boolean not null default false,
  terminee_le timestamptz,
  ouvert_le timestamptz not null default now(),
  maj_le timestamptz not null default now(),
  primary key (profil_id, livre_id),
  constraint lectures_livres_pages check (nb_pages between 1 and 100000 and derniere_page between 1 and nb_pages and page_max between 1 and nb_pages),
  constraint lectures_livres_pourcentage check (pourcentage between 0 and 100)
);
create index if not exists lectures_livres_livre_idx on public.lectures_livres (livre_id);
create index if not exists lectures_livres_recentes_idx on public.lectures_livres (profil_id, maj_le desc);

-- ─── Les favoris (comme ceux des formations, 0009) ──────────────────────────────────────────────────
create table if not exists public.favoris_livres (
  profil_id uuid not null default auth.uid() references public.profils (id) on delete cascade,
  livre_id uuid not null references public.livres (id) on delete cascade,
  ajoute_le timestamptz not null default now(),
  primary key (profil_id, livre_id)
);
create index if not exists favoris_livres_livre_idx on public.favoris_livres (livre_id);

-- ─── Les téléchargements (événements) ───────────────────────────────────────────────────────────────
-- Un compte supprimé ensuite : la ligne reste, sans compte, et compte toujours.
create table if not exists public.telechargements_livres (
  id bigint generated always as identity primary key,
  livre_id uuid not null references public.livres (id) on delete cascade,
  profil_id uuid references public.profils (id) on delete set null,
  telecharge_le timestamptz not null default now()
);
create index if not exists telechargements_livres_livre_idx on public.telechargements_livres (livre_id, telecharge_le);
create index if not exists telechargements_livres_profil_idx on public.telechargements_livres (profil_id, telecharge_le);

-- ─── La limite de débit des lectures (60 mises à jour par minute et par compte) ─────────────────────
create table if not exists public.debit_lectures (
  profil_id uuid primary key references public.profils (id) on delete cascade,
  fenetre_le timestamptz not null default now(),
  appels integer not null default 0
);

-- ─── modifie_le tenu à jour (fonction de la 0001) ───────────────────────────────────────────────────
drop trigger if exists categories_livres_modifie_le on public.categories_livres;
create trigger categories_livres_modifie_le before update on public.categories_livres
  for each row execute function public.toucher_modifie_le();
drop trigger if exists livres_modifie_le on public.livres;
create trigger livres_modifie_le before update on public.livres
  for each row execute function public.toucher_modifie_le();

-- ─── Les règles d'un livre (comme formations_regles, 0004) ──────────────────────────────────────────
-- Un brouillon se publie avec son PDF et la case des droits ; publié, il s'archive et se republie, ne redevient jamais
-- brouillon, garde son adresse, son PDF et sa case ; seul un brouillon jamais publié se supprime.
create or replace function public.livres_regles()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  -- Déjà publié (publié ou archivé) avant cette modification.
  v_publie_avant boolean := false;
begin
  if tg_op = 'DELETE' then
    if old.publie_le is not null or old.statut <> 'brouillon' then
      raise exception 'Un livre publié s’archive, il ne se supprime pas.';
    end if;
    return old;
  end if;
  if tg_op = 'UPDATE' then
    v_publie_avant := old.statut <> 'brouillon';
  end if;
  if tg_op = 'UPDATE' and old.publie_le is not null then
    if new.slug is distinct from old.slug then
      raise exception 'L’adresse d’un livre publié ne change plus.';
    end if;
    -- La date de première publication ne s'efface pas (elle protège l'adresse).
    new.publie_le := old.publie_le;
  end if;
  if v_publie_avant and new.statut = 'brouillon' then
    raise exception 'Un livre publié ne redevient pas un brouillon : archivez-le.';
  end if;
  if new.statut = 'archive' and not v_publie_avant then
    raise exception 'Seul un livre publié s’archive.';
  end if;
  if new.statut <> 'brouillon' then
    if new.fichier is null then
      if v_publie_avant then
        raise exception 'Un livre publié garde son PDF.';
      end if;
      raise exception 'Déposez le PDF du livre avant de le publier.';
    end if;
    if not new.droits_confirmes then
      if v_publie_avant then
        raise exception 'Un livre publié garde la case « J’ai le droit de diffuser ce livre » cochée.';
      end if;
      raise exception 'Cochez « J’ai le droit de diffuser ce livre » avant de le publier.';
    end if;
  end if;
  if new.statut = 'publie' and new.publie_le is null then
    new.publie_le := now();
  elsif new.statut = 'brouillon' then
    -- Jamais publié : pas de date (elle figerait l'adresse d'un simple brouillon).
    new.publie_le := null;
  end if;
  return new;
end;
$$;
drop trigger if exists livres_regles on public.livres;
create trigger livres_regles
  before insert or update or delete on public.livres
  for each row execute function public.livres_regles();

-- ─── Le journal de l'équipe (0061), comme journal_formations ────────────────────────────────────────
create or replace function public.libelle_statut_livre(p_statut text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_statut when 'brouillon' then 'Brouillon' when 'publie' then 'Publié' when 'archive' then 'Archivé' else p_statut end;
$$;

create or replace function public.journal_livres()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform public.journaliser('contenus', 'livre_supprime', 'livre', old.id::text, old.titre, format('Livre « %s » supprimé', old.titre));
  elsif new.statut is distinct from old.statut then
    perform public.journaliser('contenus', 'livre_statut', 'livre', new.id::text, new.titre,
      format('Livre « %s » : %s → %s', new.titre, public.libelle_statut_livre(old.statut), public.libelle_statut_livre(new.statut)),
      jsonb_build_object('ancien', old.statut, 'nouveau', new.statut));
  end if;
  return null;
end;
$$;
drop trigger if exists livres_journal on public.livres;
create trigger livres_journal after update of statut or delete on public.livres
  for each row execute function public.journal_livres();

-- ─── La règle d'accès ───────────────────────────────────────────────────────────────────────────────
-- Ce livre peut-il être lu par le compte qui demande ? L'équipe des contenus : tout livre. Sinon un compte connecté,
-- non suspendu, un livre publié, gratuit ou avec un abonnement en cours (0049). Un visiteur : jamais (il lit après
-- connexion). Un livre qui n'existe pas : non.
create or replace function public.acces_livre(p_livre uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not public.compte_suspendu() and exists (
    select 1 from public.livres l
    where l.id = p_livre
      and (
        public.equipe_contenus()
        or (
          (select auth.uid()) is not null
          and l.statut = 'publie'
          and (l.acces = 'gratuit' or public.abonne((select auth.uid())))
        )
      )
  );
$$;

-- Un livre publié (favoris, recommandations) : lu par la base, sans passer par la règle de la table (réservée à l'équipe).
create or replace function public.livre_publie(p_livre uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.livres l where l.id = p_livre and l.statut = 'publie');
$$;

-- Un fichier de l'espace « bibliotheque » lisible par le compte qui demande (règle de l'espace, plus bas).
create or replace function public.acces_fichier_livre(p_chemin text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.livres l where l.fichier = p_chemin and public.acces_livre(l.id));
$$;

-- Le chemin du PDF, pour un lien signé (lecteur, téléchargement) : seulement avec l'accès au livre.
create or replace function public.chemin_livre(p_livre uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_chemin text;
begin
  if not public.acces_livre(p_livre) then
    raise exception 'Ce livre ne vous est pas ouvert.' using errcode = '42501';
  end if;
  select l.fichier into v_chemin from public.livres l where l.id = p_livre;
  if v_chemin is null then
    raise exception 'Ce livre n’a pas encore de fichier.';
  end if;
  return v_chemin;
end;
$$;

-- « ouvert » (il se lit), « connexion » (visiteur), « abonnement » (réservé aux abonnés, compte sans abonnement) ou
-- « ferme » (compte suspendu, livre non publié) : le bouton de la fiche (« Lire », « Se connecter », « Voir les
-- abonnements »).
create or replace function public.etat_acces_livre(l public.livres)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when public.acces_livre(l.id) then 'ouvert'
    when (select auth.uid()) is null then 'connexion'
    when l.statut = 'publie' and l.acces = 'abonnes' and not public.compte_suspendu() and not public.abonne((select auth.uid())) then 'abonnement'
    else 'ferme'
  end;
$$;

-- ─── Les fiches publiques ───────────────────────────────────────────────────────────────────────────
-- La carte d'un livre, commune au catalogue, à la fiche, à « Continuer la lecture », aux favoris et aux
-- recommandations. Jamais le chemin du PDF. Pour le compte connecté : favori et lecture (null sans lecture).
create or replace function public.carte_livre(l public.livres)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', l.id,
    'slug', l.slug,
    'titre', l.titre,
    'auteur', l.auteur,
    'resume', l.resume,
    'langue', l.langue,
    'annee', l.annee,
    'mots_cles', to_jsonb(l.mots_cles),
    'nb_pages', l.nb_pages,
    'couverture', l.couverture,
    'acces', l.acces,
    'telechargeable', l.telechargeable,
    'statut', l.statut,
    'publie_le', l.publie_le,
    'categorie', (select jsonb_build_object('id', c.id, 'slug', c.slug, 'nom', c.nom) from public.categories_livres c where c.id = l.categorie_id),
    'parcours', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'slug', p.slug, 'nom', p.nom, 'nom_court', p.nom_court, 'couleur', p.couleur) order by p.ordre, p.nom)
      from public.livres_parcours lp
      join public.parcours p on p.id = lp.parcours_id
      where lp.livre_id = l.id and p.actif
    ), '[]'::jsonb),
    'ouvert', public.acces_livre(l.id),
    'acces_etat', public.etat_acces_livre(l),
    'favori', exists (select 1 from public.favoris_livres f where f.livre_id = l.id and f.profil_id = (select auth.uid())),
    'lecture', (
      select jsonb_build_object(
        'derniere_page', r.derniere_page, 'nb_pages', r.nb_pages, 'pourcentage', r.pourcentage, 'terminee', r.terminee,
        'ouvert_le', r.ouvert_le, 'maj_le', r.maj_le
      )
      from public.lectures_livres r
      where r.livre_id = l.id and r.profil_id = (select auth.uid())
    )
  );
$$;

-- Le catalogue : les livres publiés (les plus récents d'abord), filtrés au besoin ; et, pour les filtres, les
-- catégories et les parcours actifs avec leur nombre de livres publiés.
--   p_recherche : dans le titre, l'auteur et les mots-clés, sans accents ni majuscules (100 caractères au plus) ;
--   p_parcours, p_categorie : l'adresse (slug) d'un parcours, d'une catégorie ; p_gratuits : les livres gratuits seuls.
create or replace function public.bibliotheque_catalogue(
  p_recherche text default '', p_parcours text default null, p_categorie text default null, p_gratuits boolean default false
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_q text := left(public.sans_accents(btrim(coalesce(p_recherche, ''))), 100);
  v_parcours text := nullif(btrim(coalesce(p_parcours, '')), '');
  v_categorie text := nullif(btrim(coalesce(p_categorie, '')), '');
begin
  return jsonb_build_object(
    'livres', coalesce((
      select jsonb_agg(public.carte_livre(l) order by l.publie_le desc, l.titre)
      from public.livres l
      where l.statut = 'publie'
        and (v_q = '' or strpos(public.sans_accents(concat_ws(' ', l.titre, l.auteur, array_to_string(l.mots_cles, ' '))), v_q) > 0)
        and (v_parcours is null or exists (
          select 1 from public.livres_parcours lp join public.parcours p on p.id = lp.parcours_id
          where lp.livre_id = l.id and p.slug = v_parcours
        ))
        and (v_categorie is null or exists (select 1 from public.categories_livres c where c.id = l.categorie_id and c.slug = v_categorie))
        and (not coalesce(p_gratuits, false) or l.acces = 'gratuit')
    ), '[]'::jsonb),
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'slug', c.slug, 'nom', c.nom,
        'livres', (select count(*)::int from public.livres l where l.categorie_id = c.id and l.statut = 'publie')
      ) order by c.ordre, c.nom)
      from public.categories_livres c
    ), '[]'::jsonb),
    'parcours', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'slug', p.slug, 'nom', p.nom, 'nom_court', p.nom_court, 'couleur', p.couleur,
        'livres', (select count(*)::int from public.livres_parcours lp join public.livres l on l.id = lp.livre_id where lp.parcours_id = p.id and l.statut = 'publie')
      ) order by p.ordre, p.nom)
      from public.parcours p
      where p.actif
    ), '[]'::jsonb)
  );
end;
$$;

-- La fiche d'un livre par son adresse : la carte, sa taille, et les formations publiées qui le recommandent. Un livre
-- pas publié n'existe que pour l'équipe des contenus (aperçu) ; sinon null.
create or replace function public.livre_fiche(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.carte_livre(l) || jsonb_build_object(
    'taille_octets', l.taille_octets,
    'modifie_le', l.modifie_le,
    'formations', coalesce((
      select jsonb_agg(jsonb_build_object('id', f.id, 'slug', f.slug, 'titre', f.titre, 'couverture', f.couverture) order by f.titre)
      from public.livres_formations lf
      join public.formations f on f.id = lf.formation_id
      where lf.livre_id = l.id and f.statut = 'publiee'
    ), '[]'::jsonb)
  )
  from public.livres l
  where l.slug = btrim(coalesce(p_slug, '')) and (l.statut = 'publie' or public.equipe_contenus());
$$;

-- « Continuer la lecture » : les livres publiés que le compte a commencés sans les terminer, du plus récent au plus
-- ancien (12 par défaut, 50 au plus). Un visiteur : aucun.
create or replace function public.mes_lectures(p_limite integer default 12)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(x.carte order by x.maj_le desc), '[]'::jsonb)
  from (
    select public.carte_livre(l) as carte, r.maj_le
    from public.lectures_livres r
    join public.livres l on l.id = r.livre_id
    where r.profil_id = (select auth.uid()) and not r.terminee and l.statut = 'publie'
    order by r.maj_le desc
    limit least(greatest(coalesce(p_limite, 12), 1), 50)
  ) x;
$$;

-- Les livres mis de côté par le compte (onglet Favoris), du plus récent au plus ancien ; publiés seulement.
create or replace function public.mes_favoris_livres()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(public.carte_livre(l) order by f.ajoute_le desc), '[]'::jsonb)
  from public.favoris_livres f
  join public.livres l on l.id = f.livre_id
  where f.profil_id = (select auth.uid()) and l.statut = 'publie';
$$;

-- « Pour aller plus loin » d'une formation : ses livres publiés recommandés, dans leur ordre. Une formation pas publiée
-- n'en montre qu'à l'équipe des contenus et à son formateur.
create or replace function public.livres_formation(p_formation uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(public.carte_livre(l) order by lf.ordre, l.titre), '[]'::jsonb)
  from public.livres_formations lf
  join public.livres l on l.id = lf.livre_id
  join public.formations f on f.id = lf.formation_id
  where lf.formation_id = p_formation
    and l.statut = 'publie'
    and (f.statut = 'publiee' or public.equipe_contenus() or public.formateur_de(f.id));
$$;

-- ─── La lecture et le téléchargement ────────────────────────────────────────────────────────────────
-- Garde la page où reprendre (ramenée entre 1 et p_total), la page la plus loin atteinte (le pourcentage), et marque le
-- livre terminé à la dernière page ; terminé, il le reste. Rend l'état de la lecture. Limite : 60 appels par minute et
-- par compte (le lecteur note la page quand elle change, pas à chaque défilement).
create or replace function public.noter_lecture(p_livre uuid, p_page integer, p_total integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_page integer;
  v_appels integer;
  v_ligne public.lectures_livres%rowtype;
begin
  if v_uid is null or not public.acces_livre(p_livre) then
    raise exception 'Ce livre ne vous est pas ouvert.' using errcode = '42501';
  end if;
  if p_total is null or p_total < 1 or p_total > 100000 then
    raise exception 'Nombre de pages invalide.';
  end if;
  insert into public.debit_lectures as d (profil_id, fenetre_le, appels)
  values (v_uid, now(), 1)
  on conflict (profil_id) do update
    set fenetre_le = case when d.fenetre_le < now() - interval '1 minute' then now() else d.fenetre_le end,
        appels = case when d.fenetre_le < now() - interval '1 minute' then 1 else d.appels + 1 end
  returning d.appels into v_appels;
  if v_appels > 60 then
    raise exception 'Trop de mises à jour de lecture en peu de temps : réessayez dans un instant.';
  end if;

  v_page := least(greatest(coalesce(p_page, 1), 1), p_total);
  insert into public.lectures_livres as r (profil_id, livre_id, derniere_page, page_max, nb_pages, pourcentage, terminee, terminee_le)
  values (
    v_uid, p_livre, v_page, v_page, p_total, round(100.0 * v_page / p_total)::smallint, v_page >= p_total,
    case when v_page >= p_total then now() end
  )
  on conflict (profil_id, livre_id) do update
    set derniere_page = excluded.derniere_page,
        nb_pages = excluded.nb_pages,
        page_max = least(greatest(r.page_max, excluded.derniere_page), excluded.nb_pages),
        terminee = r.terminee or excluded.terminee,
        terminee_le = coalesce(r.terminee_le, excluded.terminee_le),
        pourcentage = case
          when r.terminee or excluded.terminee then 100
          else round(100.0 * least(greatest(r.page_max, excluded.derniere_page), excluded.nb_pages) / excluded.nb_pages)::smallint
        end,
        maj_le = now()
  returning r.* into v_ligne;
  return jsonb_build_object('derniere_page', v_ligne.derniere_page, 'nb_pages', v_ligne.nb_pages, 'pourcentage', v_ligne.pourcentage, 'terminee', v_ligne.terminee);
end;
$$;

-- Note un téléchargement, avant le lien signé : seulement pour un livre téléchargeable, avec l'accès. Limite : 20 par
-- 10 minutes et par compte.
create or replace function public.noter_telechargement(p_livre uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null or not public.acces_livre(p_livre) then
    raise exception 'Ce livre ne vous est pas ouvert.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.livres l where l.id = p_livre and l.telechargeable) then
    raise exception 'Ce livre se lit dans le site, sans téléchargement.';
  end if;
  if (select count(*) from public.telechargements_livres t where t.profil_id = v_uid and t.telecharge_le > now() - interval '10 minutes') >= 20 then
    raise exception 'Trop de téléchargements en peu de temps : réessayez dans quelques minutes.';
  end if;
  insert into public.telechargements_livres (livre_id, profil_id) values (p_livre, v_uid);
end;
$$;

-- ─── Le back-office ─────────────────────────────────────────────────────────────────────────────────
-- Les livres (tous, ou un seul avec p_livre), avec ce qu'il faut à leur fiche (le chemin du PDF, la case des droits) et
-- leurs chiffres : lectures (comptes qui l'ont ouvert, terminées), téléchargements, sur toute la durée et sur 30 jours,
-- favoris, formations qui le recommandent. L'équipe et les formateurs ne comptent pas (règle des statistiques, 0029).
-- Réservé à l'équipe des contenus.
create or replace function public.livres_back_office(p_livre uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.exiger_equipe_admin();
  return (
    with lectures as (
      select r.livre_id,
        count(*) as nombre,
        count(*) filter (where r.terminee) as terminees,
        count(*) filter (where r.maj_le > now() - interval '30 days') as recentes
      from public.lectures_livres r
      where not exists (select 1 from public.roles ro where ro.profil_id = r.profil_id and ro.role <> 'etudiant')
      group by r.livre_id
    ),
    telechargements as (
      select t.livre_id,
        count(*) as nombre,
        count(*) filter (where t.telecharge_le > now() - interval '30 days') as recents
      from public.telechargements_livres t
      where t.profil_id is null or not exists (select 1 from public.roles ro where ro.profil_id = t.profil_id and ro.role <> 'etudiant')
      group by t.livre_id
    )
    select jsonb_build_object(
      'totaux', jsonb_build_object(
        'publies', (select count(*) from public.livres l where l.statut = 'publie'),
        'brouillons', (select count(*) from public.livres l where l.statut = 'brouillon'),
        'archives', (select count(*) from public.livres l where l.statut = 'archive'),
        'lectures', coalesce((select sum(x.nombre) from lectures x), 0),
        'lectures_30j', coalesce((select sum(x.recentes) from lectures x), 0),
        'telechargements', coalesce((select sum(x.nombre) from telechargements x), 0),
        'telechargements_30j', coalesce((select sum(x.recents) from telechargements x), 0)
      ),
      'livres', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', l.id,
          'slug', l.slug,
          'titre', l.titre,
          'auteur', l.auteur,
          'resume', l.resume,
          'langue', l.langue,
          'annee', l.annee,
          'mots_cles', to_jsonb(l.mots_cles),
          'nb_pages', l.nb_pages,
          'categorie', (select jsonb_build_object('id', c.id, 'slug', c.slug, 'nom', c.nom) from public.categories_livres c where c.id = l.categorie_id),
          'parcours', coalesce((
            select jsonb_agg(jsonb_build_object('id', p.id, 'slug', p.slug, 'nom', p.nom, 'nom_court', p.nom_court, 'couleur', p.couleur) order by p.ordre, p.nom)
            from public.livres_parcours lp join public.parcours p on p.id = lp.parcours_id
            where lp.livre_id = l.id
          ), '[]'::jsonb),
          'fichier', l.fichier,
          'taille_octets', l.taille_octets,
          'couverture', l.couverture,
          'acces', l.acces,
          'telechargeable', l.telechargeable,
          'droits_confirmes', l.droits_confirmes,
          'statut', l.statut,
          'cree_le', l.cree_le,
          'modifie_le', l.modifie_le,
          'publie_le', l.publie_le,
          'lectures', coalesce(le.nombre, 0),
          'lectures_terminees', coalesce(le.terminees, 0),
          'lectures_30j', coalesce(le.recentes, 0),
          'telechargements', coalesce(te.nombre, 0),
          'telechargements_30j', coalesce(te.recents, 0),
          'favoris', (select count(*) from public.favoris_livres f where f.livre_id = l.id),
          'formations', (select count(*) from public.livres_formations lf where lf.livre_id = l.id)
        ) order by l.modifie_le desc, l.titre)
        from public.livres l
        left join lectures le on le.livre_id = l.id
        left join telechargements te on te.livre_id = l.id
        where p_livre is null or l.id = p_livre
      ), '[]'::jsonb)
    )
  );
end;
$$;

-- Range une catégorie à un rang (1 = en tête), comme ranger_formation_parcours (0066).
create or replace function public.ranger_categorie_livre(p_categorie uuid, p_position integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids uuid[];
  v_rang integer;
begin
  perform public.exiger_equipe_admin();
  perform 1 from public.categories_livres c for update;
  if not exists (select 1 from public.categories_livres c where c.id = p_categorie) then
    raise exception 'Cette catégorie n’existe plus.';
  end if;
  v_ids := array(select c.id from public.categories_livres c where c.id <> p_categorie order by c.ordre, c.nom);
  v_rang := least(greatest(coalesce(p_position, 1), 1), coalesce(array_length(v_ids, 1), 0) + 1);
  v_ids := v_ids[1:v_rang - 1] || p_categorie || v_ids[v_rang:];
  update public.categories_livres c set ordre = x.rang
  from unnest(v_ids) with ordinality as x (id, rang)
  where c.id = x.id and c.ordre is distinct from x.rang;
end;
$$;

-- Range un livre recommandé à un rang de sa formation.
create or replace function public.ranger_livre_formation(p_formation uuid, p_livre uuid, p_position integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids uuid[];
  v_rang integer;
begin
  perform public.exiger_equipe_admin();
  perform 1 from public.formations f where f.id = p_formation for update;
  if not exists (select 1 from public.livres_formations lf where lf.formation_id = p_formation and lf.livre_id = p_livre) then
    raise exception 'Ce livre n’est pas recommandé par cette formation.';
  end if;
  v_ids := array(
    select lf.livre_id from public.livres_formations lf join public.livres l on l.id = lf.livre_id
    where lf.formation_id = p_formation and lf.livre_id <> p_livre
    order by lf.ordre, l.titre
  );
  v_rang := least(greatest(coalesce(p_position, 1), 1), coalesce(array_length(v_ids, 1), 0) + 1);
  v_ids := v_ids[1:v_rang - 1] || p_livre || v_ids[v_rang:];
  update public.livres_formations lf set ordre = x.rang
  from unnest(v_ids) with ordinality as x (id, rang)
  where lf.formation_id = p_formation and lf.livre_id = x.id and lf.ordre is distinct from x.rang;
end;
$$;

-- ─── Les règles d'accès des tables ──────────────────────────────────────────────────────────────────
alter table public.categories_livres enable row level security;
alter table public.livres enable row level security;
alter table public.livres_parcours enable row level security;
alter table public.livres_formations enable row level security;
alter table public.lectures_livres enable row level security;
alter table public.favoris_livres enable row level security;
alter table public.telechargements_livres enable row level security;
alter table public.debit_lectures enable row level security;

-- Un visiteur n'écrit rien ; personne ne vide une table d'un coup (TRUNCATE ignore les règles d'accès).
revoke insert, update, delete, truncate on public.categories_livres, public.livres, public.livres_parcours, public.livres_formations from anon;
revoke truncate on public.categories_livres, public.livres, public.livres_parcours, public.livres_formations from authenticated;
-- Les lectures : chacun lit les siennes ; seule noter_lecture les écrit.
revoke all on public.lectures_livres from anon;
revoke insert, update, delete, truncate on public.lectures_livres from authenticated;
grant select on public.lectures_livres to authenticated;
-- Les favoris : chacun les siens, ajoutés ou retirés directement.
revoke all on public.favoris_livres from anon;
revoke update, truncate on public.favoris_livres from authenticated;
-- Les téléchargements et le débit : la base seule (noter_telechargement, noter_lecture, livres_back_office).
revoke all on public.telechargements_livres, public.debit_lectures from anon, authenticated;

drop policy if exists "catégories visibles" on public.categories_livres;
create policy "catégories visibles" on public.categories_livres
  for select to anon, authenticated
  using (true);

-- La table des livres (avec le chemin du PDF) n'est lue que par l'équipe ; les fiches publiques passent par les fonctions.
drop policy if exists "livres : l'équipe lit" on public.livres;
create policy "livres : l'équipe lit" on public.livres
  for select to authenticated
  using ((select public.equipe_contenus()));

drop policy if exists "parcours des livres : l'équipe lit" on public.livres_parcours;
create policy "parcours des livres : l'équipe lit" on public.livres_parcours
  for select to authenticated
  using ((select public.equipe_contenus()));

drop policy if exists "livres recommandés : l'équipe lit" on public.livres_formations;
create policy "livres recommandés : l'équipe lit" on public.livres_formations
  for select to authenticated
  using ((select public.equipe_contenus()));

-- Écriture : l'équipe des contenus, une règle par action (comme la 0004).
do $$
declare
  t text;
begin
  foreach t in array array['categories_livres', 'livres', 'livres_parcours', 'livres_formations'] loop
    execute format('drop policy if exists %I on public.%I', 'l''équipe ajoute', t);
    execute format('drop policy if exists %I on public.%I', 'l''équipe modifie', t);
    execute format('drop policy if exists %I on public.%I', 'l''équipe supprime', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using ((select public.equipe_contenus())) with check ((select public.equipe_contenus()))',
      'l''équipe modifie', t
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using ((select public.equipe_contenus()))',
      'l''équipe supprime', t
    );
  end loop;
  foreach t in array array['categories_livres', 'livres', 'livres_parcours'] loop
    execute format(
      'create policy %I on public.%I for insert to authenticated with check ((select public.equipe_contenus()))',
      'l''équipe ajoute', t
    );
  end loop;
end;
$$;
-- Une formation ne recommande qu'un livre publié (un lien reste si le livre est archivé ensuite).
create policy "l'équipe ajoute" on public.livres_formations
  for insert to authenticated
  with check ((select public.equipe_contenus()) and public.livre_publie(livre_id));

drop policy if exists "ses lectures : lecture" on public.lectures_livres;
create policy "ses lectures : lecture" on public.lectures_livres
  for select to authenticated
  using (profil_id = (select auth.uid()));

drop policy if exists "ses favoris de livres : lecture" on public.favoris_livres;
create policy "ses favoris de livres : lecture" on public.favoris_livres
  for select to authenticated
  using (profil_id = (select auth.uid()));

-- On n'ajoute qu'un livre publié ; un favori reste en place si le livre est archivé ensuite.
drop policy if exists "ses favoris de livres : ajout" on public.favoris_livres;
create policy "ses favoris de livres : ajout" on public.favoris_livres
  for insert to authenticated
  with check (profil_id = (select auth.uid()) and public.livre_publie(livre_id));

drop policy if exists "ses favoris de livres : suppression" on public.favoris_livres;
create policy "ses favoris de livres : suppression" on public.favoris_livres
  for delete to authenticated
  using (profil_id = (select auth.uid()));

-- Un compte suspendu : ni lecture ni écriture de ses lectures et favoris (règle restrictive, comme la 0013).
do $$
declare
  t text;
begin
  foreach t in array array['lectures_livres', 'favoris_livres'] loop
    execute format('drop policy if exists %I on public.%I', 'compte suspendu : rien', t);
    execute format(
      'create policy %I on public.%I as restrictive for all to authenticated
         using (not (select public.compte_suspendu())) with check (not (select public.compte_suspendu()))',
      'compte suspendu : rien', t
    );
  end loop;
end;
$$;

-- ─── Les fichiers des livres : espace privé, 50 Mo, PDF seulement ──────────────────────────────────
-- Jamais d'adresse publique : chaque lecture passe par un lien signé de courte durée, accordé selon acces_livre (le
-- chemin vient de chemin_livre). Dépôt, remplacement et suppression : l'équipe des contenus, dans le dossier d'un
-- livre (<uuid>/<uuid>.pdf ; le livre peut ne pas exister encore : le navigateur dépose avant d'enregistrer).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('bibliotheque', 'bibliotheque', false, 52428800, array['application/pdf'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "bibliotheque : lecture avec l'accès au livre" on storage.objects;
create policy "bibliotheque : lecture avec l'accès au livre" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'bibliotheque' and ((select public.equipe_contenus()) or public.acces_fichier_livre(name)));

drop policy if exists "bibliotheque : l'équipe dépose" on storage.objects;
create policy "bibliotheque : l'équipe dépose" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'bibliotheque'
    and (select public.equipe_contenus())
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$'
  );

drop policy if exists "bibliotheque : l'équipe remplace" on storage.objects;
create policy "bibliotheque : l'équipe remplace" on storage.objects
  for update to authenticated
  using (bucket_id = 'bibliotheque' and (select public.equipe_contenus()))
  with check (
    bucket_id = 'bibliotheque'
    and (select public.equipe_contenus())
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$'
  );

drop policy if exists "bibliotheque : l'équipe supprime" on storage.objects;
create policy "bibliotheque : l'équipe supprime" on storage.objects
  for delete to authenticated
  using (bucket_id = 'bibliotheque' and (select public.equipe_contenus()));

-- ─── Les couvertures des livres : l'espace public « couvertures » (0012), sous livres/<id>/ ─────────
-- Les règles de la 0012 n'acceptent que le dossier d'une formation : ces deux règles ajoutent celui des livres (les
-- règles s'additionnent). La liste et la suppression sont déjà à l'équipe (0012) ; 5 Mo, JPEG, PNG ou WebP (0012).
drop policy if exists "couvertures : l'équipe dépose (livres)" on storage.objects;
create policy "couvertures : l'équipe dépose (livres)" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'couvertures'
    and (select public.equipe_contenus())
    and name ~ '^livres/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$'
  );

drop policy if exists "couvertures : l'équipe remplace (livres)" on storage.objects;
create policy "couvertures : l'équipe remplace (livres)" on storage.objects
  for update to authenticated
  using (bucket_id = 'couvertures' and (select public.equipe_contenus()))
  with check (
    bucket_id = 'couvertures'
    and (select public.equipe_contenus())
    and name ~ '^livres/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$'
  );

-- ─── Droits ─────────────────────────────────────────────────────────────────────────────────────────
revoke execute on function public.livres_regles() from public, anon, authenticated;
revoke execute on function public.libelle_statut_livre(text) from public, anon, authenticated;
revoke execute on function public.journal_livres() from public, anon, authenticated;
revoke execute on function public.acces_livre(uuid) from public, anon, authenticated;
revoke execute on function public.livre_publie(uuid) from public, anon, authenticated;
revoke execute on function public.acces_fichier_livre(text) from public, anon, authenticated;
revoke execute on function public.chemin_livre(uuid) from public, anon, authenticated;
revoke execute on function public.etat_acces_livre(public.livres) from public, anon, authenticated;
revoke execute on function public.carte_livre(public.livres) from public, anon, authenticated;
revoke execute on function public.bibliotheque_catalogue(text, text, text, boolean) from public, anon, authenticated;
revoke execute on function public.livre_fiche(text) from public, anon, authenticated;
revoke execute on function public.mes_lectures(integer) from public, anon, authenticated;
revoke execute on function public.mes_favoris_livres() from public, anon, authenticated;
revoke execute on function public.livres_formation(uuid) from public, anon, authenticated;
revoke execute on function public.noter_lecture(uuid, integer, integer) from public, anon, authenticated;
revoke execute on function public.noter_telechargement(uuid) from public, anon, authenticated;
revoke execute on function public.livres_back_office(uuid) from public, anon, authenticated;
revoke execute on function public.ranger_categorie_livre(uuid, integer) from public, anon, authenticated;
revoke execute on function public.ranger_livre_formation(uuid, uuid, integer) from public, anon, authenticated;

-- Les règles des tables et des fichiers les appellent aussi pour un visiteur.
grant execute on function public.acces_livre(uuid) to anon, authenticated;
grant execute on function public.acces_fichier_livre(text) to anon, authenticated;
grant execute on function public.livre_publie(uuid) to authenticated;
-- Le catalogue public : visiteurs compris.
grant execute on function public.bibliotheque_catalogue(text, text, text, boolean) to anon, authenticated;
grant execute on function public.livre_fiche(text) to anon, authenticated;
grant execute on function public.livres_formation(uuid) to anon, authenticated;
grant execute on function public.mes_lectures(integer) to anon, authenticated;
grant execute on function public.mes_favoris_livres() to anon, authenticated;
-- Le compte connecté.
grant execute on function public.chemin_livre(uuid) to authenticated;
grant execute on function public.noter_lecture(uuid, integer, integer) to authenticated;
grant execute on function public.noter_telechargement(uuid) to authenticated;
-- L'équipe des contenus (la fonction le revérifie).
grant execute on function public.livres_back_office(uuid) to authenticated;
grant execute on function public.ranger_categorie_livre(uuid, integer) to authenticated;
grant execute on function public.ranger_livre_formation(uuid, uuid, integer) to authenticated;

commit;
