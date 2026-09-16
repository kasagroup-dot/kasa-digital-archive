-- ============================================================================
-- KASA DIGITAL ARCHIVE — SUPABASE DATABASE SCHEMA
-- Tahap 3 Migrasi Full-Stack
-- Target: Supabase Database (SQL Editor)
-- Catatan:
--   1. Frontend TIDAK mengakses Supabase secara langsung.
--   2. Semua akses aplikasi melalui backend Express di Railway.
--   3. File fisik tetap berada di Google Drive; Supabase Database menyimpan metadata.
--   4. legacy_id mempertahankan ID lama dari Spreadsheet agar migrasi dapat diaudit.
-- ============================================================================

BEGIN;

-- UUID generator dan pencarian teks cepat.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- --------------------------------------------------------------------------
-- 1. APP SETTINGS
-- Pengganti sheet CONFIG.
-- Secret seperti JWT secret / Google credentials TIDAK disimpan di tabel ini.
-- Secret harus berada di Railway Environment Variables.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.app_settings (
  key               text PRIMARY KEY,
  value             text NOT NULL,
  description       text,
  is_secret         boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_settings_key_chk CHECK (key ~ '^[A-Z0-9_]+$')
);

-- --------------------------------------------------------------------------
-- 2. DIVISIONS
-- Pengganti sheet DIVISIONS.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.divisions (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id              text UNIQUE,
  name                   varchar(100) NOT NULL,
  slug                   varchar(100) NOT NULL,
  description            text,
  google_drive_folder_id text,
  status                 varchar(20) NOT NULL DEFAULT 'ACTIVE',
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT divisions_status_chk CHECK (status IN ('ACTIVE','INACTIVE')),
  CONSTRAINT divisions_name_not_blank_chk CHECK (btrim(name) <> ''),
  CONSTRAINT divisions_slug_not_blank_chk CHECK (btrim(slug) <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_divisions_name_ci
  ON public.divisions (lower(name));
CREATE UNIQUE INDEX IF NOT EXISTS uq_divisions_slug_ci
  ON public.divisions (lower(slug));
CREATE UNIQUE INDEX IF NOT EXISTS uq_divisions_drive_folder
  ON public.divisions (google_drive_folder_id)
  WHERE google_drive_folder_id IS NOT NULL AND google_drive_folder_id <> '';
CREATE INDEX IF NOT EXISTS idx_divisions_status
  ON public.divisions (status);

-- --------------------------------------------------------------------------
-- 3. APP USERS
-- Pengganti sheet USERS.
-- password_algorithm mendukung transisi dari hash lama Apps Script ke bcrypt.
-- Saat user legacy berhasil login pertama kali, backend Tahap 6 akan rehash ke bcrypt.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.app_users (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id              text UNIQUE,
  full_name              varchar(150) NOT NULL,
  username               varchar(100) NOT NULL,
  email                  varchar(320),
  password_hash          text NOT NULL,
  password_algorithm     varchar(40) NOT NULL DEFAULT 'bcrypt',
  legacy_password_salt   text,
  division_id            uuid REFERENCES public.divisions(id) ON DELETE RESTRICT,
  role                   varchar(30) NOT NULL,
  status                 varchar(20) NOT NULL DEFAULT 'ACTIVE',
  must_change_password   boolean NOT NULL DEFAULT false,
  last_login_at          timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_users_role_chk CHECK (role IN ('SUPER_ADMIN','DIVISION_ADMIN','DIVISION_USER')),
  CONSTRAINT app_users_status_chk CHECK (status IN ('ACTIVE','INACTIVE')),
  CONSTRAINT app_users_password_algorithm_chk CHECK (password_algorithm IN ('bcrypt','legacy_sha256_2500')),
  CONSTRAINT app_users_username_not_blank_chk CHECK (btrim(username) <> ''),
  CONSTRAINT app_users_name_not_blank_chk CHECK (btrim(full_name) <> ''),
  CONSTRAINT app_users_role_division_chk CHECK (
    (role = 'SUPER_ADMIN' AND division_id IS NULL)
    OR
    (role IN ('DIVISION_ADMIN','DIVISION_USER') AND division_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_app_users_username_ci
  ON public.app_users (lower(username));
CREATE INDEX IF NOT EXISTS idx_app_users_division_status
  ON public.app_users (division_id, status);
CREATE INDEX IF NOT EXISTS idx_app_users_role_status
  ON public.app_users (role, status);

-- --------------------------------------------------------------------------
-- 4. USER PERMISSIONS
-- Pengganti sheet PERMISSIONS.
-- Satu user = satu permission row. SUPER_ADMIN tetap di-override di backend.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_permissions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id          text UNIQUE,
  user_id            uuid NOT NULL UNIQUE REFERENCES public.app_users(id) ON DELETE CASCADE,
  can_view           boolean NOT NULL DEFAULT true,
  can_upload         boolean NOT NULL DEFAULT false,
  can_download       boolean NOT NULL DEFAULT false,
  can_preview        boolean NOT NULL DEFAULT true,
  can_create_folder  boolean NOT NULL DEFAULT false,
  can_rename         boolean NOT NULL DEFAULT false,
  can_move           boolean NOT NULL DEFAULT false,
  can_delete         boolean NOT NULL DEFAULT false,
  can_restore        boolean NOT NULL DEFAULT false,
  can_view_log       boolean NOT NULL DEFAULT false,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- --------------------------------------------------------------------------
-- 5. AUTH SESSIONS
-- Pengganti sheet SESSIONS, tetapi lebih aman untuk JWT + refresh session.
-- Hanya HASH refresh token yang disimpan.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.auth_sessions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id           text UNIQUE,
  user_id             uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  refresh_token_hash  text NOT NULL UNIQUE,
  remember_me         boolean NOT NULL DEFAULT false,
  status              varchar(20) NOT NULL DEFAULT 'ACTIVE',
  created_at          timestamptz NOT NULL DEFAULT now(),
  expires_at          timestamptz NOT NULL,
  last_activity_at    timestamptz NOT NULL DEFAULT now(),
  revoked_at          timestamptz,
  revoked_reason      text,
  ip_address          inet,
  user_agent          text,
  CONSTRAINT auth_sessions_status_chk CHECK (status IN ('ACTIVE','REVOKED','EXPIRED')),
  CONSTRAINT auth_sessions_expiry_chk CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_status
  ON public.auth_sessions (user_id, status);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at
  ON public.auth_sessions (expires_at);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_active_lookup
  ON public.auth_sessions (user_id, expires_at)
  WHERE status = 'ACTIVE';

-- --------------------------------------------------------------------------
-- 6. FOLDERS
-- Pengganti sheet FOLDERS.
-- Parent-child memakai self foreign key.
-- Password folder mendukung legacy V26/V27 dan bcrypt baru.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.folders (
  id                           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id                    text UNIQUE,
  name                         varchar(255) NOT NULL,
  google_drive_folder_id       text NOT NULL,
  parent_folder_id             uuid REFERENCES public.folders(id) ON DELETE RESTRICT,
  division_id                  uuid NOT NULL REFERENCES public.divisions(id) ON DELETE RESTRICT,
  description                  text,
  created_by_user_id           uuid REFERENCES public.app_users(id) ON DELETE SET NULL,
  created_by_username_snapshot varchar(100),
  created_at                   timestamptz NOT NULL DEFAULT now(),
  updated_at                   timestamptz NOT NULL DEFAULT now(),
  status                       varchar(20) NOT NULL DEFAULT 'ACTIVE',
  original_parent_folder_id    uuid REFERENCES public.folders(id) ON DELETE SET NULL,
  deleted_by_user_id           uuid REFERENCES public.app_users(id) ON DELETE SET NULL,
  deleted_by_username_snapshot varchar(100),
  deleted_at                   timestamptz,
  password_enabled             boolean NOT NULL DEFAULT false,
  password_hash                text,
  password_algorithm           varchar(40),
  password_salt                text,
  password_version             integer NOT NULL DEFAULT 0,
  password_updated_at          timestamptz,
  password_updated_by_user_id  uuid REFERENCES public.app_users(id) ON DELETE SET NULL,
  password_updated_by_snapshot varchar(100),
  CONSTRAINT folders_name_not_blank_chk CHECK (btrim(name) <> ''),
  CONSTRAINT folders_drive_id_not_blank_chk CHECK (btrim(google_drive_folder_id) <> ''),
  CONSTRAINT folders_status_chk CHECK (status IN ('ACTIVE','DELETED','PURGED')),
  CONSTRAINT folders_password_algorithm_chk CHECK (
    password_algorithm IS NULL OR password_algorithm IN ('bcrypt','legacy_fp2_hmac_sha256','legacy_sha256_2500')
  ),
  CONSTRAINT folders_password_version_chk CHECK (password_version >= 0),
  CONSTRAINT folders_password_fields_chk CHECK (
    password_enabled = false
    OR (password_hash IS NOT NULL AND password_algorithm IS NOT NULL)
  ),
  CONSTRAINT folders_parent_not_self_chk CHECK (parent_folder_id IS NULL OR parent_folder_id <> id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_folders_drive_id
  ON public.folders (google_drive_folder_id);
CREATE INDEX IF NOT EXISTS idx_folders_division_parent_status
  ON public.folders (division_id, parent_folder_id, status);
CREATE INDEX IF NOT EXISTS idx_folders_parent
  ON public.folders (parent_folder_id);
CREATE INDEX IF NOT EXISTS idx_folders_deleted_at
  ON public.folders (deleted_at)
  WHERE status = 'DELETED';

-- Tidak boleh ada dua folder ACTIVE dengan nama sama pada parent yang sama.
CREATE UNIQUE INDEX IF NOT EXISTS uq_folders_active_sibling_name
  ON public.folders (
    division_id,
    coalesce(parent_folder_id, '00000000-0000-0000-0000-000000000000'::uuid),
    lower(name)
  )
  WHERE status = 'ACTIVE';

-- --------------------------------------------------------------------------
-- 7. DOCUMENTS
-- Pengganti sheet DOCUMENTS.
-- File binary tetap di Google Drive.
-- tags disimpan sebagai text[] agar mudah difilter/index.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.documents (
  id                            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id                     text UNIQUE,
  document_name                 varchar(255) NOT NULL,
  original_filename             varchar(500) NOT NULL,
  google_drive_file_id          text NOT NULL,
  drive_url                     text,
  folder_id                     uuid REFERENCES public.folders(id) ON DELETE SET NULL,
  division_id                   uuid NOT NULL REFERENCES public.divisions(id) ON DELETE RESTRICT,
  file_type                     varchar(50),
  mime_type                     varchar(255),
  extension                     varchar(30),
  file_size                     bigint NOT NULL DEFAULT 0,
  document_number               varchar(150),
  document_date                 date,
  category                      varchar(150),
  tags                          text[] NOT NULL DEFAULT '{}'::text[],
  description                   text,
  current_version               integer NOT NULL DEFAULT 1,
  checksum_sha256               varchar(64),
  uploaded_by_user_id           uuid REFERENCES public.app_users(id) ON DELETE SET NULL,
  uploaded_by_username_snapshot varchar(100),
  uploaded_at                   timestamptz NOT NULL DEFAULT now(),
  updated_at                    timestamptz NOT NULL DEFAULT now(),
  status                        varchar(20) NOT NULL DEFAULT 'ACTIVE',
  deleted_by_user_id            uuid REFERENCES public.app_users(id) ON DELETE SET NULL,
  deleted_by_username_snapshot  varchar(100),
  deleted_at                    timestamptz,
  original_folder_id            uuid REFERENCES public.folders(id) ON DELETE SET NULL,
  CONSTRAINT documents_name_not_blank_chk CHECK (btrim(document_name) <> ''),
  CONSTRAINT documents_filename_not_blank_chk CHECK (btrim(original_filename) <> ''),
  CONSTRAINT documents_drive_id_not_blank_chk CHECK (btrim(google_drive_file_id) <> ''),
  CONSTRAINT documents_file_size_chk CHECK (file_size >= 0),
  CONSTRAINT documents_version_chk CHECK (current_version >= 1),
  CONSTRAINT documents_status_chk CHECK (status IN ('ACTIVE','DELETED','PURGED')),
  CONSTRAINT documents_checksum_chk CHECK (checksum_sha256 IS NULL OR checksum_sha256 ~ '^[0-9a-fA-F]{64}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_documents_drive_file_id
  ON public.documents (google_drive_file_id);
CREATE INDEX IF NOT EXISTS idx_documents_division_folder_status
  ON public.documents (division_id, folder_id, status);
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_at
  ON public.documents (uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_document_date
  ON public.documents (document_date DESC);
CREATE INDEX IF NOT EXISTS idx_documents_category
  ON public.documents (division_id, category)
  WHERE category IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_documents_tags_gin
  ON public.documents USING gin (tags);
CREATE INDEX IF NOT EXISTS idx_documents_name_trgm
  ON public.documents USING gin (lower(document_name) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_documents_original_filename_trgm
  ON public.documents USING gin (lower(original_filename) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_documents_deleted_at
  ON public.documents (deleted_at)
  WHERE status = 'DELETED';

-- Duplicate preflight lama membandingkan ORIGINAL_FILENAME dalam divisi+folder.
CREATE UNIQUE INDEX IF NOT EXISTS uq_documents_active_filename_in_folder
  ON public.documents (
    division_id,
    coalesce(folder_id, '00000000-0000-0000-0000-000000000000'::uuid),
    lower(original_filename)
  )
  WHERE status = 'ACTIVE';

-- --------------------------------------------------------------------------
-- 8. DOCUMENT VERSIONS
-- Pengganti sheet FILE_VERSIONS.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.document_versions (
  id                            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id                     text UNIQUE,
  document_id                   uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  version_number                integer NOT NULL,
  google_drive_file_id          text NOT NULL,
  drive_url                     text,
  original_filename             varchar(500),
  mime_type                     varchar(255),
  extension                     varchar(30),
  file_size                     bigint NOT NULL DEFAULT 0,
  checksum_sha256               varchar(64),
  uploaded_by_user_id           uuid REFERENCES public.app_users(id) ON DELETE SET NULL,
  uploaded_by_username_snapshot varchar(100),
  uploaded_at                   timestamptz NOT NULL DEFAULT now(),
  description                   text,
  CONSTRAINT document_versions_version_chk CHECK (version_number >= 1),
  CONSTRAINT document_versions_file_size_chk CHECK (file_size >= 0),
  CONSTRAINT document_versions_checksum_chk CHECK (checksum_sha256 IS NULL OR checksum_sha256 ~ '^[0-9a-fA-F]{64}$'),
  CONSTRAINT document_versions_unique_version UNIQUE (document_id, version_number)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_document_versions_drive_file_id
  ON public.document_versions (google_drive_file_id);
CREATE INDEX IF NOT EXISTS idx_document_versions_document
  ON public.document_versions (document_id, version_number DESC);

-- --------------------------------------------------------------------------
-- 9. FAVORITES
-- Pengganti sheet FAVORITES.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.favorites (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id   text UNIQUE,
  user_id     uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT favorites_user_document_uq UNIQUE (user_id, document_id)
);

CREATE INDEX IF NOT EXISTS idx_favorites_user_created
  ON public.favorites (user_id, created_at DESC);

-- --------------------------------------------------------------------------
-- 10. RECYCLE ITEMS
-- Pengganti sheet RECYCLE_BIN.
-- Dibuat relational: object folder/document mempunyai FK nyata.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.recycle_items (
  id                           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id                    text UNIQUE,
  object_type                  varchar(20) NOT NULL,
  document_id                  uuid REFERENCES public.documents(id) ON DELETE CASCADE,
  folder_id                    uuid REFERENCES public.folders(id) ON DELETE CASCADE,
  division_id                  uuid NOT NULL REFERENCES public.divisions(id) ON DELETE RESTRICT,
  original_parent_folder_id    uuid REFERENCES public.folders(id) ON DELETE SET NULL,
  deleted_by_user_id           uuid REFERENCES public.app_users(id) ON DELETE SET NULL,
  deleted_by_username_snapshot varchar(100),
  deleted_at                   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT recycle_items_type_chk CHECK (object_type IN ('DOCUMENT','FOLDER')),
  CONSTRAINT recycle_items_target_chk CHECK (
    (object_type = 'DOCUMENT' AND document_id IS NOT NULL AND folder_id IS NULL)
    OR
    (object_type = 'FOLDER' AND folder_id IS NOT NULL AND document_id IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_recycle_document
  ON public.recycle_items (document_id)
  WHERE document_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_recycle_folder
  ON public.recycle_items (folder_id)
  WHERE folder_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_recycle_division_deleted
  ON public.recycle_items (division_id, deleted_at DESC);

-- --------------------------------------------------------------------------
-- 11. AUDIT LOGS
-- Pengganti sheet ACTIVITY_LOG.
-- Username snapshot dipertahankan agar history tetap terbaca walau user dihapus.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id         text UNIQUE,
  occurred_at       timestamptz NOT NULL DEFAULT now(),
  user_id           uuid REFERENCES public.app_users(id) ON DELETE SET NULL,
  username_snapshot varchar(100),
  division_id       uuid REFERENCES public.divisions(id) ON DELETE SET NULL,
  action            varchar(100) NOT NULL,
  object_type       varchar(80),
  object_id         text,
  object_name       varchar(500),
  detail            text,
  ip_address        inet,
  user_agent        text,
  metadata          jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_time
  ON public.audit_logs (occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_time
  ON public.audit_logs (user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_division_time
  ON public.audit_logs (division_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_time
  ON public.audit_logs (action, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_object
  ON public.audit_logs (object_type, object_id);

-- --------------------------------------------------------------------------
-- 12. PASSWORD RESET REQUESTS
-- Pengganti sheet PASSWORD_RESET_REQUESTS.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.password_reset_requests (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id              text UNIQUE,
  user_id                uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  username_snapshot      varchar(100) NOT NULL,
  division_id            uuid REFERENCES public.divisions(id) ON DELETE SET NULL,
  requested_at           timestamptz NOT NULL DEFAULT now(),
  status                 varchar(20) NOT NULL DEFAULT 'PENDING',
  resolved_by_user_id    uuid REFERENCES public.app_users(id) ON DELETE SET NULL,
  resolved_at            timestamptz,
  resolution_action      varchar(30),
  detail                 text,
  CONSTRAINT password_reset_status_chk CHECK (status IN ('PENDING','RESOLVED','CANCELLED'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_password_reset_pending_user
  ON public.password_reset_requests (user_id)
  WHERE status = 'PENDING';
CREATE INDEX IF NOT EXISTS idx_password_reset_status_requested
  ON public.password_reset_requests (status, requested_at DESC);

-- --------------------------------------------------------------------------
-- 13. FOLDER UNLOCKS
-- Tabel baru untuk menggantikan cache unlock Apps Script pada deployment multi-instance.
-- password_version membuat unlock lama otomatis invalid setelah password folder berubah.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.folder_unlocks (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_session_id  uuid NOT NULL REFERENCES public.auth_sessions(id) ON DELETE CASCADE,
  folder_id        uuid NOT NULL REFERENCES public.folders(id) ON DELETE CASCADE,
  password_version integer NOT NULL,
  unlocked_at      timestamptz NOT NULL DEFAULT now(),
  expires_at       timestamptz NOT NULL,
  CONSTRAINT folder_unlocks_version_chk CHECK (password_version >= 0),
  CONSTRAINT folder_unlocks_expiry_chk CHECK (expires_at > unlocked_at),
  CONSTRAINT folder_unlocks_session_folder_uq UNIQUE (auth_session_id, folder_id)
);

CREATE INDEX IF NOT EXISTS idx_folder_unlocks_expiry
  ON public.folder_unlocks (expires_at);
CREATE INDEX IF NOT EXISTS idx_folder_unlocks_folder
  ON public.folder_unlocks (folder_id, expires_at DESC);

-- --------------------------------------------------------------------------
-- 14. UPLOAD SESSIONS
-- Tabel baru agar resumable upload tetap recoverable jika Railway restart.
-- Drive resumable URL hanya boleh dikembalikan kepada session/user pemiliknya.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.upload_sessions (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                    uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  division_id                uuid NOT NULL REFERENCES public.divisions(id) ON DELETE RESTRICT,
  folder_id                  uuid REFERENCES public.folders(id) ON DELETE SET NULL,
  client_upload_id           varchar(150),
  original_filename          varchar(500) NOT NULL,
  document_name              varchar(255) NOT NULL,
  mime_type                  varchar(255),
  file_size                  bigint NOT NULL,
  bytes_uploaded             bigint NOT NULL DEFAULT 0,
  duplicate_action           varchar(20) NOT NULL DEFAULT 'none',
  duplicate_document_id      uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  google_drive_target_id     text NOT NULL,
  drive_resumable_uri        text,
  status                     varchar(20) NOT NULL DEFAULT 'INITIATED',
  completed_document_id      uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  error_message              text,
  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now(),
  expires_at                 timestamptz NOT NULL,
  CONSTRAINT upload_sessions_size_chk CHECK (file_size >= 0),
  CONSTRAINT upload_sessions_bytes_chk CHECK (bytes_uploaded >= 0 AND bytes_uploaded <= file_size),
  CONSTRAINT upload_sessions_duplicate_action_chk CHECK (duplicate_action IN ('none','version','autorename')),
  CONSTRAINT upload_sessions_status_chk CHECK (status IN ('INITIATED','UPLOADING','COMPLETED','FAILED','CANCELLED','EXPIRED')),
  CONSTRAINT upload_sessions_expiry_chk CHECK (expires_at > created_at)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_upload_sessions_client_upload_id
  ON public.upload_sessions (client_upload_id)
  WHERE client_upload_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_upload_sessions_user_status
  ON public.upload_sessions (user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_upload_sessions_expiry
  ON public.upload_sessions (expires_at)
  WHERE status IN ('INITIATED','UPLOADING');

-- ============================================================================
-- UPDATED_AT TRIGGER
-- ============================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_app_settings_updated_at ON public.app_settings;
CREATE TRIGGER trg_app_settings_updated_at
BEFORE UPDATE ON public.app_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_divisions_updated_at ON public.divisions;
CREATE TRIGGER trg_divisions_updated_at
BEFORE UPDATE ON public.divisions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_app_users_updated_at ON public.app_users;
CREATE TRIGGER trg_app_users_updated_at
BEFORE UPDATE ON public.app_users
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_user_permissions_updated_at ON public.user_permissions;
CREATE TRIGGER trg_user_permissions_updated_at
BEFORE UPDATE ON public.user_permissions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_folders_updated_at ON public.folders;
CREATE TRIGGER trg_folders_updated_at
BEFORE UPDATE ON public.folders
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_documents_updated_at ON public.documents;
CREATE TRIGGER trg_documents_updated_at
BEFORE UPDATE ON public.documents
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_upload_sessions_updated_at ON public.upload_sessions;
CREATE TRIGGER trg_upload_sessions_updated_at
BEFORE UPDATE ON public.upload_sessions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- FOLDER HIERARCHY VALIDATION
-- 1. Parent harus pada divisi yang sama.
-- 2. Tidak boleh membuat siklus folder.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.validate_folder_hierarchy()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  parent_division uuid;
  cycle_found boolean;
BEGIN
  IF NEW.parent_folder_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.parent_folder_id = NEW.id THEN
    RAISE EXCEPTION 'Folder cannot be its own parent';
  END IF;

  SELECT division_id
    INTO parent_division
    FROM public.folders
   WHERE id = NEW.parent_folder_id;

  IF parent_division IS NULL THEN
    RAISE EXCEPTION 'Parent folder not found';
  END IF;

  IF parent_division <> NEW.division_id THEN
    RAISE EXCEPTION 'Parent folder must belong to the same division';
  END IF;

  WITH RECURSIVE descendants AS (
    SELECT id
      FROM public.folders
     WHERE parent_folder_id = NEW.id
    UNION ALL
    SELECT f.id
      FROM public.folders f
      JOIN descendants d ON f.parent_folder_id = d.id
  )
  SELECT EXISTS (
    SELECT 1 FROM descendants WHERE id = NEW.parent_folder_id
  ) INTO cycle_found;

  IF cycle_found THEN
    RAISE EXCEPTION 'Folder hierarchy cycle detected';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_folder_hierarchy ON public.folders;
CREATE TRIGGER trg_validate_folder_hierarchy
BEFORE INSERT OR UPDATE OF parent_folder_id, division_id
ON public.folders
FOR EACH ROW EXECUTE FUNCTION public.validate_folder_hierarchy();

-- ============================================================================
-- DOCUMENT LOCATION VALIDATION
-- Folder dokumen harus berada di divisi yang sama dengan dokumen.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.validate_document_folder_division()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  folder_division uuid;
BEGIN
  IF NEW.folder_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT division_id
    INTO folder_division
    FROM public.folders
   WHERE id = NEW.folder_id;

  IF folder_division IS NULL THEN
    RAISE EXCEPTION 'Document folder not found';
  END IF;

  IF folder_division <> NEW.division_id THEN
    RAISE EXCEPTION 'Document and folder must belong to the same division';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_document_folder_division ON public.documents;
CREATE TRIGGER trg_validate_document_folder_division
BEFORE INSERT OR UPDATE OF folder_id, division_id
ON public.documents
FOR EACH ROW EXECUTE FUNCTION public.validate_document_folder_division();

-- ============================================================================
-- RLS / DIRECT DATABASE ACCESS LOCKDOWN
-- Arsitektur KASA: frontend -> Express -> Supabase Database.
-- Tidak ada policy anon/authenticated. Supabase REST direct access ditolak.
-- Backend menggunakan @supabase/supabase-js + SUPABASE_SERVICE_ROLE_KEY di server. Jangan pernah expose service role key ke frontend.
-- ============================================================================
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.divisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recycle_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_reset_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folder_unlocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.upload_sessions ENABLE ROW LEVEL SECURITY;

-- Explicitly remove privileges from public API roles where possible.
REVOKE ALL ON TABLE public.app_settings FROM anon, authenticated;
REVOKE ALL ON TABLE public.divisions FROM anon, authenticated;
REVOKE ALL ON TABLE public.app_users FROM anon, authenticated;
REVOKE ALL ON TABLE public.user_permissions FROM anon, authenticated;
REVOKE ALL ON TABLE public.auth_sessions FROM anon, authenticated;
REVOKE ALL ON TABLE public.folders FROM anon, authenticated;
REVOKE ALL ON TABLE public.documents FROM anon, authenticated;
REVOKE ALL ON TABLE public.document_versions FROM anon, authenticated;
REVOKE ALL ON TABLE public.favorites FROM anon, authenticated;
REVOKE ALL ON TABLE public.recycle_items FROM anon, authenticated;
REVOKE ALL ON TABLE public.audit_logs FROM anon, authenticated;
REVOKE ALL ON TABLE public.password_reset_requests FROM anon, authenticated;
REVOKE ALL ON TABLE public.folder_unlocks FROM anon, authenticated;
REVOKE ALL ON TABLE public.upload_sessions FROM anon, authenticated;

COMMIT;
