-- Migration 0027 : le statut d'une leçon et le rangement des sections et des leçons
-- (spec docs/superpowers/specs/2026-10-15-refonte-formations-design.md, §3 et §4, étape A).
--
-- Une leçon est « brouillon » ou « publiée » : les étudiants ne voient que les publiées (programme, accès, avis à 50 %,
-- suivi du formateur, statistiques) ; l'équipe et le formateur de la formation voient tout. La notification « Nouvelle
-- leçon » part à la publication de la leçon. `ranger` place une section ou une leçon à un rang donné, une leçon pouvant
-- changer de section dans sa formation. Rejouable.

-- ─── Les colonnes ──────────────────────────────────────────────────────────────────────────────────
-- Les leçons déjà là restent publiées ; ensuite, une leçon naît en brouillon (l'application choisit).
alter table public.lecons add column if not exists publiee boolean not null default true;
alter table public.lecons alter column publiee set default false;
alter table public.lecons add column if not exists commentaires_actifs boolean not null default true;

-- ─── Lire une leçon : publiée, ou l'équipe et le formateur de la formation ─────────────────────────
drop policy if exists "leçons d'un module visible" on public.lecons;
create policy "leçons d'un module visible" on public.lecons
  for select to anon, authenticated
  using (
    exists (select 1 from public.modules m where m.id = lecons.module_id)
    and (lecons.publiee or public.equipe_contenus() or public.formateur_de(public.formation_du_module(lecons.module_id)))
  );

-- ─── L'accès d'un étudiant : une leçon publiée ─────────────────────────────────────────────────────
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
    or exists (
      select 1
      from public.lecons l
      join public.modules m on m.id = l.module_id
      join public.formations f on f.id = m.formation_id
      where l.id = p_lecon
        and f.statut = 'publiee'
        and l.publiee
        and (l.apercu or (f.gratuite and (select auth.uid()) is not null))
    )
  );
$$;

-- ─── Ne comptent que les leçons publiées ───────────────────────────────────────────────────────────
create or replace function public.peut_donner_avis(p_formation uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and not public.compte_suspendu()
    and not public.formateur_de(p_formation)
    and exists (select 1 from public.formations f where f.id = p_formation and f.statut = 'publiee')
    and (
      select count(*) > 0 and count(p.terminee_le) * 2 >= count(*)
      from public.lecons l
      join public.modules m on m.id = l.module_id
      left join public.progression_lecons p on p.lecon_id = l.id and p.profil_id = (select auth.uid())
      where m.formation_id = p_formation and l.publiee
    );
$$;

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
      (select count(*) from public.lecons l join public.modules m on m.id = l.module_id where m.formation_id = f.id and l.publiee)::integer as nb_lecons
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
  join public.lecons l on l.module_id = m.id and l.publiee
  join public.progression_lecons p on p.lecon_id = l.id
  join public.profils pr on pr.id = p.profil_id
  where p.profil_id is distinct from mf.compte_id
    and not exists (select 1 from public.roles r where r.profil_id = p.profil_id and r.role in ('moderateur', 'admin', 'super_admin'))
  group by p.profil_id, pr.prenom, pr.nom, mf.id, mf.titre, mf.nb_lecons;
$$;

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
              where l.module_id = m.id and l.publiee
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

create or replace function public.statistiques_back_office(p_maintenant timestamptz default now())
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_mois timestamptz := date_trunc('month', p_maintenant);
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
      where l.publiee
      group by p.profil_id, m.formation_id
    ),
    totaux as (
      select m.formation_id, count(*) as lecons
      from public.lecons l
      join public.modules m on m.id = l.module_id
      where l.publiee
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
    'formations_suivies', coalesce((select jsonb_agg(jsonb_build_object('titre', titre, 'slug', slug, 'etudiants', etudiants) order by etudiants desc, titre) from top), '[]'::jsonb)
  )
  into v_resultat;

  return v_resultat;
end;
$$;

create or replace function public.compte_equipe(p_compte uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_resultat jsonb;
begin
  if not public.equipe_contenus() then
    raise exception 'Accès réservé à l’équipe.' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'id', p.id,
    'prenom', p.prenom,
    'nom', p.nom,
    'email', coalesce(u.email, ''),
    'inscrit_le', p.cree_le,
    'derniere_connexion', u.last_sign_in_at,
    'roles', to_jsonb(coalesce((select array_agg(r.role order by r.role) from public.roles r where r.profil_id = p.id), '{}')::text[]),
    'suspension', (
      select jsonb_build_object('depuis', s.depuis, 'par_nom', coalesce(btrim(a.prenom || ' ' || a.nom), ''), 'motif', s.motif)
      from public.suspensions s
      left join public.profils a on a.id = s.par
      where s.profil_id = p.id
    ),
    'fiche_formateur', (select jsonb_build_object('id', f.id, 'nom', f.nom) from public.formateurs f where f.compte_id = p.id),
    'formations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id, 'titre', t.titre, 'slug', t.slug, 'terminees', t.terminees, 'total', t.total, 'derniere_activite', t.derniere_activite
      ) order by t.derniere_activite desc)
      from (
        select
          fo.id, fo.titre, fo.slug,
          count(pl.terminee_le) filter (where l.publiee) as terminees,
          (select count(*) from public.lecons l2 join public.modules m2 on m2.id = l2.module_id where m2.formation_id = fo.id and l2.publiee) as total,
          max(greatest(pl.vue_le, pl.terminee_le, pl.dernier_envoi)) as derniere_activite
        from public.progression_lecons pl
        join public.lecons l on l.id = pl.lecon_id
        join public.modules m on m.id = l.module_id
        join public.formations fo on fo.id = m.formation_id
        where pl.profil_id = p.id
        group by fo.id
      ) t
    ), '[]'::jsonb),
    'avis', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', av.id, 'formation_titre', fo.titre, 'note', av.note, 'commentaire', av.commentaire, 'masque', av.masque, 'cree_le', av.cree_le
      ) order by av.cree_le desc)
      from public.avis av
      join public.formations fo on fo.id = av.formation_id
      where av.profil_id = p.id
    ), '[]'::jsonb)
  ) into v_resultat
  from public.profils p
  left join auth.users u on u.id = p.id
  where p.id = p_compte;
  return v_resultat;
end;
$$;

-- ─── Envoyer en relecture : au moins une leçon publiée ─────────────────────────────────────────────
create or replace function public.envoyer_en_relecture(p_formation uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.formateur_de(p_formation) then
    raise exception 'Cette formation n’est pas la vôtre.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.formations where id = p_formation and statut = 'brouillon') then
    raise exception 'Seul un brouillon s’envoie en relecture.';
  end if;
  if not exists (
    select 1 from public.lecons l join public.modules m on m.id = l.module_id where m.formation_id = p_formation and l.publiee
  ) then
    raise exception 'Publiez au moins une leçon avant d’envoyer la formation en relecture.';
  end if;
  update public.formations
  set envoyee_le = now(), renvoyee_le = null, remarque_relecture = null
  where id = p_formation;
end;
$$;

-- ─── « Nouvelle leçon » : à sa publication ─────────────────────────────────────────────────────────
create or replace function public.notifications_lecons()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_formation record;
begin
  select f.id, f.titre, f.slug, f.statut into v_formation
  from public.modules m
  join public.formations f on f.id = m.formation_id
  where m.id = new.module_id;
  -- À la publication de la leçon (insérée publiée, ou passée de brouillon à publiée), pas à chaque modification.
  if found and v_formation.statut = 'publiee' and new.publiee and (tg_op = 'INSERT' or not old.publiee) then
    perform public.notifier(
      public.suiveurs_formation(v_formation.id), 'nouveaux_contenus', 'Nouvelle leçon dans ' || v_formation.titre,
      new.titre, '/formations/' || v_formation.slug || '/lecons/' || new.id
    );
  end if;
  return null;
end;
$$;

drop trigger if exists notifications_lecons on public.lecons;
create trigger notifications_lecons
  after insert or update of publiee on public.lecons
  for each row execute function public.notifications_lecons();

-- ─── Ranger une section ou une leçon ───────────────────────────────────────────────────────────────
-- Comme `deplacer` (0005), avec les droits de qui appelle : les règles d'écriture décident (équipe, ou formateur de
-- la formation) ; sans droit, rien ne bouge. Une leçon peut changer de section, dans sa formation seulement.
create or replace function public.ranger(p_table text, p_id uuid, p_parent uuid, p_position integer)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_groupe uuid;
  v_depart uuid;
  v_ids uuid[];
  v_rang integer;
begin
  if p_table = 'modules' then
    select formation_id into v_groupe from public.modules where id = p_id;
    if v_groupe is null then
      return;
    end if;
    select coalesce(array_agg(id order by ordre, cree_le, id), '{}') into v_ids
    from public.modules where formation_id = v_groupe and id <> p_id;
  elsif p_table = 'lecons' then
    select module_id into v_depart from public.lecons where id = p_id;
    if v_depart is null then
      return;
    end if;
    v_groupe := coalesce(p_parent, v_depart);
    if public.formation_du_module(v_groupe) is distinct from public.formation_du_module(v_depart) then
      raise exception 'Cette section n’est pas dans la même formation.';
    end if;
    if v_groupe <> v_depart then
      update public.lecons set module_id = v_groupe where id = p_id;
      if not found then
        return;
      end if;
    end if;
    select coalesce(array_agg(id order by ordre, cree_le, id), '{}') into v_ids
    from public.lecons where module_id = v_groupe and id <> p_id;
  else
    raise exception 'Table non prévue pour un rangement : %', p_table;
  end if;

  -- L'élément à son rang (borné), puis 1…n dans l'ordre.
  v_rang := least(greatest(coalesce(p_position, 1), 1), coalesce(array_length(v_ids, 1), 0) + 1);
  v_ids := v_ids[1:v_rang - 1] || p_id || v_ids[v_rang:];
  if p_table = 'modules' then
    update public.modules t set ordre = n.rang
    from unnest(v_ids) with ordinality as n(id, rang)
    where t.id = n.id and t.ordre is distinct from n.rang;
  else
    update public.lecons t set ordre = n.rang
    from unnest(v_ids) with ordinality as n(id, rang)
    where t.id = n.id and t.ordre is distinct from n.rang;
    -- La section quittée : 1…n, sans trou.
    if v_groupe <> v_depart then
      update public.lecons t set ordre = n.rang
      from (select id, row_number() over (order by ordre, cree_le, id) as rang from public.lecons where module_id = v_depart) as n
      where t.id = n.id and t.ordre is distinct from n.rang;
    end if;
  end if;
end;
$$;

revoke execute on function public.ranger(text, uuid, uuid, integer) from public, anon;
grant execute on function public.ranger(text, uuid, uuid, integer) to authenticated;
