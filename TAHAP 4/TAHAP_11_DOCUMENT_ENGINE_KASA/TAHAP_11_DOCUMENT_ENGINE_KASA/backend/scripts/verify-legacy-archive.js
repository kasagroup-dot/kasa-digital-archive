import dotenv from 'dotenv';
import { assertSupabaseEnv } from '../src/config/env.js';
import { getSupabaseAdmin } from '../src/config/supabase.js';
import { exportLegacyWorkbook, parseLegacyWorkbook } from './lib/legacyArchiveSource.js';

dotenv.config();
assertSupabaseEnv();
const supabase=getSupabaseAdmin();

async function countLegacy(table){
  const {data,error}=await supabase.from(table).select('legacy_id').not('legacy_id','is',null);
  if(error)throw error;
  return data?.length||0;
}

async function main(){
  const {buffer,id}=await exportLegacyWorkbook({saveCopy:false});
  const sheets=parseLegacyWorkbook(buffer);
  const expected={
    folders:sheets.FOLDERS.length,
    documents:sheets.DOCUMENTS.length,
    document_versions:sheets.FILE_VERSIONS.length,
    favorites:sheets.FAVORITES.length,
    recycle_items:sheets.RECYCLE_BIN.length,
    audit_logs:sheets.ACTIVITY_LOG.length,
    password_reset_requests:sheets.PASSWORD_RESET_REQUESTS.length
  };
  const actual={};
  for(const table of Object.keys(expected)) actual[table]=await countLegacy(table);

  console.log('\nKASA STAGE 10 — VERIFY');
  console.log('======================');
  console.log(`Spreadsheet: ${id}`);
  let ok=true;
  for(const table of Object.keys(expected)){
    const match=actual[table]===expected[table]; if(!match)ok=false;
    console.log(`${match?'✅':'❌'} ${table.padEnd(26)} source=${String(expected[table]).padStart(4)} supabase=${String(actual[table]).padStart(4)}`);
  }
  console.log(`ℹ️  legacy sessions source=${sheets.SESSIONS.length} — sengaja TIDAK dimigrasikan.`);

  const [{data:activeFolders,error:fe},{data:activeDocs,error:de}]=await Promise.all([
    supabase.from('folders').select('id,legacy_id').eq('status','ACTIVE'),
    supabase.from('documents').select('id,legacy_id').eq('status','ACTIVE')
  ]);
  if(fe)throw fe;if(de)throw de;
  console.log(`\nTarget aktif total: ${activeFolders?.length||0} folders, ${activeDocs?.length||0} documents.`);
  console.log('Catatan: total target bisa lebih besar karena folder test/new-app Tahap 9C dipertahankan.');

  if(!ok){console.error('\n❌ VERIFY belum cocok. Jangan lanjut Tahap 11.');process.exit(1);}
  console.log('\n✅ VERIFY Tahap 10 sukses. Metadata legacy sudah masuk Supabase.');
}
main().catch(err=>{console.error('\n❌ Verify gagal:',err.message);process.exit(1);});
