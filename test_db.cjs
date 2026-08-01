const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const code = fs.readFileSync('src/integrations/supabase/client.ts', 'utf8');
const urlMatch = code.match(/https:\/\/[^"']+/);
const keyMatch = code.match(/eyJhbG[^"']+/);
const supabase = createClient(urlMatch[0], keyMatch[0]);

async function check() {
  const { data, error } = await supabase.from('payments').select('*, residents!inner(full_name, rooms!inner(room_number))');
  if (error) {
    console.error(error);
    return;
  }
  const raflys = data.filter(d => d.residents.full_name.toLowerCase().includes('rafli') || d.residents.full_name.toLowerCase().includes('rafly'));
  console.log('Rafly payments:');
  console.log(JSON.stringify(raflys, null, 2));
}
check();
