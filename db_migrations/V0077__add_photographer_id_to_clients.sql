ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS photographer_id INTEGER;

ALTER TABLE clients
ADD CONSTRAINT fk_photographer FOREIGN KEY (photographer_id) REFERENCES users(id);

CREATE INDEX IF NOT EXISTS idx_clients_photographer_id ON clients(photographer_id);
CREATE INDEX IF NOT EXISTS idx_clients_photographer_email ON clients(photographer_id, email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clients_photographer_phone ON clients(photographer_id, phone) WHERE phone IS NOT NULL;

COMMENT ON COLUMN clients.photographer_id IS 'ID фотографа-владельца клиента для изоляции данных';

UPDATE clients 
SET photographer_id = CAST(user_id AS INTEGER)
WHERE photographer_id IS NULL AND user_id IS NOT NULL AND user_id ~ '^\d+$';
