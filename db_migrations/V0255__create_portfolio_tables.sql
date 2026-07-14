CREATE TABLE IF NOT EXISTS t_p28211681_photo_secure_web.portfolios (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    slug VARCHAR(120) NOT NULL UNIQUE,
    title VARCHAR(200) NOT NULL DEFAULT '',
    subtitle VARCHAR(300) DEFAULT '',
    about TEXT DEFAULT '',
    phone VARCHAR(50) DEFAULT '',
    email VARCHAR(200) DEFAULT '',
    instagram VARCHAR(200) DEFAULT '',
    telegram VARCHAR(200) DEFAULT '',
    vk VARCHAR(200) DEFAULT '',
    whatsapp VARCHAR(200) DEFAULT '',
    avatar_url TEXT DEFAULT '',
    cover_url TEXT DEFAULT '',
    accent_color VARCHAR(20) DEFAULT '#7c3aed',
    show_reviews BOOLEAN DEFAULT TRUE,
    show_about BOOLEAN DEFAULT TRUE,
    slideshow_enabled BOOLEAN DEFAULT TRUE,
    is_published BOOLEAN DEFAULT FALSE,
    views_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_portfolios_user ON t_p28211681_photo_secure_web.portfolios(user_id);
CREATE INDEX IF NOT EXISTS idx_portfolios_slug ON t_p28211681_photo_secure_web.portfolios(slug);

CREATE TABLE IF NOT EXISTS t_p28211681_photo_secure_web.portfolio_categories (
    id SERIAL PRIMARY KEY,
    portfolio_id INTEGER NOT NULL,
    title VARCHAR(120) NOT NULL,
    slug VARCHAR(120) NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_portfolio_categories_portfolio ON t_p28211681_photo_secure_web.portfolio_categories(portfolio_id);

CREATE TABLE IF NOT EXISTS t_p28211681_photo_secure_web.portfolio_photos (
    id SERIAL PRIMARY KEY,
    portfolio_id INTEGER NOT NULL,
    category_id INTEGER,
    photo_url TEXT NOT NULL,
    thumbnail_url TEXT DEFAULT '',
    grid_thumbnail_url TEXT DEFAULT '',
    source VARCHAR(20) DEFAULT 'device',
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_portfolio_photos_portfolio ON t_p28211681_photo_secure_web.portfolio_photos(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_photos_category ON t_p28211681_photo_secure_web.portfolio_photos(category_id);

CREATE TABLE IF NOT EXISTS t_p28211681_photo_secure_web.portfolio_reviews (
    id SERIAL PRIMARY KEY,
    portfolio_id INTEGER NOT NULL,
    author_name VARCHAR(120) NOT NULL,
    text TEXT NOT NULL,
    rating INTEGER DEFAULT 5,
    avatar_url TEXT DEFAULT '',
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_portfolio_reviews_portfolio ON t_p28211681_photo_secure_web.portfolio_reviews(portfolio_id);