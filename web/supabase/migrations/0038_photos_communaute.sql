-- Migration 0038 : les photos de profil dans la communauté (liste du 31 octobre 2026, tâche 5).
-- Jusqu'ici, la base ne renvoyait que les prénoms et initiales : seule sa propre photo s'affichait (l'appli la connaît).
-- Elle renvoie maintenant le chemin de la photo (espace public « photos-profil ») de l'auteur d'une publication, des
-- derniers qui l'aiment (« aimee_par » devient une liste d'objets : initiales et photo) et de l'auteur d'un commentaire,
-- dans la communauté comme dans les discussions d'une leçon. Mêmes définitions qu'en 0026 (carte_publication), 0025
-- (carte_reponse) et 0028 (carte_commentaire_lecon), plus la photo. Rejouable.

begin;

create or replace function public.carte_publication(p public.publications)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p.id,
    'auteur', jsonb_build_object('prenom', coalesce(pr.prenom, ''), 'nom', coalesce(pr.nom, ''), 'role', public.role_communaute(p.auteur), 'photo', pr.photo_url),
    'est_moi', p.auteur = (select auth.uid()),
    'espace', jsonb_build_object('id', p.parcours_id, 'nom', public.nom_espace_communaute(p.parcours_id)),
    'titre', p.titre,
    'texte', p.texte,
    'piece_jointe', p.piece_jointe,
    'cree_le', p.cree_le,
    'modifiee', p.modifiee,
    'statut', p.statut,
    'apercu', p.apercu,
    'video', p.video,
    -- Programmée : vue par son auteur (onglet « Programmées ») et l'équipe seulement.
    'programmee', p.cree_le > now(),
    'sondage', public.bloc_sondage(p.id),
    -- Le bloc d'une session programmée (jamais son lien, réservé à sa fenêtre de 10 min).
    'session', (
      select jsonb_build_object(
        'id', s.id, 'debut', s.debut, 'duree_minutes', s.duree_minutes, 'plateforme', public.plateforme_session(s.lien),
        'animateur', public.animateur_session(s.formateur_id), 'statut', s.statut,
        'inscriptions', (select count(*)::int from public.inscriptions_sessions i where i.session_id = s.id),
        'inscrit', exists (select 1 from public.inscriptions_sessions i where i.session_id = s.id and i.profil_id = (select auth.uid()))
      )
      from public.sessions_live s where s.id = p.session_id
    ),
    'enregistree', exists (
      select 1 from public.publications_enregistrees e where e.publication_id = p.id and e.profil_id = (select auth.uid())
    ),
    'aimee_par', coalesce((
      select jsonb_agg(jsonb_build_object('initiales', public.initiales_avis(pr2.prenom, pr2.nom), 'photo', pr2.photo_url) order by d.cree_le desc, d.profil_id)
      from (
        select r.profil_id, r.cree_le from public.reactions_publications r
        where r.publication_id = p.id
        order by r.cree_le desc, r.profil_id
        limit 3
      ) d
      join public.profils pr2 on pr2.id = d.profil_id
    ), '[]'::jsonb),
    'reactions', (select count(*)::int from public.reactions_publications r where r.publication_id = p.id),
    'j_aime', exists (select 1 from public.reactions_publications r where r.publication_id = p.id and r.profil_id = (select auth.uid())),
    'reponses', (select count(*)::int from public.commentaires_publications c where c.publication_id = p.id),
    'dernieres_reponses', coalesce((
      select jsonb_agg(public.carte_reponse(d) order by d.cree_le, d.id)
      from (
        select c.* from public.commentaires_publications c
        where c.publication_id = p.id and c.parent_id is null
        order by c.cree_le desc, c.id desc
        limit 2
      ) d
    ), '[]'::jsonb),
    'peut_supprimer', p.auteur = (select auth.uid()) or public.equipe_contenus(),
    'peut_signaler', p.statut = 'publiee' and p.auteur <> (select auth.uid()) and not public.equipe_contenus()
  )
  from public.profils pr
  where pr.id = p.auteur;
$$;

create or replace function public.carte_reponse(c public.commentaires_publications)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', c.id,
    'auteur', jsonb_build_object('prenom', coalesce(pr.prenom, ''), 'nom_court', public.nom_avis(pr.prenom, pr.nom), 'photo', pr.photo_url),
    'est_moi', c.auteur = (select auth.uid()),
    'texte', c.texte,
    'cree_le', c.cree_le,
    'parent_id', c.parent_id,
    'modifie', c.modifie_le is not null,
    'reactions', (select count(*)::int from public.reactions_commentaires r where r.commentaire_id = c.id),
    'j_aime', exists (select 1 from public.reactions_commentaires r where r.commentaire_id = c.id and r.profil_id = (select auth.uid())),
    'peut_modifier', c.auteur = (select auth.uid()) or public.equipe_contenus(),
    'peut_supprimer', c.auteur = (select auth.uid()) or public.equipe_contenus(),
    'peut_signaler', c.auteur <> (select auth.uid()) and not public.equipe_contenus()
  )
  from public.profils pr
  where pr.id = c.auteur;
$$;

create or replace function public.carte_commentaire_lecon(c public.commentaires_lecons)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', c.id,
    'auteur', jsonb_build_object('prenom', coalesce(pr.prenom, ''), 'nom_court', public.nom_avis(pr.prenom, pr.nom), 'photo', pr.photo_url),
    'est_moi', c.auteur = (select auth.uid()),
    'texte', c.texte,
    'cree_le', c.cree_le,
    'parent_id', c.parent_id,
    'modifie', c.modifie_le is not null,
    'reactions', (select count(*)::int from public.reactions_commentaires_lecons r where r.commentaire_id = c.id),
    'j_aime', exists (select 1 from public.reactions_commentaires_lecons r where r.commentaire_id = c.id and r.profil_id = (select auth.uid())),
    'peut_modifier', c.auteur = (select auth.uid()),
    'peut_supprimer', c.auteur = (select auth.uid()) or public.equipe_contenus() or public.formateur_de(public.formation_de_la_lecon(c.lecon_id)),
    'peut_signaler', c.auteur <> (select auth.uid()) and not public.equipe_contenus(),
    -- L'étiquette « Formateur » : l'auteur est le formateur de la formation.
    'formateur', exists (
      select 1 from public.formations f join public.formateurs fo on fo.id = f.formateur_id
      where f.id = public.formation_de_la_lecon(c.lecon_id) and fo.compte_id = c.auteur
    )
  )
  from public.profils pr
  where pr.id = c.auteur;
$$;

commit;
