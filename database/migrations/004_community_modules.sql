CREATE TABLE community_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), community_id uuid NOT NULL REFERENCES communities(id),
  author_id uuid NOT NULL REFERENCES users(id), unit_id uuid,
  kind text NOT NULL CHECK(kind IN ('post','notice','listing','property','service')),
  title text NOT NULL, description text NOT NULL DEFAULT '', category text NOT NULL DEFAULT '',
  price integer NOT NULL DEFAULT 0 CHECK(price>=0), image_asset text NOT NULL DEFAULT 'community', photo_key text,
  listing_type text CHECK(listing_type IN ('sell','rent')), bedrooms integer CHECK(bedrooms BETWEEN 0 AND 20),
  available_on date, status text NOT NULL DEFAULT 'published' CHECK(status IN ('draft','published','closed')),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(community_id,id), FOREIGN KEY(community_id,unit_id) REFERENCES units(community_id,id),
  CHECK(kind<>'property' OR (unit_id IS NOT NULL AND listing_type IS NOT NULL))
);
CREATE TABLE item_bookmarks (
  community_id uuid NOT NULL, item_id uuid NOT NULL, user_id uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(item_id,user_id),
  FOREIGN KEY(community_id,item_id) REFERENCES community_items(community_id,id)
);
CREATE TABLE item_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), community_id uuid NOT NULL, item_id uuid NOT NULL,
  author_id uuid NOT NULL REFERENCES users(id), body text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(community_id,item_id) REFERENCES community_items(community_id,id)
);
CREATE TABLE item_inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), community_id uuid NOT NULL, item_id uuid NOT NULL,
  sender_id uuid NOT NULL REFERENCES users(id), recipient_id uuid NOT NULL REFERENCES users(id),
  message text NOT NULL, reply text, created_at timestamptz NOT NULL DEFAULT now(), replied_at timestamptz,
  FOREIGN KEY(community_id,item_id) REFERENCES community_items(community_id,id)
);
CREATE TABLE service_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), community_id uuid NOT NULL, item_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id), unit_id uuid NOT NULL,
  scheduled_on date NOT NULL, note text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'requested' CHECK(status IN ('requested','accepted','completed','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(community_id,item_id) REFERENCES community_items(community_id,id),
  FOREIGN KEY(community_id,unit_id) REFERENCES units(community_id,id)
);
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['community_items','item_bookmarks','item_comments','item_inquiries','service_requests'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
    EXECUTE format('CREATE POLICY tenant_scope ON %I TO community_app USING (community_id=current_community()) WITH CHECK (community_id=current_community())',t);
    EXECUTE format('GRANT SELECT,INSERT,UPDATE ON %I TO community_app',t);
  END LOOP;
END $$;
GRANT DELETE ON item_bookmarks TO community_app;
CREATE INDEX items_community_kind ON community_items(community_id,kind,created_at DESC,id);
CREATE INDEX inquiries_participants ON item_inquiries(community_id,sender_id,recipient_id);
CREATE INDEX service_requests_user ON service_requests(community_id,user_id,status);
CREATE INDEX comments_item ON item_comments(community_id,item_id,created_at);
