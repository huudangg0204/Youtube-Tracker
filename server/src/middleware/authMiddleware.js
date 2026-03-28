const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load .env
const serverEnvPath = path.resolve(__dirname, '..', '..', '.env');
const rootEnvPath = path.resolve(__dirname, '..', '..', '..', '.env');
require('dotenv').config({ path: fs.existsSync(serverEnvPath) ? serverEnvPath : rootEnvPath });

// Khởi tạo Supabase client (dùng để verify JWT)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

/**
 * Middleware xác thực JWT Supabase.
 *
 * - Lấy token từ header: Authorization: Bearer <JWT>
 * - Verify bằng Supabase getUser()
 * - Nếu hợp lệ: gán req.userId = user.id rồi next()
 * - Nếu không hợp lệ: trả về 401 Unauthorized
 */
async function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing or invalid Authorization header. Expected: Bearer <JWT>',
    });
  }

  const token = authHeader.slice(7); // Bỏ "Bearer " prefix

  try {
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data?.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: error?.message || 'Invalid or expired JWT token',
      });
    }

    // Gán user_id vào request để routes dùng
    req.userId = data.user.id;
    req.userEmail = data.user.email;
    next();
  } catch (err) {
    console.error('[Auth] Unexpected error verifying JWT:', err.message);
    return res.status(500).json({ error: 'Internal server error during authentication' });
  }
}

module.exports = { authMiddleware };
