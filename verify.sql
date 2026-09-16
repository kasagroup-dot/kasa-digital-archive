-- ============================================================================
-- KASA DIGITAL ARCHIVE — DATABASE VERIFICATION
-- Jalankan setelah schema.sql dan seed.sql.
-- Query ini hanya membaca data, tidak mengubah apapun.
-- ============================================================================

-- 1. Pastikan 14 tabel inti tersedia.
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'app_settings','divisions','app_users','user_permissions','auth_sessions',
    'folders','documents','document_versions','favorites','recycle_items',
    'audit_logs','password_reset_requests','folder_unlocks','upload_sessions'
  )
ORDER BY table_name;

-- 2. Harus menghasilkan 12 divisi.
SELECT count(*) AS total_divisions
FROM public.divisions
WHERE status = 'ACTIVE';

-- 3. Lihat 12 divisi + Google Drive folder ID.
SELECT legacy_id, name, slug, description, google_drive_folder_id, status
FROM public.divisions
ORDER BY name;

-- 4. Lihat settings penting.
SELECT key, value, description
FROM public.app_settings
ORDER BY key;

-- 5. Pastikan RLS aktif untuk seluruh tabel aplikasi.
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname IN (
    'app_settings','divisions','app_users','user_permissions','auth_sessions',
    'folders','documents','document_versions','favorites','recycle_items',
    'audit_logs','password_reset_requests','folder_unlocks','upload_sessions'
  )
ORDER BY c.relname;

-- 6. Tabel user sengaja masih kosong pada Tahap 3.
SELECT count(*) AS total_users_stage_3
FROM public.app_users;
