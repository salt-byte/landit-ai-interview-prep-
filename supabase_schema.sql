-- ============================================================
-- LandIt AI Interview Prep — Supabase Schema
-- 使用方法：粘贴到 Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- ─── 用户档案 ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_profiles (
    id              SERIAL PRIMARY KEY,
    user_key        VARCHAR(64)  NOT NULL UNIQUE DEFAULT 'default',
    name            VARCHAR(128) NOT NULL DEFAULT '',
    headline        VARCHAR(256) NOT NULL DEFAULT '',
    bio             TEXT         NOT NULL DEFAULT '',
    avatar_url      TEXT         NOT NULL DEFAULT '',
    target_roles    VARCHAR(256) NOT NULL DEFAULT '',
    location        VARCHAR(128) NOT NULL DEFAULT '',
    education_level VARCHAR(64)  NOT NULL DEFAULT '',
    years_of_experience VARCHAR(32) NOT NULL DEFAULT '',
    interests       TEXT         NOT NULL DEFAULT '',
    skills_technical    TEXT     NOT NULL DEFAULT '',
    skills_product      TEXT     NOT NULL DEFAULT '',
    skills_communication TEXT    NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_user_profiles_user_key ON user_profiles (user_key);

CREATE TABLE IF NOT EXISTS educations (
    id              SERIAL PRIMARY KEY,
    profile_id      INTEGER      NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    school          VARCHAR(256) NOT NULL DEFAULT '',
    degree          VARCHAR(64)  NOT NULL DEFAULT '',
    major           VARCHAR(128) NOT NULL DEFAULT '',
    year            VARCHAR(32)  NOT NULL DEFAULT '',
    key_coursework  TEXT         NOT NULL DEFAULT '',
    academic_focus  TEXT         NOT NULL DEFAULT '',
    sort_order      INTEGER      NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS experiences (
    id               SERIAL PRIMARY KEY,
    profile_id       INTEGER      NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    company          VARCHAR(256) NOT NULL DEFAULT '',
    role             VARCHAR(128) NOT NULL DEFAULT '',
    type             VARCHAR(64)  NOT NULL DEFAULT 'Full-time',
    duration         VARCHAR(64)  NOT NULL DEFAULT '',
    responsibilities TEXT         NOT NULL DEFAULT '',
    sort_order       INTEGER      NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS projects (
    id         SERIAL PRIMARY KEY,
    profile_id INTEGER      NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    name       VARCHAR(256) NOT NULL DEFAULT '',
    context    TEXT         NOT NULL DEFAULT '',
    role       VARCHAR(128) NOT NULL DEFAULT '',
    tools      VARCHAR(256) NOT NULL DEFAULT '',
    outcome    TEXT         NOT NULL DEFAULT '',
    learnings  TEXT         NOT NULL DEFAULT '',
    sort_order INTEGER      NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS documents (
    id         SERIAL PRIMARY KEY,
    profile_id INTEGER      NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    name       VARCHAR(256) NOT NULL,
    type       VARCHAR(64)  NOT NULL DEFAULT 'Notes',
    file_path  VARCHAR(512) NOT NULL DEFAULT '',
    file_size  INTEGER      NOT NULL DEFAULT 0,
    mime_type  VARCHAR(128) NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─── 目标职位 ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS target_roles (
    id                  SERIAL PRIMARY KEY,
    user_key            VARCHAR(64)  NOT NULL DEFAULT 'default',
    title               VARCHAR(256) NOT NULL,
    company             VARCHAR(256) NOT NULL,
    jd                  TEXT         NOT NULL DEFAULT '',
    team_info           VARCHAR(256) NOT NULL DEFAULT '',
    company_background  TEXT         NOT NULL DEFAULT '',
    team_background     TEXT         NOT NULL DEFAULT '',
    additional_notes    TEXT         NOT NULL DEFAULT '',
    interview_questions JSONB        NOT NULL DEFAULT '[]',
    prep_content        TEXT         NOT NULL DEFAULT '',
    prep_version        INTEGER      NOT NULL DEFAULT 0,
    is_prep_user_edited BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_target_roles_user_key ON target_roles (user_key);

CREATE TABLE IF NOT EXISTS role_sources (
    id                SERIAL PRIMARY KEY,
    role_id           INTEGER      NOT NULL REFERENCES target_roles(id) ON DELETE CASCADE,
    name              VARCHAR(512) NOT NULL,
    type              VARCHAR(64)  NOT NULL,
    file_path         VARCHAR(512) NOT NULL DEFAULT '',
    extracted_content TEXT         NOT NULL DEFAULT '',
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS role_dimension_models (
    id             SERIAL PRIMARY KEY,
    role_id        INTEGER     NOT NULL UNIQUE REFERENCES target_roles(id) ON DELETE CASCADE,
    version        INTEGER     NOT NULL DEFAULT 1,
    is_user_edited BOOLEAN     NOT NULL DEFAULT FALSE,
    dimensions     JSONB       NOT NULL DEFAULT '{}',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 面试系统 ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS interview_sessions (
    id                  SERIAL PRIMARY KEY,
    user_key            VARCHAR(64) NOT NULL DEFAULT 'default',
    role_id             INTEGER     REFERENCES target_roles(id) ON DELETE SET NULL,
    interviewer_id      VARCHAR(32) NOT NULL DEFAULT 'alex',
    status              VARCHAR(32) NOT NULL DEFAULT 'pending',
    transcript_consent  BOOLEAN     NOT NULL DEFAULT TRUE,
    started_at          TIMESTAMPTZ,
    ended_at            TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_interview_sessions_user_key ON interview_sessions (user_key);

CREATE TABLE IF NOT EXISTS interview_messages (
    id             SERIAL PRIMARY KEY,
    session_id     INTEGER     NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
    role           VARCHAR(16) NOT NULL,
    content        TEXT        NOT NULL,
    question_index INTEGER     NOT NULL DEFAULT 0,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS interview_feedbacks (
    id                  SERIAL PRIMARY KEY,
    session_id          INTEGER     NOT NULL UNIQUE REFERENCES interview_sessions(id) ON DELETE CASCADE,
    user_key            VARCHAR(64) NOT NULL DEFAULT 'default',
    overall_score       FLOAT       NOT NULL DEFAULT 0.0,
    strengths           JSONB       NOT NULL DEFAULT '[]',
    improvements        JSONB       NOT NULL DEFAULT '[]',
    recommended_actions JSONB       NOT NULL DEFAULT '[]',
    transcript          TEXT        NOT NULL DEFAULT '',
    dimension_scores    JSONB       NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 长期记忆 ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS weakness_vectors (
    id              SERIAL PRIMARY KEY,
    user_key        VARCHAR(64) NOT NULL UNIQUE DEFAULT 'default',
    vector          JSONB       NOT NULL DEFAULT '{}',
    questions_asked JSONB       NOT NULL DEFAULT '[]',
    preferred_style TEXT        NOT NULL DEFAULT '',
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_weakness_vectors_user_key ON weakness_vectors (user_key);

CREATE TABLE IF NOT EXISTS user_dimension_scores (
    id         SERIAL PRIMARY KEY,
    user_key   VARCHAR(64) NOT NULL DEFAULT 'default',
    dimension  VARCHAR(64) NOT NULL,
    score      FLOAT       NOT NULL DEFAULT 0.0,
    confidence VARCHAR(32) NOT NULL DEFAULT 'inferred',
    evidence   TEXT        NOT NULL DEFAULT '',
    version    INTEGER     NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_user_dimension_scores_user_key ON user_dimension_scores (user_key);

CREATE TABLE IF NOT EXISTS gap_snapshots (
    id          SERIAL PRIMARY KEY,
    role_id     INTEGER     NOT NULL REFERENCES target_roles(id) ON DELETE CASCADE,
    user_key    VARCHAR(64) NOT NULL DEFAULT 'default',
    match_score FLOAT       NOT NULL DEFAULT 0.0,
    gap_data    JSONB       NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── updated_at 自动更新触发器 ────────────────────────────────

CREATE OR REPLACE FUNCTION _set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION _set_updated_at();

CREATE OR REPLACE TRIGGER trg_target_roles_updated_at
    BEFORE UPDATE ON target_roles
    FOR EACH ROW EXECUTE FUNCTION _set_updated_at();

CREATE OR REPLACE TRIGGER trg_role_dimension_models_updated_at
    BEFORE UPDATE ON role_dimension_models
    FOR EACH ROW EXECUTE FUNCTION _set_updated_at();

CREATE OR REPLACE TRIGGER trg_weakness_vectors_updated_at
    BEFORE UPDATE ON weakness_vectors
    FOR EACH ROW EXECUTE FUNCTION _set_updated_at();

CREATE OR REPLACE TRIGGER trg_user_dimension_scores_updated_at
    BEFORE UPDATE ON user_dimension_scores
    FOR EACH ROW EXECUTE FUNCTION _set_updated_at();
