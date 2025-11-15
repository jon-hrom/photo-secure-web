CREATE TABLE vk_users (
    user_id SERIAL PRIMARY KEY,
    vk_sub VARCHAR(100),
    email VARCHAR(255),
    phone_number VARCHAR(50),
    full_name VARCHAR(255),
    avatar_url TEXT,
    is_verified BOOLEAN DEFAULT FALSE,
    raw_profile TEXT,
    registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
