CREATE TABLE visitor_passes (
  community_id uuid NOT NULL REFERENCES communities(id),
  entry_id uuid PRIMARY KEY,
  nonce uuid NOT NULL,
  code_hash text NOT NULL UNIQUE CHECK(length(code_hash)=64),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(community_id,entry_id) REFERENCES visitor_entries(community_id,id)
);
ALTER TABLE visitor_passes ENABLE ROW LEVEL SECURITY;
ALTER TABLE visitor_passes FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON visitor_passes TO community_app
  USING (community_id=current_community()) WITH CHECK (community_id=current_community());
GRANT SELECT,INSERT,UPDATE ON visitor_passes TO community_app;
CREATE INDEX visitor_passes_community ON visitor_passes(community_id,expires_at);
