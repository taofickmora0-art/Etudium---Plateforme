-- Étudium · retrait des formations d'exemple du lot 1 (spec du 2 novembre 2026, §8).
-- À quoi il sert : retirer de la base de test les dix formations d'exemple posées par lot-1.sql, avec tout ce qui en
-- dépend, puis la fiche de leur formatrice d'exemple, « Dr Mireille Adjovi ». Demandé par l'utilisateur le 2026-11-02.
-- Quand le lancer : une fois, sur la base de test etudium-dev, avec le rôle par défaut (postgres) :
-- SQL Editor → New query → coller tout le fichier → Run. Le tableau affiché à la fin dit ce que ce lancement a retiré
-- et ce qui reste. Rejouable : relancé, il ne retire plus rien. Tout se fait dans une seule transaction : en cas
-- d'erreur, rien n'est retiré.
--
-- Ce qu'il retire, pour ces dix formations (repérées par leur adresse) : modules, leçons et leur contenu, ressources,
-- quiz et tentatives, exercices et rendus, notes, commentaires, progression, inscriptions, favoris, avis, brouillons,
-- versions, liens aux parcours et de monétisation, popularité. Et ce qu'aucune clé étrangère n'efface seule : les
-- certificats (sinon gardés, sans formation), les points gagnés sur ces leçons et ces certificats, les notifications qui y
-- mènent et les e-mails pas encore envoyés qui y mènent.
-- La fiche « Dr Mireille Adjovi » n'est retirée que si aucun compte n'y est relié et qu'aucune formation ni session live
-- ne la cite plus.
--
-- Ce qu'il garde :
--   - les trois parcours (Réussite académique, Compétences digitales, Business & revenus en ligne) : ce sont les vrais ;
--   - toutes les autres formations, et ce qui les suit ;
--   - le journal des actions (l'historique), les badges et les jours d'activité des étudiants ;
--   - les fichiers déjà déposés (couvertures, vidéos, ressources) : le stockage ne se vide pas en SQL. S'il y en avait
--     pour ces formations, les retirer depuis Storage.
--
-- Une formation publiée ne s'efface pas (déclencheur formations_regles, 0004) et aucun réglage ne lève cette règle : ce
-- seul déclencheur est coupé le temps de la suppression, puis remis, dans la même transaction. Les clés étrangères, elles,
-- restent actives : ce qui dépend d'une formation part avec elle, sans orphelin.

begin;

-- ─── Les dix adresses, les formations encore là et leurs leçons ─────────────────────────────────────
create temporary table retrait_adresses on commit drop as
select slug
from (values
  ('maitriser-microsoft-excel'),
  ('microsoft-word-travaux-universitaires'),
  ('zotero-gerer-ses-references'),
  ('powerpoint-reussir-sa-soutenance'),
  ('methodologie-du-memoire'),
  ('canva-debutant-a-expert'),
  ('intelligence-artificielle-etudes'),
  ('montage-video-smartphone'),
  ('marketing-digital-debutants'),
  ('lancer-son-activite-freelance')
) as v (slug);

create temporary table retrait_formations on commit drop as
select f.id, f.slug
from public.formations f
where f.slug in (select slug from retrait_adresses);

create temporary table retrait_lecons on commit drop as
select l.id
from public.lecons l
join public.modules m on m.id = l.module_id
where m.formation_id in (select id from retrait_formations);

-- Les notifications qui mènent à ces formations ou à leurs leçons (« /formations/<adresse> », suivi ou non de « / »,
-- « ? » ou « # »).
create temporary table retrait_notifications on commit drop as
select n.id
from public.notifications n
where exists (select 1 from retrait_formations f where n.lien ~ ('^/formations/' || f.slug || '([/?#]|$)'));

-- ─── Le bilan, compté avant de supprimer (ce qui part en cascade ne se compte plus après) ───────────
create temporary table retrait_bilan (ordre integer, bilan text, nombre integer) on commit drop;

insert into retrait_bilan (ordre, bilan, nombre) values
  (1, 'Formations d’exemple retirées', (select count(*) from retrait_formations)),
  (2, 'Modules retirés', (select count(*) from public.modules where formation_id in (select id from retrait_formations))),
  (3, 'Leçons retirées', (select count(*) from retrait_lecons)),
  (4, 'Inscriptions retirées',
    (select count(*) from public.inscriptions_formations where formation_id in (select id from retrait_formations))),
  (5, 'Leçons suivies retirées', (select count(*) from public.progression_lecons where lecon_id in (select id from retrait_lecons))),
  (6, 'Favoris retirés', (select count(*) from public.favoris where formation_id in (select id from retrait_formations))),
  (7, 'Avis retirés', (select count(*) from public.avis where formation_id in (select id from retrait_formations))),
  (8, 'Certificats retirés', (select count(*) from public.certificats where formation_id in (select id from retrait_formations))),
  (9, 'Brouillons retirés',
    (select count(*) from public.brouillons_formations where formation_id in (select id from retrait_formations))
    + (select count(*) from public.brouillons_lecons where lecon_id in (select id from retrait_lecons))),
  (10, 'Versions retirées',
    (select count(*) from public.versions_formations where formation_id in (select id from retrait_formations))),
  (11, 'Notifications retirées', (select count(*) from retrait_notifications));

-- ─── Ce qu'aucune clé étrangère n'efface seule ──────────────────────────────────────────────────────
-- Les points gagnés sur ces leçons (leur référence est la leçon) et sur leurs certificats (la référence est le
-- certificat) : avant les certificats, qui servent à les retrouver.
delete from public.points_gagnes g
where (g.raison in ('lecon', 'quiz', 'exercice') and g.reference in (select id::text from retrait_lecons))
   or (g.raison = 'certificat' and g.reference in (
     select c.id::text from public.certificats c where c.formation_id in (select id from retrait_formations)
   ));

-- Les certificats : leur lien à la formation passerait à vide (on delete set null) et ils resteraient, sans formation.
delete from public.certificats where formation_id in (select id from retrait_formations);

-- Les notifications qui y mènent, et les e-mails pas encore envoyés qui y mènent (ceux déjà envoyés restent à
-- l'historique).
delete from public.notifications where id in (select id from retrait_notifications);
delete from public.envois e
where e.statut = 'a_envoyer'
  and exists (select 1 from retrait_formations f where e.lien ~ ('^/formations/' || f.slug || '([/?#]|$)'));

-- ─── Les formations, et en cascade tout ce qui en dépend ────────────────────────────────────────────
-- Modules, leçons (contenu, ressources, quiz, tentatives, exercices, rendus, notes, commentaires, progression,
-- brouillons), inscriptions, favoris, avis, brouillons, versions, liens aux parcours et de monétisation, popularité :
-- leurs clés étrangères sont en « on delete cascade ». Les autres déclencheurs de suppression (journal, formateur,
-- moyenne des avis) ne font rien quand c'est postgres qui supprime, sans compte connecté.
alter table public.formations disable trigger formations_regles;
delete from public.formations where id in (select id from retrait_formations);
alter table public.formations enable trigger formations_regles;

-- ─── La fiche de la formatrice d'exemple, si plus rien ne la tient ──────────────────────────────────
with retiree as (
  delete from public.formateurs fo
  where fo.nom = 'Dr Mireille Adjovi'
    and fo.compte_id is null
    and not exists (select 1 from public.formations f where f.formateur_id = fo.id)
    and not exists (select 1 from public.sessions_live s where s.formateur_id = fo.id)
  returning fo.id
)
insert into retrait_bilan (ordre, bilan, nombre)
select 12, 'Fiche « Dr Mireille Adjovi » retirée', count(*) from retiree;

-- ─── Ce qui reste ───────────────────────────────────────────────────────────────────────────────────
insert into retrait_bilan (ordre, bilan, nombre) values
  (13, 'Formations d’exemple restantes', (select count(*) from public.formations where slug in (select slug from retrait_adresses))),
  (14, 'Fiche « Dr Mireille Adjovi » restante', (select count(*) from public.formateurs where nom = 'Dr Mireille Adjovi')),
  (15, 'Parcours gardés', (select count(*) from public.parcours)),
  (16, 'Autres formations, non touchées',
    (select count(*) from public.formations where slug not in (select slug from retrait_adresses)));

-- Le bilan survit au commit le temps de la session (réglage non local) : il est relu juste après.
select set_config(
  'etudium.retrait_lot_1',
  (select jsonb_agg(jsonb_build_array(bilan, nombre) order by ordre) from retrait_bilan)::text,
  false
);

commit;

-- ─── Le bilan : ce que ce lancement a retiré, et ce qui reste ───────────────────────────────────────
select b.ligne ->> 0 as bilan, (b.ligne ->> 1)::integer as nombre
from jsonb_array_elements(current_setting('etudium.retrait_lot_1')::jsonb) with ordinality as b (ligne, ordre)
order by b.ordre;
