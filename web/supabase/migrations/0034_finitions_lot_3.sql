-- Étudium, migration 0034 : finitions du lot 3 (défauts reportés des étapes A et B).
--
-- - Un quiz se réussit et un exercice se termine depuis sa page : « Terminer la leçon » (terminer_lecon) les refuse,
--   même appelé directement, pour qu'un étudiant ne fausse pas sa propre progression.
-- - La notification de publication dit ce qui paraît : « Nouveau quiz », « Nouvel exercice » ou « Nouvelle leçon ».
-- - Garde-fous : un choix ou une réponse acceptée d'un quiz tient en 300 caractères (comme dans l'appli) ; un fichier
--   déposé ne s'attache qu'à un seul rendu.
--
-- Rien de nouveau à lire pour l'appli : elle marche avant comme après. À coller dans l'éditeur SQL de Supabase, après
-- la 0033. Rejouable.

begin;

-- ─── Terminer une leçon (reprise de la 0030) : jamais un quiz ni un exercice ─────────────────────────
create or replace function public.terminer_lecon(p_lecon uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type text;
begin
  if (select auth.uid()) is null or not public.acces_lecon(p_lecon) then
    raise exception 'Leçon inaccessible.' using errcode = '42501';
  end if;
  select l.type into v_type from public.lecons l where l.id = p_lecon;
  if v_type = 'quiz' then
    raise exception 'Un quiz se réussit, il ne se termine pas.' using errcode = '22023';
  end if;
  if v_type = 'exercice' then
    raise exception 'Un exercice se termine depuis sa page.' using errcode = '22023';
  end if;
  -- YouTube et Vimeo se terminent en les regardant (seuil). Une vidéo sans mesure (Drive, Loom, ScreenPal) se
  -- termine d'un clic ; TikTok et Tella aussi, en secours quand leur lecteur ne répond pas.
  if exists (
    select 1 from public.lecons_contenus c
    where c.lecon_id = p_lecon and c.video_id is not null and c.video_fournisseur::text in ('youtube', 'vimeo')
  ) then
    raise exception 'Une leçon vidéo se termine en la regardant.' using errcode = '22023';
  end if;
  insert into public.progression_lecons (profil_id, lecon_id, terminee_le)
  values ((select auth.uid()), p_lecon, now())
  on conflict (profil_id, lecon_id) do update
    set terminee_le = coalesce(public.progression_lecons.terminee_le, now()),
        vue_le = now();
end;
$$;

-- ─── La notification de publication (reprise de la 0027) : selon ce qui paraît ──────────────────────
create or replace function public.notifications_lecons()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_formation record;
  v_titre text;
begin
  select f.id, f.titre, f.slug, f.statut into v_formation
  from public.modules m
  join public.formations f on f.id = m.formation_id
  where m.id = new.module_id;
  -- À la publication (insérée publiée, ou passée de brouillon à publiée), pas à chaque modification.
  if found and v_formation.statut = 'publiee' and new.publiee and (tg_op = 'INSERT' or not old.publiee) then
    v_titre := case new.type
      when 'quiz' then 'Nouveau quiz dans '
      when 'exercice' then 'Nouvel exercice dans '
      else 'Nouvelle leçon dans '
    end || v_formation.titre;
    perform public.notifier(
      public.suiveurs_formation(v_formation.id), 'nouveaux_contenus', v_titre,
      new.titre, '/formations/' || v_formation.slug || '/lecons/' || new.id
    );
  end if;
  return null;
end;
$$;

-- ─── Les réponses d'un quiz : 300 caractères au plus (comme dans l'appli) ────────────────────────────
create or replace function public.longueurs_quiz_ok(p_choix jsonb, p_reponses text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce((
      select bool_and(char_length(coalesce(c ->> 'texte', '')) <= 300)
      from jsonb_array_elements(case when jsonb_typeof(p_choix) = 'array' then p_choix else '[]'::jsonb end) c
    ), true)
    and coalesce((select bool_and(char_length(r) <= 300) from unnest(p_reponses) r), true);
$$;

-- « not valid » : vérifiée pour toute question écrite ou réécrite, sans bloquer une ancienne ligne laissée telle quelle.
alter table public.questions_quiz drop constraint if exists questions_quiz_longueurs;
alter table public.questions_quiz add constraint questions_quiz_longueurs check (public.longueurs_quiz_ok(choix, reponses)) not valid;

-- ─── Un fichier déposé ne s'attache qu'à un seul rendu ───────────────────────────────────────────────
create unique index if not exists rendus_exercices_fichier_unique on public.rendus_exercices (fichier) where fichier is not null;

revoke execute on function public.longueurs_quiz_ok(jsonb, text[]) from public, anon, authenticated;

commit;
