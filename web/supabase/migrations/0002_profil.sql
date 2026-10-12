-- Étudium · migration 0002 : profil (tâche 0.5) — droits d'écriture, longueurs, photos, suppression du compte.
-- À appliquer dans Supabase, après la 0001 : SQL Editor → New query → coller tout le fichier → Run.
-- Rejouable : relancé sur une base qui l'a déjà, il ne change rien et ne casse rien.

-- ─── Chacun ne modifie que les champs de son profil (ni id, ni dates) ───────
revoke update on public.profils from authenticated, anon;
grant update (prenom, nom, telephone, pays, niveau_etudes, etablissement, filiere, objectifs, photo_url, preferences_notifications)
  on public.profils to authenticated;

-- ─── Longueurs maximales (les mêmes que les formulaires) ────────────────────
do $$ begin
  alter table public.profils add constraint profils_telephone_longueur check (telephone is null or char_length(telephone) <= 30);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.profils add constraint profils_pays_longueur check (pays is null or char_length(pays) <= 60);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.profils add constraint profils_niveau_etudes_longueur check (niveau_etudes is null or char_length(niveau_etudes) <= 60);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.profils add constraint profils_etablissement_longueur check (etablissement is null or char_length(etablissement) <= 120);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.profils add constraint profils_filiere_longueur check (filiere is null or char_length(filiere) <= 120);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.profils add constraint profils_objectifs_longueur check (objectifs is null or char_length(objectifs) <= 500);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.profils add constraint profils_photo_url_longueur check (photo_url is null or char_length(photo_url) <= 500);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.profils add constraint profils_preferences_objet check (jsonb_typeof(preferences_notifications) = 'object');
exception when duplicate_object then null; end $$;

-- ─── Photos lisibles par leur adresse (noms de fichier aléatoires) ──────────
-- La liste du dossier reste réservée à son propriétaire (règles de la 0001).
update storage.buckets set public = true where id = 'photos-profil';

-- ─── Supprimer son propre compte (profil et rôles suivent par cascade) ──────
create or replace function public.supprimer_mon_compte()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'non connecté';
  end if;
  delete from auth.users where id = (select auth.uid());
end;
$$;

revoke execute on function public.supprimer_mon_compte() from public, anon;
grant execute on function public.supprimer_mon_compte() to authenticated;
