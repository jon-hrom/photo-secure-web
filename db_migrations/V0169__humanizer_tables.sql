-- Humanizer tool: история обработанных документов

CREATE TABLE IF NOT EXISTS t_p28211681_photo_secure_web.humanizer_documents (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    title VARCHAR(500),
    source_filename VARCHAR(500),
    source_type VARCHAR(50),
    original_text TEXT NOT NULL,
    humanized_text TEXT,
    ai_score_before NUMERIC(5,2),
    ai_score_after NUMERIC(5,2),
    char_count INT DEFAULT 0,
    word_count INT DEFAULT 0,
    style VARCHAR(50) DEFAULT 'neutral',
    aggression VARCHAR(20) DEFAULT 'medium',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_humanizer_user_created 
    ON t_p28211681_photo_secure_web.humanizer_documents (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS t_p28211681_photo_secure_web.humanizer_sentences (
    id BIGSERIAL PRIMARY KEY,
    document_id BIGINT NOT NULL,
    sentence_index INT NOT NULL,
    original_text TEXT NOT NULL,
    rewritten_text TEXT,
    ai_score NUMERIC(5,2),
    chosen_variant_index INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_humanizer_sentences_doc 
    ON t_p28211681_photo_secure_web.humanizer_sentences (document_id, sentence_index);