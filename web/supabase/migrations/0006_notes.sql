-- Étudium · migration 0006 : notes privées des leçons (tâche 1.5).
-- À appliquer dans Supabase, après la 0005 : SQL Editor → New query → coller tout le fichier → Run.
-- Rejouable : relancé sur une base qui l'a déjà, il ne change rien et ne casse rien.

begin;

-- Une note par compte et par leçon (onglet « Notes » de la page leçon). Personne d'autre ne la lit, pas même l'équipe.
create table if not exists public.notes_lecons (
  profil_id uuid not null default auth.uid() references public.profils (id) on delete cascade,
  lecon_id uuid not null references public.lecons (id) on delete cascade,
  -- Une note vide n'est pas gardée : l'application l'efface.
  texte text not null,
  modifie_le timestamptz not null default now(),
  primary key (profil_id, lecon_id),
  constraint notes_lecons_texte_longueur check (char_length(texte) between 1 and 5000)
);
create index if not exists notes_lecons_lecon_idx on public.notes_lecons (lecon_id);

drop trigger if exists notes_lecons_modifie_le on public.notes_lecons;
create trigger notes_lecons_modifie_le before update on public.notes_lecons
  for each row execute function public.toucher_modifie_le();

alter table public.notes_lecons enable row level security;

-- Un visiteur n'y touche pas ; personne ne vide la table d'un coup par l'API.
revoke all on public.notes_lecons from anon;
revoke truncate on public.notes_lecons from authenticated;

-- Chacun ses notes. On n'écrit que sur une leçon qu'on peut suivre ; une note reste lisible et effaçable si l'accès
-- se perd ensuite (formation archivée).
drop policy if exists "ses notes : lecture" on public.notes_lecons;
create policy "ses notes : lecture" on public.notes_lecons
  for select to authenticated
  using (profil_id = (select auth.uid()));

drop policy if exists "ses notes : ajout" on public.notes_lecons;
create policy "ses notes : ajout" on public.notes_lecons
  for insert to authenticated
  with check (profil_id = (select auth.uid()) and public.acces_lecon(lecon_id));

drop policy if exists "ses notes : modification" on public.notes_lecons;
create policy "ses notes : modification" on public.notes_lecons
  for update to authenticated
  using (profil_id = (select auth.uid()))
  with check (profil_id = (select auth.uid()) and public.acces_lecon(lecon_id));

drop policy if exists "ses notes : suppression" on public.notes_lecons;
create policy "ses notes : suppression" on public.notes_lecons
  for delete to authenticated
  using (profil_id = (select auth.uid()));

commit;
