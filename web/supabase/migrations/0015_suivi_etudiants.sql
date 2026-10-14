-- Étudium · migration 0015 : suivi des étudiants par le formateur et tableau de bord du formateur
-- (spec « Étudiants » et tableau de bord du formateur, 14 octobre 2026).
-- À appliquer dans Supabase, après la 0014 : SQL Editor → New query → coller tout le fichier → Run.
-- Rejouable : relancé sur une base qui l'a déjà, il ne change rien et ne casse rien.

begin;

-- ─── Définitions (spec, §2) ─────────────────────────────────────────────────────────────────────────
-- État d'un étudiant sur une formation : terminée (toutes les leçons), à risque (rien depuis plus de 10 jours),
-- sinon en cours.
create or replace function public.etat_suivi(p_terminees integer, p_total integer, p_derniere timestamptz, p_maintenant timestamptz)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_total > 0 and p_terminees >= p_total then 'terminee'
    when p_derniere < p_maintenant - interval '10 days' then 'a_risque'
    else 'en_cours'
  end;
$$;

-- Une ligne par étudiant et par formation d'une fiche formateur. Étudiant : un compte qui a ouvert au moins une leçon
-- de la formation (pas encore d'inscription : lot 2). Le compte relié à la fiche et ceux de l'équipe ne comptent pas.
-- Interne : appelée seulement par les fonctions ci-dessous, jamais directement (aucun droit d'exécution).
create or replace function public.suivi_formateur(p_fiche uuid)
returns table (
  etudiant uuid,
  prenom text,
  nom text,
  formation uuid,
  formation_titre text,
  terminees integer,
  total integer,
  secondes integer,
  derniere_activite timestamptz,
  premiere_ouverture timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with mes_formations as (
    select
      f.id, f.titre, fo.compte_id,
      (select count(*) from public.lecons l join public.modules m on m.id = l.module_id where m.formation_id = f.id)::integer as nb_lecons
    from public.formations f
    join public.formateurs fo on fo.id = f.formateur_id
    where f.formateur_id = p_fiche
  )
  select
    p.profil_id, pr.prenom, pr.nom, mf.id, mf.titre,
    count(p.terminee_le)::integer,
    mf.nb_lecons,
    coalesce(sum(public.secondes_couvertes(p.passages)), 0)::integer,
    max(greatest(p.vue_le, p.terminee_le, p.dernier_envoi)),
    min(p.ouverte_le)
  from mes_formations mf
  join public.modules m on m.formation_id = mf.id
  join public.lecons l on l.module_id = m.id
  join public.progression_lecons p on p.lecon_id = l.id
  join public.profils pr on pr.id = p.profil_id
  where p.profil_id is distinct from mf.compte_id
    and not exists (select 1 from public.roles r where r.profil_id = p.profil_id and r.role in ('moderateur', 'admin', 'super_admin'))
  group by p.profil_id, pr.prenom, pr.nom, mf.id, mf.titre, mf.nb_lecons;
$$;
revoke execute on function public.suivi_formateur(uuid) from public, anon, authenticated;

-- ─── Remarques privées du formateur sur un étudiant ─────────────────────────────────────────────────
-- Une par formateur et par étudiant. Lues par leur auteur et par l'équipe, jamais par l'étudiant ; écrites seulement
-- par enregistrer_remarque (plus bas), qui vérifie que l'étudiant suit l'une des formations du formateur.
create table if not exists public.remarques_formateur (
  formateur uuid not null references public.profils (id) on delete cascade,
  etudiant uuid not null references public.profils (id) on delete cascade,
  texte text not null,
  modifiee_le timestamptz not null default now(),
  primary key (formateur, etudiant),
  constraint remarques_formateur_texte_longueur check (char_length(texte) between 1 and 2000)
);
alter table public.remarques_formateur enable row level security;
revoke all on public.remarques_formateur from anon;
revoke insert, update, delete, truncate on public.remarques_formateur from authenticated;

drop policy if exists "remarques : leur auteur et l'équipe" on public.remarques_formateur;
create policy "remarques : leur auteur et l'équipe" on public.remarques_formateur
  for select to authenticated
  using (formateur = (select auth.uid()) or (select public.equipe_contenus()));

-- Un compte suspendu ne lit plus rien (comme ses autres données, 0013).
drop policy if exists "compte suspendu : rien" on public.remarques_formateur;
create policy "compte suspendu : rien" on public.remarques_formateur
  as restrictive for all to authenticated
  using (not (select public.compte_suspendu())) with check (not (select public.compte_suspendu()));

-- ─── Les étudiants du formateur ─────────────────────────────────────────────────────────────────────
-- Une page de 25 lignes (étudiant, formation), les plus récemment actifs d'abord. Filtres : une de ses formations,
-- l'état (a_risque, terminees ; toute autre valeur : tous), le nom (sans accents ni majuscules, jamais de joker).
-- Jamais d'adresse e-mail.
create or replace function public.etudiants_formateur(
  p_recherche text default '',
  p_formation uuid default null,
  p_etat text default 'tous',
  p_page integer default 1,
  p_maintenant timestamptz default now()
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_fiche uuid := public.ma_fiche_formateur();
  v_q text := public.sans_accents(btrim(coalesce(p_recherche, '')));
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_resultat jsonb;
begin
  if v_fiche is null then
    raise exception 'Votre compte n’est pas encore relié à une fiche formateur.' using errcode = '42501';
  end if;

  with lignes as (
    select s.*, public.etat_suivi(s.terminees, s.total, s.derniere_activite, p_maintenant) as etat
    from public.suivi_formateur(v_fiche) s
  ),
  retenues as (
    select * from lignes x
    where (p_formation is null or x.formation = p_formation)
      and (v_q = '' or strpos(public.sans_accents(x.prenom || ' ' || x.nom), v_q) > 0)
      and case p_etat
        when 'a_risque' then x.etat = 'a_risque'
        when 'terminees' then x.etat = 'terminee'
        else true
      end
  ),
  page as (
    select * from retenues order by derniere_activite desc, etudiant, formation limit 25 offset (v_page - 1) * 25
  )
  select jsonb_build_object(
    'total', (select count(*) from retenues),
    'lignes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'etudiant_id', g.etudiant,
        'prenom', g.prenom,
        'nom', g.nom,
        'formation_id', g.formation,
        'formation_titre', g.formation_titre,
        'terminees', g.terminees,
        'total', g.total,
        'derniere_activite', g.derniere_activite,
        'etat', g.etat
      ) order by g.derniere_activite desc, g.etudiant, g.formation)
      from page g
    ), '[]'::jsonb)
  ) into v_resultat;
  return v_resultat;
end;
$$;

-- La fiche d'un étudiant : chacune des formations du formateur qu'il suit, leçon par leçon (terminée, ouverte, pas
-- encore ouverte ; temps de vidéo). Null s'il ne suit aucune de ses formations.
create or replace function public.etudiant_formateur(p_etudiant uuid, p_maintenant timestamptz default now())
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_fiche uuid := public.ma_fiche_formateur();
  v_resultat jsonb;
begin
  if v_fiche is null then
    raise exception 'Votre compte n’est pas encore relié à une fiche formateur.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.suivi_formateur(v_fiche) s where s.etudiant = p_etudiant) then
    return null;
  end if;

  select jsonb_build_object(
    'id', pr.id,
    'prenom', pr.prenom,
    'nom', pr.nom,
    'formations', (
      select jsonb_agg(jsonb_build_object(
        'id', s.formation,
        'titre', s.formation_titre,
        'terminees', s.terminees,
        'total', s.total,
        'secondes', s.secondes,
        'derniere_activite', s.derniere_activite,
        'etat', public.etat_suivi(s.terminees, s.total, s.derniere_activite, p_maintenant),
        'modules', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'id', m.id,
            'titre', m.titre,
            'lecons', (
              select coalesce(jsonb_agg(jsonb_build_object(
                'id', l.id,
                'titre', l.titre,
                'etat', case when p.terminee_le is not null then 'terminee' when p.lecon_id is not null then 'ouverte' else 'non_ouverte' end,
                'terminee_le', p.terminee_le,
                'secondes', coalesce(public.secondes_couvertes(p.passages), 0)
              ) order by l.ordre, l.cree_le), '[]'::jsonb)
              from public.lecons l
              left join public.progression_lecons p on p.lecon_id = l.id and p.profil_id = p_etudiant
              where l.module_id = m.id
            )
          ) order by m.ordre, m.cree_le), '[]'::jsonb)
          from public.modules m
          where m.formation_id = s.formation
        )
      ) order by s.derniere_activite desc)
      from public.suivi_formateur(v_fiche) s
      where s.etudiant = p_etudiant
    ),
    'remarque', (
      select jsonb_build_object('texte', r.texte, 'modifiee_le', r.modifiee_le)
      from public.remarques_formateur r
      where r.formateur = (select auth.uid()) and r.etudiant = p_etudiant
    )
  ) into v_resultat
  from public.profils pr
  where pr.id = p_etudiant;
  return v_resultat;
end;
$$;

revoke execute on function public.etudiants_formateur(text, uuid, text, integer, timestamptz) from public, anon;
revoke execute on function public.etudiant_formateur(uuid, timestamptz) from public, anon;
grant execute on function public.etudiants_formateur(text, uuid, text, integer, timestamptz) to authenticated;
grant execute on function public.etudiant_formateur(uuid, timestamptz) to authenticated;

-- ─── Écrire une remarque ────────────────────────────────────────────────────────────────────────────
-- Sur un étudiant de ses formations seulement. Espaces de début et de fin retirés ; vide : la remarque est supprimée.
create or replace function public.enregistrer_remarque(p_etudiant uuid, p_texte text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fiche uuid := public.ma_fiche_formateur();
  v_texte text := regexp_replace(coalesce(p_texte, ''), '^\s+|\s+$', '', 'g');
begin
  if v_fiche is null then
    raise exception 'Votre compte n’est pas encore relié à une fiche formateur.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.suivi_formateur(v_fiche) s where s.etudiant = p_etudiant) then
    raise exception 'Cet étudiant ne suit aucune de vos formations.';
  end if;
  if char_length(v_texte) = 0 then
    delete from public.remarques_formateur where formateur = (select auth.uid()) and etudiant = p_etudiant;
    return;
  end if;
  if char_length(v_texte) > 2000 then
    raise exception 'La remarque dépasse 2 000 caractères.';
  end if;
  insert into public.remarques_formateur (formateur, etudiant, texte)
  values ((select auth.uid()), p_etudiant, v_texte)
  on conflict (formateur, etudiant) do update set texte = excluded.texte, modifiee_le = now();
end;
$$;

-- Les remarques des formateurs sur un compte, pour l'équipe (fiche du compte au back-office), les plus récentes d'abord.
-- L'auteur est nommé par sa fiche formateur, sinon par son prénom et son nom.
create or replace function public.remarques_compte(p_compte uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.equipe_contenus() then
    raise exception 'Accès réservé à l’équipe.' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'formateur_nom', coalesce(
        (select fo.nom from public.formateurs fo where fo.compte_id = r.formateur),
        nullif(btrim(p.prenom || ' ' || p.nom), ''),
        'Formateur'
      ),
      'texte', r.texte,
      'modifiee_le', r.modifiee_le
    ) order by r.modifiee_le desc)
    from public.remarques_formateur r
    left join public.profils p on p.id = r.formateur
    where r.etudiant = p_compte
  ), '[]'::jsonb);
end;
$$;

-- ─── Tableau de bord du formateur (design NdFormateur) ──────────────────────────────────────────────
-- Ses formations (dont brouillons), ses étudiants (dont nouveaux ce mois, heure du Bénin : UTC+1 toute l'année),
-- la progression moyenne, les 5 étudiants les plus inactifs parmi ceux à risque, et le détail par formation.
create or replace function public.tableau_de_bord_formateur(p_maintenant timestamptz default now())
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_fiche uuid := public.ma_fiche_formateur();
  v_debut_mois timestamptz := (date_trunc('month', (p_maintenant at time zone 'UTC') + interval '1 hour') - interval '1 hour') at time zone 'UTC';
  v_resultat jsonb;
begin
  if v_fiche is null then
    raise exception 'Votre compte n’est pas encore relié à une fiche formateur.' using errcode = '42501';
  end if;

  with s as (
    select x.*, public.etat_suivi(x.terminees, x.total, x.derniere_activite, p_maintenant) as etat
    from public.suivi_formateur(v_fiche) x
  ),
  premieres as (
    select etudiant, min(premiere_ouverture) as premiere from s group by etudiant
  )
  select jsonb_build_object(
    'prenom', (select pr.prenom from public.profils pr where pr.id = (select auth.uid())),
    'formations', (
      select jsonb_build_object('total', count(*), 'brouillons', count(*) filter (where f.statut = 'brouillon'))
      from public.formations f where f.formateur_id = v_fiche
    ),
    'etudiants', jsonb_build_object(
      'total', (select count(*) from premieres),
      'ce_mois', (select count(*) from premieres where premiere >= v_debut_mois)
    ),
    'progression_moyenne', (select round(avg(s.terminees::numeric * 100 / s.total))::integer from s where s.total > 0),
    'a_risque', coalesce((
      select jsonb_agg(jsonb_build_object(
        'etudiant_id', r.etudiant,
        'prenom', r.prenom,
        'nom', r.nom,
        'formation_id', r.formation,
        'formation_titre', r.formation_titre,
        'jours', floor(extract(epoch from (p_maintenant - r.derniere_activite)) / 86400)::integer,
        'pourcentage', case when r.total > 0 then round(r.terminees::numeric * 100 / r.total)::integer else 0 end
      ) order by r.derniere_activite, r.etudiant)
      from (select * from s where s.etat = 'a_risque' order by s.derniere_activite, s.etudiant limit 5) r
    ), '[]'::jsonb),
    'formations_detail', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', f.id,
        'titre', f.titre,
        'statut', f.statut,
        'envoyee_le', f.envoyee_le,
        'renvoyee_le', f.renvoyee_le,
        'inscrits', (select count(*) from s where s.formation = f.id),
        'progression_moyenne', (select round(avg(s.terminees::numeric * 100 / s.total))::integer from s where s.formation = f.id and s.total > 0),
        'completion', (
          select case when count(*) = 0 then null else round(count(*) filter (where s.etat = 'terminee')::numeric * 100 / count(*))::integer end
          from s where s.formation = f.id
        ),
        'note_moyenne', f.note_moyenne,
        'nb_avis', f.nb_avis
      ) order by f.modifie_le desc, f.id)
      from public.formations f
      where f.formateur_id = v_fiche
    ), '[]'::jsonb)
  ) into v_resultat;
  return v_resultat;
end;
$$;

revoke execute on function public.enregistrer_remarque(uuid, text) from public, anon;
revoke execute on function public.remarques_compte(uuid) from public, anon;
revoke execute on function public.tableau_de_bord_formateur(timestamptz) from public, anon;
grant execute on function public.enregistrer_remarque(uuid, text) to authenticated;
grant execute on function public.remarques_compte(uuid) to authenticated;
grant execute on function public.tableau_de_bord_formateur(timestamptz) to authenticated;

commit;
