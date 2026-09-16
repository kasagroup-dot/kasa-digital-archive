-- ============================================================================
-- KASA DIGITAL ARCHIVE — INITIAL SEED
-- Jalankan SETELAH schema.sql berhasil.
-- Aman dijalankan ulang: memakai UPSERT berbasis legacy_id / key.
-- ============================================================================

BEGIN;

-- --------------------------------------------------------------------------
-- APP SETTINGS
-- Secret tidak dimasukkan di sini.
-- ROOT_DRIVE_FOLDER_ID mempertahankan folder Drive aplikasi lama.
-- --------------------------------------------------------------------------
INSERT INTO public.app_settings (key, value, description, is_secret)
VALUES
  ('APP_NAME', 'KASA DIGITAL ARCHIVE', 'Nama aplikasi', false),
  ('COMPANY_NAME', 'PT. KASA GROUP', 'Nama perusahaan', false),
  ('APP_VERSION', '3.0.0-dev', 'Versi full-stack baru selama fase migrasi', false),
  ('ROOT_DRIVE_FOLDER_ID', '17JEERUnFtZaeOK9AiNm6jAqoNafH_S-e', 'Google Drive root folder existing dari aplikasi lama', false),
  ('MAX_UPLOAD_SIZE', '262144000', 'Batas upload per file dalam byte = 250 MB', false),
  ('MAX_PREVIEW_SIZE', '8388608', 'Batas preview langsung = 8 MB', false),
  ('SESSION_DURATION_HOURS', '8', 'Durasi session normal', false),
  ('REMEMBER_SESSION_DAYS', '7', 'Durasi session jika Remember Session aktif', false),
  ('DEFAULT_PAGE_SIZE', '25', 'Default pagination', false),
  ('MAX_PAGE_SIZE', '100', 'Maximum pagination page size', false),
  ('SECURITY_MODEL', 'EXPRESS_API_SUPABASE_PRIVATE_GOOGLE_DRIVE', 'Frontend tidak langsung mengakses database; file tetap di Google Drive', false)
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  is_secret = EXCLUDED.is_secret,
  updated_at = now();

-- --------------------------------------------------------------------------
-- DIVISIONS
-- Drive folder ID mempertahankan struktur Drive yang sudah digunakan aplikasi lama.
-- VISI tetap nama divisi; "Learning Center" disimpan sebagai description untuk UI.
-- --------------------------------------------------------------------------
INSERT INTO public.divisions
  (legacy_id, name, slug, description, google_drive_folder_id, status)
VALUES
  ('DIV-HR',          'HR',           'HR',           'Human Resources',     '1ZG8AXbDvaE30FLDX_NOW_wFoHcy3cTTI', 'ACTIVE'),
  ('DIV-FINANCE',     'FINANCE',      'FINANCE',      'Finance Division',    '1TLG20VvmYSV0BW9jPhWjYh1zn-i9MGj1', 'ACTIVE'),
  ('DIV-FACILITIES',  'FACILITIES',   'FACILITIES',   'Facilities',          '1QEW43UtcedqM6UPxPfIvH9_6OoCfV-Jh', 'ACTIVE'),
  ('DIV-ACCOUNTING',  'ACCOUNTING',   'ACCOUNTING',   'Accounting',          '1oaUcVgP0AcnVKlco5KOuVA1gTjQ5DmnR', 'ACTIVE'),
  ('DIV-MARKETING',   'MARKETING',    'MARKETING',    'Marketing',           '12NcI6abKiZZq7j5wEPr5ykAN3H0AnA2u', 'ACTIVE'),
  ('DIV-PARTNERSHIP', 'PARTNERSHIP',  'PARTNERSHIP',  'Partnership',         '13GC14wcxFo5j2LLfwEGEggE-m0M3anyi', 'ACTIVE'),
  ('DIV-IT',          'IT',           'IT',           'Information Tech.',   '1Lj6pjsqBQhGKda5r987ES5tk4EKCBZFU', 'ACTIVE'),
  ('DIV-DATA',        'DATA',         'DATA',         'Data & Analytics',    '1RxRtNonikIc3YPqiHkGEVzK9gphk-yJD', 'ACTIVE'),
  ('DIV-LOGISTIC',    'LOGISTIC',     'LOGISTIC',     'Logistics',           '1IoOXSCJlBSZTFIQtWVqxHGICcNVo9wV0', 'ACTIVE'),
  ('DIV-BERSIHSEHAT', 'BERSIH SEHAT', 'BERSIHSEHAT', 'Health & Sanitation', '1IWK1DAJ7V2iNmYWpl7AWiIAJekrwm8Pb', 'ACTIVE'),
  ('DIV-FNB',         'F&B',          'FNB',          'Food & Beverage',      '1W4Vg0v55CnXFPUdwcs-KakHnkgvd0Cll', 'ACTIVE'),
  ('DIV-VISI',        'VISI',         'VISI',         'Learning Center',      '1RyfH-ensHzG2KtHEgOm3eRCPnrZ-VdCc', 'ACTIVE')
ON CONFLICT (legacy_id) DO UPDATE SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  description = EXCLUDED.description,
  google_drive_folder_id = EXCLUDED.google_drive_folder_id,
  status = EXCLUDED.status,
  updated_at = now();

-- --------------------------------------------------------------------------
-- USER SEED SENGAJA TIDAK DIBUAT DI TAHAP 3.
-- Alasannya:
-- 1. Password lama menggunakan legacy_sha256_2500 + salt.
-- 2. Sistem baru wajib memakai bcrypt.
-- 3. Tahap 6 Authentication akan menyediakan bootstrap/migrasi user yang aman,
--    termasuk login legacy sekali lalu automatic rehash ke bcrypt.
-- --------------------------------------------------------------------------

COMMIT;
