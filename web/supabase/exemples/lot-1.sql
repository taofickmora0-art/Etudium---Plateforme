-- Ne plus appliquer (2026-11-02) : les formations d'exemple ont été retirées à la demande de l'utilisateur ; voir
-- retirer-lot-1.sql.
--
-- Étudium · données d'exemple du lot 1 (textes du design « Nouveau design »).
-- SEULEMENT sur la base de test etudium-dev : ne jamais appliquer en production.
-- À appliquer après la migration 0004 : SQL Editor → New query → coller tout le fichier → Run.
-- Rejouable : relancé, il ne double rien. Parcours et formations reprennent leurs textes d'origine ; la formatrice
-- et le programme d'Excel, s'ils existent déjà (même modifiés au back-office), ne sont pas réécrits.
-- Vidéos et ressources : à ajouter depuis le back-office (tâche 1.2).

-- ─── Les trois parcours du lancement ───────────────────────────────────────
insert into public.parcours (slug, nom, nom_court, description, couleur, ordre) values
  ('reussite-academique', 'Réussite académique', 'Académique',
   'Les outils et méthodes pour réussir à l’université : bureautique, recherche, rédaction scientifique et soutenance.', 'academique', 1),
  ('competences-digitales', 'Compétences digitales', 'Digital',
   'Design, intelligence artificielle, contenu et automatisation : les compétences numériques recherchées.', 'digital', 2),
  ('business-revenus-en-ligne', 'Business & revenus en ligne', 'Business',
   'Freelance, produits digitaux et vente en ligne : créer une activité grâce au numérique.', 'business', 3)
on conflict (slug) do update
  set nom = excluded.nom,
      nom_court = excluded.nom_court,
      description = excluded.description,
      couleur = excluded.couleur,
      ordre = excluded.ordre,
      actif = true;

-- ─── La formatrice d'Excel ──────────────────────────────────────────────────
insert into public.formateurs (nom, titre, domaine, presentation)
select 'Dr Mireille Adjovi', 'Enseignante en statistiques appliquées', 'Statistiques appliquées · Analyse de données',
       'Elle accompagne depuis plusieurs années des étudiants de master dans l’analyse des données de leur mémoire.'
where not exists (select 1 from public.formateurs where nom = 'Dr Mireille Adjovi');

-- ─── Les dix formations du catalogue ───────────────────────────────────────
-- Dates de publication échelonnées (tri « Les plus récentes ») : l'IA, badge « Nouveau », est la dernière parue.
insert into public.formations (slug, titre, resume, niveau, gratuite, badge, statut, publiee_le) values
  ('maitriser-microsoft-excel', 'Maîtriser Microsoft Excel',
   'Formules, tableaux croisés dynamiques et graphiques pour analyser vos données.',
   'intermediaire', false, 'populaire', 'publiee', now() - interval '60 days'),
  ('microsoft-word-travaux-universitaires', 'Microsoft Word pour vos travaux universitaires',
   'Styles, sommaire automatique et mise en page du mémoire, étape par étape.',
   'debutant', false, null, 'publiee', now() - interval '55 days'),
  ('zotero-gerer-ses-references', 'Zotero : gérer ses références',
   'Collectez vos sources et générez citations et bibliographie sans erreur.',
   'debutant', true, null, 'publiee', now() - interval '50 days'),
  ('powerpoint-reussir-sa-soutenance', 'PowerPoint : réussir sa soutenance',
   'Structurez vos diapositives et présentez avec assurance le jour de la soutenance.',
   'debutant', false, null, 'publiee', now() - interval '45 days'),
  ('methodologie-du-memoire', 'Méthodologie du mémoire',
   'De la problématique à la rédaction : la méthode pour avancer sans vous perdre.',
   'intermediaire', false, 'populaire', 'publiee', now() - interval '40 days'),
  ('canva-debutant-a-expert', 'Canva, de débutant à expert',
   'Créez affiches, présentations et visuels soignés, même sans base en design.',
   'debutant', true, null, 'publiee', now() - interval '35 days'),
  ('intelligence-artificielle-etudes', 'L’intelligence artificielle au service de vos études',
   'Utilisez l’IA pour réviser, résumer et rédiger, en gardant un regard critique.',
   'debutant', false, 'nouveau', 'publiee', now() - interval '5 days'),
  ('montage-video-smartphone', 'Montage vidéo sur smartphone',
   'Tournez, montez et exportez des vidéos propres avec votre seul téléphone.',
   'intermediaire', false, null, 'publiee', now() - interval '25 days'),
  ('marketing-digital-debutants', 'Marketing digital pour débutants',
   'Les bases pour trouver vos premiers clients en ligne : réseaux, contenu, publicité.',
   'debutant', false, null, 'publiee', now() - interval '20 days'),
  ('lancer-son-activite-freelance', 'Lancer son activité de freelance',
   'Offre, tarifs, premiers clients : les étapes pour démarrer une activité en ligne.',
   'intermediaire', false, 'populaire', 'publiee', now() - interval '15 days')
on conflict (slug) do update
  set titre = excluded.titre,
      resume = excluded.resume,
      niveau = excluded.niveau,
      gratuite = excluded.gratuite,
      badge = excluded.badge,
      statut = excluded.statut;

-- La fiche complète d'Excel (NdFormation).
update public.formations
set description = 'Des formules aux tableaux croisés dynamiques, apprenez à analyser vos données de mémoire et à présenter des résultats clairs. Chaque module se termine par un exercice corrigé.',
    objectifs = array[
      'Construire des formules fiables et lisibles',
      'Nettoyer et organiser des données d’enquête',
      'Créer des tableaux croisés dynamiques',
      'Réaliser des graphiques pour votre mémoire',
      'Automatiser les tâches répétitives',
      'Présenter des résultats clairs à un jury'
    ],
    competences = array['Formules', 'Analyse de données', 'Tableaux croisés', 'Graphiques', 'Automatisation'],
    formateur_id = (select id from public.formateurs where nom = 'Dr Mireille Adjovi' order by cree_le limit 1)
where slug = 'maitriser-microsoft-excel';

-- ─── Chaque formation dans son parcours ────────────────────────────────────
insert into public.formations_parcours (formation_id, parcours_id, ordre)
select f.id, p.id, v.ordre
from (values
  ('microsoft-word-travaux-universitaires', 'reussite-academique', 1),
  ('maitriser-microsoft-excel', 'reussite-academique', 2),
  ('powerpoint-reussir-sa-soutenance', 'reussite-academique', 3),
  ('zotero-gerer-ses-references', 'reussite-academique', 4),
  ('methodologie-du-memoire', 'reussite-academique', 5),
  ('canva-debutant-a-expert', 'competences-digitales', 1),
  ('intelligence-artificielle-etudes', 'competences-digitales', 2),
  ('montage-video-smartphone', 'competences-digitales', 3),
  ('marketing-digital-debutants', 'business-revenus-en-ligne', 1),
  ('lancer-son-activite-freelance', 'business-revenus-en-ligne', 2)
) as v (formation, parcours, ordre)
join public.formations f on f.slug = v.formation
join public.parcours p on p.slug = v.parcours
on conflict (formation_id, parcours_id) do update set ordre = excluded.ordre;

-- ─── Programme d'Excel : 4 modules, 12 leçons (quiz et exercices au lot 3) ──
-- Inséré une seule fois : s'il existe déjà (même modifié au back-office), on n'y touche pas.
do $$
declare
  v_formation uuid;
  v_module uuid;
begin
  select id into v_formation from public.formations where slug = 'maitriser-microsoft-excel';
  if exists (select 1 from public.modules where formation_id = v_formation) then
    return;
  end if;

  insert into public.modules (formation_id, titre, ordre) values (v_formation, 'Bases d’Excel', 1) returning id into v_module;
  insert into public.lecons (module_id, titre, titre_court, duree_secondes, apercu, ordre) values
    (v_module, 'Découvrir l’interface', null, 370, true, 1),
    (v_module, 'Saisir et mettre en forme des données', 'Saisir et mettre en forme', 750, true, 2),
    (v_module, 'Les formules essentielles', null, 845, false, 3),
    (v_module, 'Références relatives et absolues', 'Références relatives', 640, false, 4);

  insert into public.modules (formation_id, titre, ordre) values (v_formation, 'Formules et fonctions', 2) returning id into v_module;
  insert into public.lecons (module_id, titre, duree_secondes, ordre) values
    (v_module, 'SI, ET, OU', 800, 1),
    (v_module, 'RECHERCHEX', 900, 2),
    (v_module, 'Fonctions de texte et de date', 705, 3);

  insert into public.modules (formation_id, titre, ordre) values (v_formation, 'Analyse de données', 3) returning id into v_module;
  insert into public.lecons (module_id, titre, titre_court, duree_secondes, resume, points_cles, ordre) values
    (v_module, 'Trier et filtrer', null, 492, '', '{}', 1),
    (v_module, 'Les tableaux croisés dynamiques', 'Tableaux croisés dynamiques', 760,
     'Un tableau croisé dynamique résume en quelques clics des centaines de lignes : réponses d’un questionnaire, notes, ventes. Vous apprenez à le créer, à le modifier et à le présenter proprement dans votre mémoire.',
     array[
       'Créer un tableau croisé dynamique',
       'Modifier la structure du tableau',
       'Filtrer et trier les données',
       'Mettre en forme le tableau pour un rapport'
     ], 2),
    (v_module, 'Les graphiques avancés', null, 605, '', '{}', 3);

  insert into public.modules (formation_id, titre, ordre) values (v_formation, 'Automatisation', 4) returning id into v_module;
  insert into public.lecons (module_id, titre, duree_secondes, ordre) values
    (v_module, 'Mise en forme conditionnelle', 570, 1),
    (v_module, 'Introduction aux macros', 970, 2);
end
$$;
