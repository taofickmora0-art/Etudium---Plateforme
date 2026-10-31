-- Migration 0037 : répondre à une réponse prévient la bonne personne (liste du 31 octobre 2026, tâche 4).
-- On pouvait déjà répondre à une réponse : la réponse se range sous le même commentaire (un seul niveau d'affichage),
-- en citant son auteur (« @Awa S. »). Mais seul l'auteur du commentaire était prévenu, pas la personne à qui l'on
-- répondait. Désormais, une fois chacun : celle à qui l'on répond (« Nouvelle réponse à votre commentaire »), l'auteur
-- du commentaire si l'on répond dans sa discussion (« Nouvelle réponse dans votre discussion »), puis l'auteur de la
-- publication, ou le formateur pour une leçon. Mêmes définitions qu'en 0025 (commenter) et 0028 (commenter_lecon),
-- plus ces envois. Rejouable.

begin;

create or replace function public.commenter(p_publication uuid, p_texte text, p_parent uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.publications%rowtype := public.publication_ouverte(p_publication);
  v_texte text := regexp_replace(coalesce(p_texte, ''), '^\s+|\s+$', '', 'g');
  v_id uuid;
  v_nom text;
  v_parent public.commentaires_publications%rowtype;
  v_cible public.commentaires_publications%rowtype;
  v_espace text;
begin
  if char_length(v_texte) not between 1 and 1000 then
    raise exception 'Écrivez votre réponse (1 000 caractères au plus).';
  end if;
  if p_parent is not null then
    select * into v_parent from public.commentaires_publications where id = p_parent and publication_id = p_publication;
    if not found then
      raise exception 'Ce commentaire n’existe plus.';
    end if;
    -- Celui à qui l'on répond (un commentaire ou une réponse), gardé pour le prévenir.
    v_cible := v_parent;
    -- Un seul niveau : répondre à une réponse répond au même commentaire.
    if v_parent.parent_id is not null then
      select * into v_parent from public.commentaires_publications where id = v_parent.parent_id;
    end if;
  end if;
  perform public.limiter_debit(true);
  insert into public.commentaires_publications (publication_id, auteur, texte, parent_id)
  values (p_publication, (select auth.uid()), v_texte, v_parent.id)
  returning id into v_id;
  select public.nom_avis(prenom, nom) into v_nom from public.profils where id = (select auth.uid());
  v_espace := public.nom_espace_communaute(v.parcours_id);
  -- Prévenus, une fois chacun : celui à qui l'on répond ; l'auteur du commentaire, si l'on répond à une réponse de sa
  -- discussion ; l'auteur de la publication. L'auteur de la réponse ne l'est jamais (notifier l'écarte).
  if v_cible.id is not null then
    perform public.notifier(
      array[v_cible.auteur], 'communaute', 'Nouvelle réponse à votre commentaire',
      v_nom || ' a répondu à votre commentaire dans l’espace ' || v_espace || '.',
      '/communaute/publications/' || v.id || '#commentaire-' || v_id
    );
  end if;
  if v_cible.id is distinct from v_parent.id and v_parent.auteur is distinct from v_cible.auteur then
    perform public.notifier(
      array[v_parent.auteur], 'communaute', 'Nouvelle réponse dans votre discussion',
      v_nom || ' a répondu dans la discussion de votre commentaire, dans l’espace ' || v_espace || '.',
      '/communaute/publications/' || v.id || '#commentaire-' || v_id
    );
  end if;
  perform public.notifier(
    array(select v.auteur where v.auteur is distinct from v_parent.auteur and v.auteur is distinct from v_cible.auteur), 'communaute', 'Nouvelle réponse',
    v_nom || ' a répondu à votre publication dans l’espace ' || v_espace || '.',
    '/communaute/publications/' || v.id || '#commentaire-' || v_id
  );
  return v_id;
end;
$$;

create or replace function public.commenter_lecon(p_lecon uuid, p_texte text, p_parent uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.lecons%rowtype;
  v_moi uuid := (select auth.uid());
  v_texte text := regexp_replace(coalesce(p_texte, ''), '^\s+|\s+$', '', 'g');
  v_parent public.commentaires_lecons%rowtype;
  v_cible public.commentaires_lecons%rowtype;
  v_nouveau public.commentaires_lecons%rowtype;
  v_formation record;
  v_nom text;
  v_lien text;
begin
  perform public.exiger_compte_actif();
  v := public.lecon_discutable(p_lecon);
  if char_length(v_texte) not between 1 and 1000 then
    raise exception 'Écrivez votre commentaire (1 000 caractères au plus).';
  end if;
  if p_parent is not null then
    select * into v_parent from public.commentaires_lecons where id = p_parent and lecon_id = p_lecon;
    if not found then
      raise exception 'Ce commentaire n’existe plus.';
    end if;
    -- Celui à qui l'on répond (un commentaire ou une réponse), gardé pour le prévenir.
    v_cible := v_parent;
    -- Un seul niveau : répondre à une réponse répond au même commentaire.
    if v_parent.parent_id is not null then
      select * into v_parent from public.commentaires_lecons where id = v_parent.parent_id;
    end if;
  end if;
  if (select count(*) from public.commentaires_lecons where auteur = v_moi and cree_le > now() - interval '10 minutes') >= 30 then
    raise exception 'Vous publiez beaucoup en peu de temps. Réessayez dans quelques minutes.';
  end if;
  insert into public.commentaires_lecons (lecon_id, auteur, texte, parent_id)
  values (p_lecon, v_moi, v_texte, v_parent.id)
  returning * into v_nouveau;

  select f.slug, fo.compte_id into v_formation
  from public.modules m
  join public.formations f on f.id = m.formation_id
  left join public.formateurs fo on fo.id = f.formateur_id
  where m.id = v.module_id;
  v_lien := '/formations/' || v_formation.slug || '/lecons/' || v.id || '#commentaire-' || v_nouveau.id;
  select public.nom_avis(prenom, nom) into v_nom from public.profils where id = v_moi;
  -- Prévenus, une fois chacun : celui à qui l'on répond ; l'auteur du commentaire, si l'on répond à une réponse de sa
  -- discussion ; puis le formateur.
  if v_cible.id is not null and v_cible.auteur <> v_moi then
    perform public.notifier(
      array[v_cible.auteur], 'communaute', 'Nouvelle réponse à votre commentaire',
      v_nom || ' a répondu à votre commentaire sur « ' || v.titre || ' ».', v_lien
    );
  end if;
  if v_cible.id is distinct from v_parent.id and v_parent.auteur <> v_moi and v_parent.auteur is distinct from v_cible.auteur then
    perform public.notifier(
      array[v_parent.auteur], 'communaute', 'Nouvelle réponse dans votre discussion',
      v_nom || ' a répondu dans la discussion de votre commentaire sur « ' || v.titre || ' ».', v_lien
    );
  end if;
  if v_formation.compte_id is not null and v_formation.compte_id <> v_moi and v_formation.compte_id is distinct from v_parent.auteur
    and v_formation.compte_id is distinct from v_cible.auteur then
    perform public.notifier(
      array[v_formation.compte_id], 'communaute', 'Nouveau commentaire sur votre leçon',
      v_nom || ' a commenté « ' || v.titre || ' ».', v_lien
    );
  end if;
  return public.carte_commentaire_lecon(v_nouveau);
end;
$$;

commit;
