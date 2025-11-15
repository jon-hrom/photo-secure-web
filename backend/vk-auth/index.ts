/**
 * Business: Авторизация через VK ID с JWT сессиями и автоматическим редиректом
 * Args: event с httpMethod, queryStringParameters для OAuth callback
 * Returns: HTTP response с редиректом на VK или главную страницу с JWT токеном
 */

const crypto = require('crypto');
const { Client } = require('pg');
const jwt = require('jsonwebtoken');

const BASE_URL = process.env.BASE_URL || 'https://foto-mix.ru';
const VK_CLIENT_ID = process.env.VK_CLIENT_ID || '';
const VK_CLIENT_SECRET = process.env.VK_CLIENT_SECRET || '';
const VK_SERVICE_TOKEN = process.env.VK_SERVICE_TOKEN || '';
const DATABASE_URL = process.env.DATABASE_URL || '';
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-change-me';

function generateState() {
  return crypto.randomBytes(32).toString('base64url');
}

function generateCodeVerifier() {
  return crypto.randomBytes(32).toString('base64url');
}

function generateCodeChallenge(verifier) {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

async function saveSession(state, codeVerifier, codeChallenge) {
  const client = new Client({ connectionString: DATABASE_URL });
  try {
    await client.connect();
    const expiresAt = new Date(Date.now() + 600000);
    await client.query(
      `INSERT INTO oauth_sessions (state, nonce, code_verifier, provider, expires_at)
       VALUES (${escapeSQL(state)}, ${escapeSQL(state)}, ${escapeSQL(codeVerifier)}, 'vkid', ${escapeSQL(expiresAt.toISOString())})`
    );
  } finally {
    await client.end();
  }
}

async function getSession(state) {
  const client = new Client({ connectionString: DATABASE_URL });
  try {
    await client.connect();
    const result = await client.query(
      `SELECT state, code_verifier FROM oauth_sessions 
       WHERE state = ${escapeSQL(state)} AND expires_at > CURRENT_TIMESTAMP`
    );
    return result.rows[0] || null;
  } finally {
    await client.end();
  }
}

async function deleteSession(state) {
  const client = new Client({ connectionString: DATABASE_URL });
  try {
    await client.connect();
    await client.query(
      `UPDATE oauth_sessions SET expires_at = CURRENT_TIMESTAMP WHERE state = ${escapeSQL(state)}`
    );
  } finally {
    await client.end();
  }
}

async function fetchVKUserInfo(userId) {
  try {
    const params = new URLSearchParams({
      user_ids: userId,
      fields: 'photo_200,photo_max,screen_name,verified',
      access_token: VK_SERVICE_TOKEN,
      v: '5.131',
      lang: 'ru'
    });
    
    const response = await fetch(`https://api.vk.com/method/users.get?${params}`);
    const data = await response.json();
    
    if (data.error) {
      console.error('VK API error:', data.error);
      return null;
    }
    
    return data.response?.[0] || null;
  } catch (e) {
    console.error('Failed to fetch VK user info:', e);
    return null;
  }
}

function escapeSQL(value) {
  if (value === null || value === undefined) {
    return 'NULL';
  }
  if (typeof value === 'boolean') {
    return value ? 'TRUE' : 'FALSE';
  }
  if (typeof value === 'number') {
    return String(value);
  }
  return "'" + String(value).replace(/'/g, "''") + "'";
}

async function upsertVKUser(vkUserId, firstName, lastName, avatarUrl, isVerified) {
  const client = new Client({ connectionString: DATABASE_URL });
  
  try {
    await client.connect();
    
    const existingResult = await client.query(
      `SELECT user_id FROM vk_users WHERE vk_sub = ${escapeSQL(vkUserId)}`
    );
    
    const fullName = `${firstName} ${lastName}`.trim();
    
    if (existingResult.rows.length > 0) {
      const userId = existingResult.rows[0].user_id;
      await client.query(
        `UPDATE vk_users 
         SET full_name = ${escapeSQL(fullName)}, 
             avatar_url = ${escapeSQL(avatarUrl)}, 
             is_verified = ${escapeSQL(isVerified)}, 
             last_login = CURRENT_TIMESTAMP
         WHERE user_id = ${escapeSQL(userId)}`
      );
      return userId;
    } else {
      const insertResult = await client.query(
        `INSERT INTO vk_users 
         (vk_sub, full_name, avatar_url, is_verified)
         VALUES (${escapeSQL(vkUserId)}, ${escapeSQL(fullName)}, ${escapeSQL(avatarUrl)}, ${escapeSQL(isVerified)})
         RETURNING user_id`
      );
      return insertResult.rows[0].user_id;
    }
  } finally {
    await client.end();
  }
}

exports.handler = async (event, context) => {
  const { httpMethod, queryStringParameters = {} } = event;
  
  if (httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Session-Id',
        'Access-Control-Max-Age': '86400'
      },
      body: '',
      isBase64Encoded: false
    };
  }
  
  try {
    if (!VK_CLIENT_ID || !VK_CLIENT_SECRET) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'VK credentials not configured' }),
        isBase64Encoded: false
      };
    }
    
    const code = queryStringParameters.code;
    const stateParam = queryStringParameters.state;
    const deviceId = queryStringParameters.device_id;
    
    if (httpMethod === 'GET' && !code) {
      const state = generateState();
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = generateCodeChallenge(codeVerifier);
      
      await saveSession(state, codeVerifier, codeChallenge);
      
      const authParams = new URLSearchParams({
        response_type: 'code',
        client_id: VK_CLIENT_ID,
        redirect_uri: `${BASE_URL}/vk-callback.html`,
        state: state,
        scope: 'email phone',
        code_challenge: codeChallenge,
        code_challenge_method: 'S256'
      });
      
      const authUrl = `https://id.vk.com/authorize?${authParams}`;
      
      return {
        statusCode: 302,
        headers: {
          'Location': authUrl,
          'Access-Control-Allow-Origin': '*'
        },
        body: '',
        isBase64Encoded: false
      };
    }
    
    if (httpMethod === 'GET' && code && stateParam) {
      const session = await getSession(stateParam);
      
      if (!session) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ error: 'Invalid or expired session' }),
          isBase64Encoded: false
        };
      }
      
      await deleteSession(stateParam);
      
      const tokenBody = new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: `${BASE_URL}/vk-callback.html`,
        code_verifier: session.code_verifier,
        client_id: VK_CLIENT_ID
      });
      
      if (deviceId) {
        tokenBody.append('device_id', deviceId);
      }
      
      const tokenResponse = await fetch('https://id.vk.com/oauth2/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: tokenBody.toString()
      });
      
      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error('VK token error:', errorText);
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ error: 'Failed to exchange code for token', details: errorText }),
          isBase64Encoded: false
        };
      }
      
      const tokenData = await tokenResponse.json();
      
      if (!tokenData.user_id) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ error: 'No user_id in token response', token_data: tokenData }),
          isBase64Encoded: false
        };
      }
      
      const vkUserInfo = await fetchVKUserInfo(String(tokenData.user_id));
      
      if (!vkUserInfo) {
        return {
          statusCode: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ error: 'Failed to fetch VK user info' }),
          isBase64Encoded: false
        };
      }
      
      const userId = await upsertVKUser(
        String(tokenData.user_id),
        vkUserInfo.first_name || '',
        vkUserInfo.last_name || '',
        vkUserInfo.photo_max || vkUserInfo.photo_200 || '',
        vkUserInfo.verified === 1 || vkUserInfo.verified === true
      );
      
      const sessionToken = jwt.sign(
        {
          user_id: userId,
          vk_user_id: tokenData.user_id,
          name: `${vkUserInfo.first_name} ${vkUserInfo.last_name}`.trim(),
          avatar: vkUserInfo.photo_max || vkUserInfo.photo_200,
          verified: vkUserInfo.verified === 1
        },
        JWT_SECRET,
        { expiresIn: '30d' }
      );
      
      console.log('🚀 VK Auth Success!');
      console.log('📦 Token payload:', { userId, vk_user_id: tokenData.user_id, name: `${vkUserInfo.first_name} ${vkUserInfo.last_name}`.trim() });
      
      const userData = {
        user_id: userId,
        vk_id: tokenData.user_id,
        name: `${vkUserInfo.first_name} ${vkUserInfo.last_name}`.trim(),
        avatar: vkUserInfo.photo_max || vkUserInfo.photo_200,
        verified: vkUserInfo.verified === 1,
        email: ''
      };
      
      const htmlResponse = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>VK Authorization</title>
  <style>
    body { font-family: Arial; padding: 20px; text-align: center; }
    .success { color: green; margin: 10px 0; }
    .info { color: blue; margin: 5px 0; font-size: 14px; }
  </style>
</head>
<body>
  <h2>✅ Вход выполнен!</h2>
  <div id="status"></div>
  <script>
    const status = document.getElementById('status');
    
    try {
      const userData = ${JSON.stringify(userData)};
      const token = ${JSON.stringify(sessionToken)};
      
      status.innerHTML += '<p class="info">Сохраняю данные...</p>';
      
      localStorage.setItem('vk_user', JSON.stringify(userData));
      localStorage.setItem('auth_token', token);
      localStorage.setItem('vk_auth_completed', 'true');
      
      status.innerHTML += '<p class="success">✅ Данные сохранены!</p>';
      status.innerHTML += '<p class="info">Имя: ' + userData.name + '</p>';
      status.innerHTML += '<p class="info">ID: ' + userData.user_id + '</p>';
      
      const saved = localStorage.getItem('vk_user');
      if (saved) {
        status.innerHTML += '<p class="success">✅ Проверка: данные в localStorage</p>';
      } else {
        status.innerHTML += '<p style="color:red">❌ Ошибка: данные не сохранились!</p>';
      }
      
      status.innerHTML += '<p class="info">Перенаправление через 2 секунды...</p>';
      
      setTimeout(function() {
        window.location.href = '${BASE_URL}/';
      }, 2000);
    } catch (error) {
      status.innerHTML = '<p style="color:red">❌ Ошибка: ' + error.message + '</p>';
      setTimeout(function() {
        window.location.href = '${BASE_URL}/';
      }, 3000);
    }
  </script>
</body>
</html>`;
      
      return {
        statusCode: 200,
        headers: { 
          'Content-Type': 'text/html; charset=utf-8',
          'Set-Cookie': `vk_session=${sessionToken}; Path=/; Max-Age=2592000; Secure; HttpOnly; SameSite=Lax`,
          'Access-Control-Allow-Origin': '*'
        },
        body: htmlResponse,
        isBase64Encoded: false
      };
    }
    
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Invalid request' }),
      isBase64Encoded: false
    };
    
  } catch (error) {
    console.error('VK auth error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: error?.message || String(error)
      }),
      isBase64Encoded: false
    };
  }
};