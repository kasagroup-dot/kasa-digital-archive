import 'dotenv/config';
import { getSupabaseAdmin } from '../src/config/supabase.js';
import { getDriveFolderMetadata } from '../src/services/googleDrive.service.js';

try {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('app_settings').select('value').eq('key', 'ROOT_DRIVE_FOLDER_ID').maybeSingle();
  if (error) throw error;
  const rootId = String(process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID || data?.value || '').trim();
  if (!rootId) throw new Error('ROOT_DRIVE_FOLDER_ID tidak ditemukan.');
  const meta = await getDriveFolderMetadata(rootId);
  if (meta.mimeType !== 'application/vnd.google-apps.folder') throw new Error('Root Drive ID bukan folder.');
  console.log('\nKASA Google Drive Test');
  console.log('======================');
  console.log('✅ Google Drive terhubung.');
  console.log(`Root Folder : ${meta.name}`);
  console.log(`Root ID     : ${meta.id}`);
  console.log(`Trashed     : ${Boolean(meta.trashed)}`);
} catch (error) {
  console.error('\n❌ Google Drive test gagal:', error?.message || error);
  process.exit(1);
}
