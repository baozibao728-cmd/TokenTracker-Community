-- TEST FIXTURE ONLY. Never include in a cloud bootstrap/migration.
-- Minimal platform prerequisites, not a mock implementation of application RPCs.
-- Deliberately NOSUPERUSER/NOBYPASSRLS: validate bootstrap as its real owner role.
CREATE ROLE project_admin NOSUPERUSER NOBYPASSRLS;
CREATE ROLE anon NOSUPERUSER NOBYPASSRLS;
CREATE ROLE authenticated NOSUPERUSER NOBYPASSRLS;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY, email text NOT NULL, profile jsonb NOT NULL DEFAULT '{}');
GRANT USAGE ON SCHEMA auth TO project_admin;
GRANT SELECT, REFERENCES ON auth.users TO project_admin;
GRANT USAGE, CREATE ON SCHEMA public TO project_admin;
GRANT USAGE ON SCHEMA public TO anon, authenticated;
-- InsForge default grants must be revoked explicitly by the baseline.
ALTER DEFAULT PRIVILEGES FOR ROLE project_admin IN SCHEMA public
  GRANT ALL ON TABLES TO anon, authenticated;
