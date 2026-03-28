// Load biến môi trường từ .env TRƯỚC KHI dùng process.env
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const login = async () => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'test@gmail.com',
    password: '123456'
  });

  if (error) {
    console.error('Login failed:', error.message);
    return;
  }

  console.log('JWT Token:', data.session.access_token);
};

login();