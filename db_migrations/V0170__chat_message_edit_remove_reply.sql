ALTER TABLE client_messages
    ADD COLUMN IF NOT EXISTS is_edited BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS edited_at TIMESTAMP NULL,
    ADD COLUMN IF NOT EXISTS reply_to_id BIGINT NULL,
    ADD COLUMN IF NOT EXISTS removed_for_all BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS hidden_for_client BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS hidden_for_photographer BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS removed_at TIMESTAMP NULL;

CREATE INDEX IF NOT EXISTS idx_client_messages_reply_to ON client_messages(reply_to_id);
CREATE INDEX IF NOT EXISTS idx_client_messages_removed_all ON client_messages(removed_for_all);
