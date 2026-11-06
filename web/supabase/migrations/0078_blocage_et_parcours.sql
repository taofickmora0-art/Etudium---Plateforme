-- Migration 0078 (tes décisions du 5 novembre 2026) :
--   1. Le blocage du code de « Mes résultats » s'allonge.
--      - 5 codes faux : bloqué 15 minutes ; 5 de plus : 1 heure ; puis 24 heures à chaque fois.
--      - Le bon code remet le compte à zéro, comme un nouveau code ou un code retiré (ou oublié).
--      - Pendant un blocage, le message dit le temps qui reste, en minutes, puis en heures au-delà d'une heure.
--   2. Trois parcours : Réussite académique, Compétences digitales, Entrepreneuriat.
--      - Compétences digitales reprend le contenu de Business & revenus en ligne : ses formations (à la suite des
--        siennes), ses livres et ses sessions.
--      - La place de Business (sa ligne, sa couleur orange, son groupe et son espace de la communauté, avec leurs
--        messages) devient Entrepreneuriat. Rien n'est supprimé.
--      - « Compétences à vendre » (0048) : la formation qui apprend à vendre une compétence est dans Compétences
--        digitales ou Entrepreneuriat ; la compétence, toujours dans Compétences digitales.
--   3. Une formation sans formateur est présentée par l'Équipe Étudium (son profil : /formateurs/etudium).
-- À appliquer après la 0077. Rejouable.

begin;

-- Le nombre de blocages depuis le dernier bon code.
alter table public.verrou_resultats add column if not exists blocages integer not null default 0;

-- Un nouveau code (créé, retiré, oublié) repart de zéro.
create or replace function public.remettre_blocages_resultats()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.empreinte is distinct from old.empreinte then
    new.blocages := 0;
  end if;
  return new;
end;
$$;

drop trigger if exists remettre_blocages_resultats on public.verrou_resultats;
create trigger remettre_blocages_resultats before update on public.verrou_resultats for each row execute function public.remettre_blocages_resultats();

-- « 12 minutes », « 1 heure », « 24 heures » : le temps qui reste avant `fin`.
create or replace function public.attente_resultats(fin timestamptz)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  minutes integer := greatest(1, ceil(extract(epoch from fin - now()) / 60)::integer);
  heures integer;
begin
  if minutes < 60 then
    return minutes || case when minutes > 1 then ' minutes' else ' minute' end;
  end if;
  heures := ceil(minutes / 60.0)::integer;
  return heures || case when heures > 1 then ' heures' else ' heure' end;
end;
$$;

-- Vérifie le code (ouvrir, changer, retirer) : le résultat est rendu, jamais levé, pour que l'erreur comptée reste.
create or replace function public.verifier_pin_resultats(p_pin text, p_quoi text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.verrou_resultats%rowtype;
  restants integer;
  duree interval;
begin
  select * into v from public.verrou_resultats where profil_id = (select auth.uid()) for update;
  if not found or v.empreinte is null then
    return jsonb_build_object('ok', true);
  end if;
  if v.bloque_jusqua is not null and v.bloque_jusqua > now() then
    return jsonb_build_object('ok', false, 'message', 'Trop d’essais : réessaie dans ' || public.attente_resultats(v.bloque_jusqua) || '.');
  end if;
  if coalesce(p_pin, '') ~ '^[0-9]{4}$' and public.empreinte_pin_resultats(v.sel, p_pin) = v.empreinte then
    update public.verrou_resultats set echecs = 0, blocages = 0, bloque_jusqua = null where profil_id = v.profil_id;
    return jsonb_build_object('ok', true);
  end if;
  if v.echecs + 1 >= 5 then
    duree := case v.blocages when 0 then interval '15 minutes' when 1 then interval '1 hour' else interval '24 hours' end;
    update public.verrou_resultats set echecs = 0, blocages = v.blocages + 1, bloque_jusqua = now() + duree where profil_id = v.profil_id;
    return jsonb_build_object('ok', false, 'message', 'Trop d’essais : réessaie dans ' || public.attente_resultats(now() + duree) || '.');
  end if;
  update public.verrou_resultats set echecs = v.echecs + 1 where profil_id = v.profil_id;
  restants := 5 - (v.echecs + 1);
  return jsonb_build_object('ok', false, 'message', p_quoi || ' incorrect. Encore ' || restants || case when restants > 1 then ' essais.' else ' essai.' end);
end;
$$;

revoke execute on function public.remettre_blocages_resultats() from public, anon, authenticated;
revoke execute on function public.attente_resultats(timestamptz) from public, anon, authenticated;
revoke execute on function public.verifier_pin_resultats(text, text) from public, anon, authenticated;


-- ─── 2. Les trois parcours ──────────────────────────────────────────────────────────────────────────
do $$
declare
  v_digital uuid := (select p.id from public.parcours p where p.slug = 'competences-digitales');
  v_business uuid := (select p.id from public.parcours p where p.slug = 'business-revenus-en-ligne');
  v_suite integer;
begin
  -- Déjà fait (Business est devenu Entrepreneuriat), ou base sans ces parcours : rien à faire.
  if v_digital is null or v_business is null then
    return;
  end if;
  -- Les formations de Business, à la suite de celles de Compétences digitales (une seule fois si elle y était déjà).
  v_suite := (select coalesce(max(fp.ordre), 0) from public.formations_parcours fp where fp.parcours_id = v_digital);
  insert into public.formations_parcours (formation_id, parcours_id, ordre)
  select fp.formation_id, v_digital, v_suite + row_number() over (order by fp.ordre, fp.formation_id)
  from public.formations_parcours fp
  where fp.parcours_id = v_business
    and not exists (select 1 from public.formations_parcours d where d.parcours_id = v_digital and d.formation_id = fp.formation_id);
  delete from public.formations_parcours fp where fp.parcours_id = v_business;
  insert into public.livres_parcours (livre_id, parcours_id)
  select lp.livre_id, v_digital from public.livres_parcours lp where lp.parcours_id = v_business
  on conflict do nothing;
  delete from public.livres_parcours lp where lp.parcours_id = v_business;
  update public.sessions_live s set parcours_id = v_digital where s.parcours_id = v_business;

  update public.parcours p
  set description = 'Design, intelligence artificielle, contenu, automatisation, freelance et vente en ligne : les compétences numériques recherchées, et comment en vivre.'
  where p.id = v_digital;
  -- Le groupe suit le nom du parcours (0075) ; son adresse, elle, est changée ici.
  update public.parcours p
  set slug = 'entrepreneuriat',
      nom = 'Entrepreneuriat',
      nom_court = 'Entrepreneuriat',
      description = 'De l’idée à l’entreprise : trouver une idée, bâtir son projet, le financer et le gérer, pendant ses études et après.'
  where p.id = v_business;
  update public.groupes g set slug = public.slug_groupe_libre('entrepreneuriat', g.id) where g.parcours_id = v_business;
end;
$$;

-- « Compétences à vendre » : depuis une formation de Compétences digitales ou d'Entrepreneuriat, vers une compétence
-- publiée de Compétences digitales.
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
    where fp.formation_id = new.business_id and pa.couleur in ('digital', 'business')
  ) then
    raise exception 'Seule une formation de Compétences digitales ou d’Entrepreneuriat se lie à une compétence.';
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

-- ─── Changer une formation de parcours (0066) : ses liens « compétences à vendre » restent valables ─────
create or replace function public.changer_parcours_formation(p_formation uuid, p_depuis uuid, p_vers uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_message constant text := 'Cette formation est liée à une compétence (« Compétences à vendre ») : retirez d’abord ce lien dans sa fiche.';
begin
  perform public.exiger_equipe_contenus_parcours();
  if p_depuis = p_vers then
    return;
  end if;
  if not exists (select 1 from public.formations_parcours fp where fp.parcours_id = p_depuis and fp.formation_id = p_formation) then
    raise exception 'Cette formation n’est pas dans ce parcours.';
  end if;
  if not exists (select 1 from public.parcours p where p.id = p_vers) then
    raise exception 'Ce parcours n’existe plus.';
  end if;
  -- Ses liens « compétences à vendre » doivent rester valables : la formation qui apprend à vendre reste dans
  -- Compétences digitales ou Entrepreneuriat, la compétence dans Compétences digitales (0078).
  if exists (select 1 from public.formations_monetisation fm where fm.business_id = p_formation)
     and not exists (
       select 1 from public.parcours pa
       where pa.couleur in ('digital', 'business')
         and (pa.id = p_vers or pa.id in (select fp.parcours_id from public.formations_parcours fp where fp.formation_id = p_formation and fp.parcours_id <> p_depuis))
     ) then
    raise exception '%', v_message;
  end if;
  if exists (select 1 from public.formations_monetisation fm where fm.competence_id = p_formation)
     and not exists (
       select 1 from public.parcours pa
       where pa.couleur = 'digital'
         and (pa.id = p_vers or pa.id in (select fp.parcours_id from public.formations_parcours fp where fp.formation_id = p_formation and fp.parcours_id <> p_depuis))
     ) then
    raise exception '%', v_message;
  end if;
  perform 1 from public.parcours p where p.id = p_vers for update;
  delete from public.formations_parcours fp where fp.formation_id = p_formation and fp.parcours_id = p_depuis;
  insert into public.formations_parcours (formation_id, parcours_id, ordre)
  values (p_formation, p_vers, (select coalesce(max(fp.ordre), 0) + 1 from public.formations_parcours fp where fp.parcours_id = p_vers))
  on conflict do nothing;
end;
$$;

revoke execute on function public.verifier_monetisation() from public, anon, authenticated;

-- ─── 3. L'Équipe Étudium, formatrice des formations sans formateur ──────────────────────────────────
-- Une formation sans formateur (réalisée avec un coach qui n'est pas sur Étudium) est présentée par l'Équipe Étudium :
-- son profil public (/formateurs/etudium) a la même forme que celui d'un formateur (0070), avec ces formations.
create or replace function public.formateur_etudium()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with publiees as (
    select
      f.*,
      (select count(*) from public.modules m where m.formation_id = f.id)::integer as nb_modules,
      (
        select count(*) from public.lecons l join public.modules m on m.id = l.module_id
        where m.formation_id = f.id and l.publiee and l.type = 'lecon'
      )::integer as nb_lecons,
      (
        select coalesce(sum(l.duree_secondes), 0) from public.lecons l join public.modules m on m.id = l.module_id
        where m.formation_id = f.id and l.publiee and l.type = 'lecon'
      )::integer as duree_secondes,
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'slug', pa.slug, 'nom', pa.nom, 'nom_court', pa.nom_court, 'couleur', pa.couleur, 'ordre', pa.ordre, 'position', fp.ordre
        ) order by pa.ordre, pa.cree_le)
        from public.formations_parcours fp
        join public.parcours pa on pa.id = fp.parcours_id
        where fp.formation_id = f.id and pa.actif
      ), '[]'::jsonb) as parcours
    from public.formations f
    where f.formateur_id is null and f.statut = 'publiee'
  )
  select jsonb_build_object(
    'id', 'etudium',
    'nom', 'Équipe Étudium',
    'titre', 'L’équipe pédagogique d’Étudium',
    'domaine', '',
    'presentation', 'Des formations conçues par Étudium avec des coachs et des experts de chaque domaine.',
    'reseaux', '{}'::jsonb,
    'photo', null,
    'rejoint_le', null,
    'formations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', x.id,
        'slug', x.slug,
        'titre', x.titre,
        'resume', x.resume,
        'couverture', x.couverture,
        'niveau', x.niveau,
        'gratuite', x.gratuite,
        'badge', x.badge,
        'publiee_le', x.publiee_le,
        'duree_secondes', x.duree_secondes,
        'nb_lecons', x.nb_lecons,
        'nb_modules', x.nb_modules,
        'note_moyenne', x.note_moyenne,
        'nb_avis', x.nb_avis,
        'parcours', x.parcours
      ) order by x.publiee_le desc nulls last, x.titre)
      from publiees x
    ), '[]'::jsonb),
    'nb_formations', (select count(*) from publiees)::integer,
    'peut_ecrire', false
  );
$$;

revoke execute on function public.formateur_etudium() from public;
grant execute on function public.formateur_etudium() to anon, authenticated;

commit;
