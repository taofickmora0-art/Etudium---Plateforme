-- Migration 0078 : le blocage du code de « Mes résultats » s'allonge (ta décision du 5 novembre 2026, après la
-- relecture de la 0077).
--   - 5 codes faux : bloqué 15 minutes ; 5 de plus : 1 heure ; puis 24 heures à chaque fois.
--   - Le bon code remet le compte à zéro, comme un nouveau code ou un code retiré (ou oublié).
--   - Pendant un blocage, le message dit le temps qui reste, en minutes, puis en heures au-delà d'une heure.
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

commit;
