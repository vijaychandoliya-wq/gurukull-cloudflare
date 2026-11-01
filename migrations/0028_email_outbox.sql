-- Durable credential email delivery. Passwords remain encrypted in payload_json and
-- are never returned by status queries or written to logs.
ALTER TABLE outbox ADD COLUMN completed_at INTEGER;
ALTER TABLE outbox ADD COLUMN provider_message_id TEXT;
CREATE INDEX IF NOT EXISTS idx_outbox_email_due ON outbox(event_type,status,scheduled_at);
