ALTER TABLE notification_outbox ADD COLUMN read_at timestamptz;
CREATE POLICY personal_inbox_select ON notification_outbox FOR SELECT TO community_app USING(user_id=current_app_user());
CREATE POLICY personal_inbox_update ON notification_outbox FOR UPDATE TO community_app USING(user_id=current_app_user()) WITH CHECK(user_id=current_app_user());
