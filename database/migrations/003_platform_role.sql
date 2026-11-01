DO $$ BEGIN CREATE ROLE community_platform NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
GRANT USAGE ON SCHEMA public TO community_platform;
GRANT SELECT,INSERT ON communities,memberships,audit_logs TO community_platform;
CREATE POLICY platform_communities ON communities TO community_platform USING(true) WITH CHECK(true);
CREATE POLICY platform_memberships ON memberships TO community_platform USING(true) WITH CHECK(true);
CREATE POLICY platform_audit ON audit_logs TO community_platform USING(true) WITH CHECK(true);
