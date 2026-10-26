-- Reviewed language selection only. This migration creates no school, person,
-- or business records; schools inherit English and the reviewed pilot list until
-- an administrator explicitly saves locale configuration.
CREATE TABLE school_locale_settings (
 school_id TEXT PRIMARY KEY REFERENCES schools(id) ON DELETE CASCADE,
 default_locale TEXT NOT NULL DEFAULT 'en',
 enabled_locales_json TEXT NOT NULL DEFAULT '["en","hi","ta","ur"]' CHECK(json_valid(enabled_locales_json)),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
 updated_by TEXT NOT NULL REFERENCES users(id),
 updated_at INTEGER NOT NULL
);
CREATE TABLE user_locale_preferences (
 school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 language_mode TEXT NOT NULL CHECK(language_mode IN ('follow_school','explicit')),
 locale_tag TEXT,
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
 updated_at INTEGER NOT NULL,
 PRIMARY KEY(school_id,user_id),
 CHECK((language_mode='follow_school' AND locale_tag IS NULL) OR (language_mode='explicit' AND locale_tag IS NOT NULL))
);
CREATE TRIGGER school_locale_settings_tenant_insert BEFORE INSERT ON school_locale_settings
WHEN NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.updated_by AND school_id=NEW.school_id)
BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP_MISMATCH'); END;
CREATE TRIGGER school_locale_settings_tenant_update BEFORE UPDATE ON school_locale_settings
WHEN NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.updated_by AND school_id=NEW.school_id)
BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP_MISMATCH'); END;
CREATE TRIGGER user_locale_preferences_tenant_insert BEFORE INSERT ON user_locale_preferences
WHEN NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.user_id AND school_id=NEW.school_id)
BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP_MISMATCH'); END;
CREATE TRIGGER user_locale_preferences_tenant_update BEFORE UPDATE ON user_locale_preferences
WHEN NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.user_id AND school_id=NEW.school_id)
BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP_MISMATCH'); END;
