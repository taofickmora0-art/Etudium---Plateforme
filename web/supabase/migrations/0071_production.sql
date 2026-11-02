-- Migration 0071 : la production (spec de la mise en ligne du 2 novembre 2026, §1.1).
--   - Les trois parcours de base. Une base de production est vide : seuls les exemples (exemples/lot-1.sql, jamais en
--     production) les créaient. La landing (src/lib/landing/textes.ts), le filtre du catalogue et la monétisation (0048)
--     s'appuient sur leurs adresses et leurs couleurs. Ils sont insérés avec les textes et l'ordre de lot-1.sql s'ils
--     n'existent pas (par adresse) ; un parcours qui existe déjà (base de test, textes revus au back-office) n'est pas
--     touché.
--   - Le jeton des envois sans manipulation, comme celui des paiements (0049) : l'appli le tire d'une clé qu'elle a déjà
--     (HMAC-SHA256 de RESEND_API_KEY, à défaut de VAPID_PRIVATE_KEY, avec l'étiquette « etudium:jeton-des-envois ») ;
--     un administrateur clique « Activer les envois » au back-office, ce qui en enregistre l'empreinte
--     (enregistrer_jeton_envois) ; etat_envois dit au back-office si le jeton du serveur est celui enregistré. Plus rien
--     à recopier depuis l'éditeur SQL : le jeton affiché par la 0058 (nouveau_jeton_envois) ne sert plus, et un nouveau
--     clic le remplace.
-- À appliquer après la 0070. Rejouable.

begin;

-- ─── Les trois parcours de base ─────────────────────────────────────────────────────────────────────
insert into public.parcours (slug, nom, nom_court, description, couleur, ordre, actif) values
  ('reussite-academique', 'Réussite académique', 'Académique',
   'Les outils et méthodes pour réussir à l’université : bureautique, recherche, rédaction scientifique et soutenance.', 'academique', 1, true),
  ('competences-digitales', 'Compétences digitales', 'Digital',
   'Design, intelligence artificielle, contenu et automatisation : les compétences numériques recherchées.', 'digital', 2, true),
  ('business-revenus-en-ligne', 'Business & revenus en ligne', 'Business',
   'Freelance, produits digitaux et vente en ligne : créer une activité grâce au numérique.', 'business', 3, true)
on conflict (slug) do nothing;

-- ─── Le jeton des envois ────────────────────────────────────────────────────────────────────────────
-- « Activer les envois » : un administrateur actif (même garde que activer_paiements, 0049) pose l'empreinte SHA-256 du
-- jeton du serveur, que exiger_jeton_envois (0058) compare ensuite. Le jeton lui-même n'est jamais gardé.
create or replace function public.enregistrer_jeton_envois(p_jeton text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.exiger_compte_actif();
  if not public.equipe_paiements() then
    raise exception 'Réservé aux administrateurs.' using errcode = '42501';
  end if;
  if char_length(coalesce(p_jeton, '')) < 32 then
    raise exception 'Le jeton des envois doit compter au moins 32 caractères.';
  end if;
  insert into public.reglages_envois (id, empreinte)
  values (true, encode(sha256(convert_to(p_jeton, 'UTF8')), 'hex'))
  on conflict (id) do update set empreinte = excluded.empreinte;
end;
$$;

-- Pour le back-office : 'actifs' si le jeton du serveur est celui enregistré, 'a_activer' sinon (jamais activé, clé
-- changée, jeton vide). Réservé aux administrateurs connectés, comme etat_paiements.
create or replace function public.etat_envois(p_jeton text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.exiger_equipe_admin();
  if char_length(coalesce(p_jeton, '')) >= 32
     and encode(sha256(convert_to(p_jeton, 'UTF8')), 'hex') = (select r.empreinte from public.reglages_envois r where r.id) then
    return 'actifs';
  end if;
  return 'a_activer';
end;
$$;

-- ─── Droits ─────────────────────────────────────────────────────────────────────────────────────────
revoke execute on function public.enregistrer_jeton_envois(text) from public, anon, authenticated;
revoke execute on function public.etat_envois(text) from public, anon, authenticated;
grant execute on function public.enregistrer_jeton_envois(text) to authenticated;
grant execute on function public.etat_envois(text) to authenticated;

commit;
