-- Le temps réel de Supabase, simulé pour le banc d'essai (migration 0044) : la table des messages diffusés, la fonction
-- qui diffuse (même signature que realtime.send chez Supabase) et le sujet d'un abonnement (realtime.topic), que
-- Supabase pose avant de vérifier qu'un compte a le droit de s'abonner.
create schema realtime;
grant usage on schema realtime to anon, authenticated;

create table realtime.messages (
  id bigserial primary key,
  topic text not null,
  extension text not null default 'broadcast',
  event text,
  payload jsonb,
  private boolean default true,
  inserted_at timestamptz not null default now()
);
alter table realtime.messages enable row level security;
grant select on realtime.messages to anon, authenticated;

create function realtime.topic() returns text
language sql
stable
as $$ select nullif(current_setting('realtime.topic', true), '') $$;
grant execute on function realtime.topic() to anon, authenticated;

create function realtime.send(payload jsonb, event text, topic text, private boolean default true) returns void
language plpgsql
security definer
as $$
begin
  insert into realtime.messages (topic, event, payload, private) values (topic, event, payload, private);
end;
$$;
