-- Generated passwords use a separate digest column so legacy imported users
-- keep their existing hash_algorithm constraint and verification path.
ALTER TABLE users ADD COLUMN generated_password_hash TEXT;
