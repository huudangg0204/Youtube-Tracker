require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const BASE_URL = `http://localhost:${process.env.PORT || 5000}`;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function main() {
  // 1. Lấy JWT token
  console.log('🔑 Đang đăng nhập Supabase...');
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'test@gmail.com',
    password: '123456'
  });

  if (error) {
    console.error('❌ Login failed:', error.message);
    process.exit(1);
  }
  const token = data.session.access_token;
  console.log('✅ JWT lấy thành công\n');

  // 2. Test GET /health
  console.log('📡 Test GET /health...');
  const healthRes = await fetch(`${BASE_URL}/health`);
  const health = await healthRes.json();
  console.log('→', health, '\n');

  // 3. Test POST /track
  console.log('📡 Test POST /track...');
  const trackRes = await fetch(`${BASE_URL}/track`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      videoId: 'dQw4w9WgXcQ',
      event: 'play',
      ms_played: 15000
    })
  });

  const trackData = await trackRes.json();
  console.log(`→ Status: ${trackRes.status}`);
  console.log('→ Body:', JSON.stringify(trackData, null, 2));
}

main().catch(console.error);
