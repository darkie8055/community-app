CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
DO $$ BEGIN CREATE ROLE community_app NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE community_worker NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL,
  phone text UNIQUE, email text UNIQUE, password_hash text,
  is_platform_admin boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE communities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL,
  address text NOT NULL, city text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), community_id uuid NOT NULL REFERENCES communities(id),
  name text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(community_id,id), UNIQUE(community_id,name)
);
CREATE TABLE floors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), community_id uuid NOT NULL REFERENCES communities(id),
  block_id uuid NOT NULL, number integer NOT NULL CHECK(number BETWEEN -5 AND 200),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(community_id,block_id) REFERENCES blocks(community_id,id),
  UNIQUE(community_id,id), UNIQUE(community_id,block_id,number)
);
CREATE TABLE units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), community_id uuid NOT NULL REFERENCES communities(id),
  floor_id uuid NOT NULL, label text NOT NULL, kind text NOT NULL DEFAULT 'flat' CHECK(kind IN ('flat','villa')),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(community_id,floor_id) REFERENCES floors(community_id,id),
  UNIQUE(community_id,id), UNIQUE(community_id,label)
);
CREATE TABLE memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), community_id uuid NOT NULL REFERENCES communities(id),
  user_id uuid NOT NULL REFERENCES users(id), unit_id uuid,
  role text NOT NULL CHECK(role IN ('admin','guard','owner','tenant','family')),
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(), decided_at timestamptz, decided_by uuid REFERENCES users(id),
  FOREIGN KEY(community_id,unit_id) REFERENCES units(community_id,id),
  CHECK(role IN ('admin','guard') OR unit_id IS NOT NULL),
  UNIQUE NULLS NOT DISTINCT(community_id,user_id,unit_id)
);
CREATE TABLE visitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), community_id uuid NOT NULL REFERENCES communities(id),
  name text NOT NULL, phone text NOT NULL, photo_key text,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(community_id,id)
);
CREATE TABLE visitor_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), community_id uuid NOT NULL REFERENCES communities(id),
  visitor_id uuid NOT NULL, unit_id uuid NOT NULL,
  guard_id uuid REFERENCES users(id), created_by uuid NOT NULL REFERENCES users(id),
  type text NOT NULL CHECK(type IN ('guest','delivery','cab','service')),
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','denied','inside','exited')),
  company text NOT NULL DEFAULT '', purpose text NOT NULL DEFAULT '', vehicle text NOT NULL DEFAULT '',
  people integer NOT NULL DEFAULT 1 CHECK(people BETWEEN 1 AND 20),
  idempotency_key uuid NOT NULL, decided_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(), approved_at timestamptz, denied_at timestamptz,
  entered_at timestamptz, exited_at timestamptz,
  FOREIGN KEY(community_id,visitor_id) REFERENCES visitors(community_id,id),
  FOREIGN KEY(community_id,unit_id) REFERENCES units(community_id,id),
  UNIQUE(community_id,id), UNIQUE(community_id,created_by,idempotency_key),
  CHECK(exited_at IS NULL OR entered_at IS NOT NULL),
  CHECK(entered_at IS NULL OR approved_at IS NOT NULL),
  CHECK(exited_at IS NULL OR exited_at >= entered_at)
);
CREATE TABLE devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id),
  token text NOT NULL UNIQUE, platform text NOT NULL CHECK(platform IN ('android','ios','web')),
  created_at timestamptz NOT NULL DEFAULT now(), last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), community_id uuid NOT NULL REFERENCES communities(id),
  actor_id uuid NOT NULL REFERENCES users(id), action text NOT NULL, entity_id uuid,
  details jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE notification_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), community_id uuid NOT NULL REFERENCES communities(id),
  user_id uuid NOT NULL REFERENCES users(id), entry_id uuid NOT NULL,
  title text NOT NULL, body text NOT NULL, status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(), queued_at timestamptz, sent_at timestamptz,
  FOREIGN KEY(community_id,entry_id) REFERENCES visitor_entries(community_id,id)
);

CREATE FUNCTION current_community() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.community_id', true),'')::uuid
$$;
CREATE FUNCTION current_app_user() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.user_id', true),'')::uuid
$$;

ALTER TABLE communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE communities FORCE ROW LEVEL SECURITY;
CREATE POLICY community_scope ON communities TO community_app USING(id=current_community());
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['blocks','floors','units','memberships','visitors','visitor_entries','audit_logs','notification_outbox'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
    EXECUTE format('CREATE POLICY tenant_scope ON %I TO community_app USING (community_id=current_community()) WITH CHECK (community_id=current_community())',t);
  END LOOP;
END $$;
CREATE POLICY own_memberships ON memberships FOR SELECT TO community_app USING(current_community() IS NULL AND user_id=current_app_user());
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices FORCE ROW LEVEL SECURITY;
CREATE POLICY own_devices ON devices TO community_app USING(user_id=current_app_user()) WITH CHECK(user_id=current_app_user());
CREATE POLICY worker_outbox ON notification_outbox TO community_worker USING(true) WITH CHECK(true);
CREATE POLICY worker_devices ON devices TO community_worker USING(true);

GRANT USAGE ON SCHEMA public TO community_app,community_worker;
GRANT SELECT,INSERT,UPDATE ON users,blocks,floors,units,memberships,visitors,visitor_entries,devices,notification_outbox TO community_app;
GRANT SELECT ON communities TO community_app;
GRANT SELECT,INSERT ON audit_logs TO community_app;
GRANT DELETE ON devices TO community_app;
GRANT SELECT,UPDATE ON notification_outbox TO community_worker;
GRANT SELECT,DELETE ON devices TO community_worker;

CREATE FUNCTION immutable_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Audit logs are append-only'; END $$;
CREATE TRIGGER audit_immutable BEFORE UPDATE OR DELETE ON audit_logs FOR EACH ROW EXECUTE FUNCTION immutable_audit();
CREATE INDEX entries_community_created ON visitor_entries(community_id,created_at DESC,id);
CREATE INDEX entries_unit_status ON visitor_entries(community_id,unit_id,status);
CREATE INDEX memberships_user_status ON memberships(user_id,status);
CREATE INDEX audit_community_created ON audit_logs(community_id,created_at DESC);
CREATE INDEX outbox_pending ON notification_outbox(status,created_at);
