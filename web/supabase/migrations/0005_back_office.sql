-- Étudium · migration 0005 : outils du back-office (tâche 1.2) — ordre des éléments, formats des fichiers de ressources.
-- À appliquer dans Supabase, après la 0004 : SQL Editor → New query → coller tout le fichier → Run.
-- Rejouable : relancé sur une base qui l'a déjà, il ne change rien et ne casse rien.

-- ─── Monter / descendre un élément dans sa liste ────────────────────────────
-- Parcours (entre eux), modules (dans leur formation), leçons (dans leur module), ressources (dans leur leçon).
-- La liste est d'abord renumérotée 1, 2, 3… (des ordres en double ou des trous ne gênent plus), puis l'élément échange
-- sa place avec son voisin. Au bord de la liste, rien ne change.
-- Les règles d'accès s'appliquent (security invoker) : hors de l'équipe, rien ne bouge.
create or replace function public.deplacer(p_table text, p_id uuid, p_sens integer)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_groupe text;
  v_valeur uuid;
  v_filtre text;
  v_ordre integer;
  v_voisin uuid;
begin
  if p_sens is null or p_sens not in (-1, 1) then
    raise exception 'Sens de déplacement inconnu : %', p_sens;
  end if;
  if p_table is null or p_table not in ('parcours', 'modules', 'lecons', 'ressources') then
    raise exception 'Table non prévue pour un déplacement : %', p_table;
  end if;

  v_groupe := case p_table
    when 'modules' then 'formation_id'
    when 'lecons' then 'module_id'
    when 'ressources' then 'lecon_id'
  end;

  if v_groupe is null then
    v_filtre := 'true';
  else
    execute format('select %I from public.%I where id = $1', v_groupe, p_table) into v_valeur using p_id;
    if v_valeur is null then
      return;
    end if;
    v_filtre := format('%I = %L', v_groupe, v_valeur);
  end if;

  execute format(
    'update public.%I as t set ordre = n.rang
       from (select id, row_number() over (order by ordre, cree_le, id) as rang from public.%I where %s) as n
      where t.id = n.id and t.ordre is distinct from n.rang',
    p_table, p_table, v_filtre
  );

  execute format('select ordre from public.%I where id = $1', p_table) into v_ordre using p_id;
  if v_ordre is null then
    return;
  end if;
  execute format('select id from public.%I where %s and ordre = $1', p_table, v_filtre) into v_voisin using v_ordre + p_sens;
  if v_voisin is null then
    return;
  end if;

  execute format('update public.%I set ordre = $2 where id = $1', p_table) using p_id, v_ordre + p_sens;
  execute format('update public.%I set ordre = $2 where id = $1', p_table) using v_voisin, v_ordre;
end;
$$;

revoke execute on function public.deplacer(text, uuid, integer) from public, anon;
grant execute on function public.deplacer(text, uuid, integer) to authenticated;

-- ─── Fichiers acceptés par l'espace « ressources » ─────────────────────────
-- La même liste que l'application (web/src/lib/admin/fichiers.ts) : PDF et images (consultables), puis Excel, Word,
-- PowerPoint, ZIP, CSV et texte (en téléchargement seulement).
update storage.buckets
set allowed_mime_types = array[
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-powerpoint',
  'application/zip',
  'text/csv',
  'text/plain'
]
where id = 'ressources';
