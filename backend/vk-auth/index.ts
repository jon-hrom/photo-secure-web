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
    await ensureTablesExist(client);
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
    await ensureTablesExist(client);
    
    await client.query(
      `DELETE FROM oauth_sessions WHERE expires_at < CURRENT_TIMESTAMP`
    );
    
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

async function ensureTablesExist(client) {
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS vk_users (
        user_id SERIAL PRIMARY KEY,
        vk_sub VARCHAR(100) UNIQUE NOT NULL,
        email VARCHAR(255),
        phone_number VARCHAR(50),
        full_name VARCHAR(255),
        avatar_url TEXT,
        is_verified BOOLEAN DEFAULT FALSE,
        raw_profile TEXT,
        registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_blocked BOOLEAN DEFAULT false,
        blocked_at TIMESTAMP,
        blocked_by VARCHAR(255),
        block_reason TEXT,
        ip_address VARCHAR(45),
        user_agent TEXT,
        is_active BOOLEAN DEFAULT true
      )
    `);
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS oauth_sessions (
        state TEXT PRIMARY KEY,
        nonce TEXT NOT NULL,
        code_verifier TEXT NOT NULL,
        provider TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL
      )
    `);
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS vk_temp_sessions (
        session_id VARCHAR(32) PRIMARY KEY,
        data JSONB NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await client.query(`CREATE INDEX IF NOT EXISTS idx_vk_users_vk_sub ON vk_users(vk_sub)`);
  } catch (error) {
    console.error('Error ensuring tables exist:', error);
  }
}

async function upsertVKUser(vkUserId, firstName, lastName, avatarUrl, isVerified, email, phone, ipAddress, userAgent) {
  const client = new Client({ connectionString: DATABASE_URL });
  
  try {
    await client.connect();
    await ensureTablesExist(client);
    
    const fullName = `${firstName} ${lastName}`.trim();
    
    // First check if user exists by vk_sub in vk_users table
    const vkUserResult = await client.query(
      `SELECT user_id FROM vk_users WHERE vk_sub = ${escapeSQL(vkUserId)}`
    );
    
    if (vkUserResult.rows.length > 0) {
      // User exists, return their user_id (read-only mode)
      return vkUserResult.rows[0].user_id;
    }
    
    // Check if user exists in users table by vk_id
    const existingUserResult = await client.query(
      `SELECT id FROM users WHERE vk_id = ${escapeSQL(vkUserId)}`
    );
    
    if (existingUserResult.rows.length > 0) {
      // User exists in users table, return their id
      return existingUserResult.rows[0].id;
    }
    
    // User doesn't exist - return error instead of creating
    throw new Error('User not found. Please contact administrator to create VK account.');
    
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
    const sessionId = queryStringParameters.session_id;
    
    // Get session data by session_id - FIRST priority
    if (httpMethod === 'GET' && sessionId) {
      const client = new Client({ connectionString: DATABASE_URL });
      try {
        await client.connect();
        await ensureTablesExist(client);
        
        await client.query(
          `DELETE FROM vk_temp_sessions WHERE expires_at < NOW()`
        );
        
        const result = await client.query(
          `SELECT data FROM vk_temp_sessions WHERE session_id = ${escapeSQL(sessionId)} AND expires_at > NOW()`
        );
        
        if (result.rows.length === 0) {
          return {
            statusCode: 404,
            headers: { 
              'Content-Type': 'application/json', 
              'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ error: 'Session not found or expired' }),
            isBase64Encoded: false
          };
        }
        
        const sessionData = result.rows[0].data;
        
        return {
          statusCode: 200,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify(sessionData),
          isBase64Encoded: false
        };
      } finally {
        await client.end();
      }
    }
    
    // Initial OAuth flow - redirect to VK
    if (httpMethod === 'GET' && !code && !sessionId) {
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
    
    // OAuth callback - exchange code for token
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
      
      const ipAddress = event.requestContext?.identity?.sourceIp || 'unknown';
      const userAgent = event.headers?.['User-Agent'] || event.headers?.['user-agent'] || '';
      const email = tokenData.email || '';
      const phone = tokenData.phone || '';
      
      // Call Python function to create/update user (has write permissions)
      const CREATE_VK_USER_URL = 'https://functions.poehali.dev/ae4d99c5-29f0-4687-9ce5-e9c841acd105';
      
      const createUserResponse = await fetch(CREATE_VK_USER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vk_id: String(tokenData.user_id),
          full_name: `${vkUserInfo.first_name || ''} ${vkUserInfo.last_name || ''}`.trim(),
          email: email,
          phone: phone,
          avatar_url: vkUserInfo.photo_max || vkUserInfo.photo_200 || '',
          is_verified: vkUserInfo.verified === 1 || vkUserInfo.verified === true
        })
      });
      
      if (!createUserResponse.ok) {
        const errorText = await createUserResponse.text();
        console.error('Failed to create VK user:', errorText);
        return {
          statusCode: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ error: 'Failed to create user', details: errorText }),
          isBase64Encoded: false
        };
      }
      
      const createUserData = await createUserResponse.json();
      const userId = createUserData.user_id;
      
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
        email: email || ''
      };
      
      // Generate short session ID and save to temp storage (5 min TTL)
      const sessionId = Array.from({ length: 16 }, () => 
        Math.random().toString(36).charAt(2)
      ).join('');
      
      const tempSessionData = {
        token: sessionToken,
        userData: userData,
        created: Date.now()
      };
      
      // Save to database with TTL
      const tempClient = new Client({ connectionString: DATABASE_URL });
      try {
        await tempClient.connect();
        await ensureTablesExist(tempClient);
        const dataJSON = escapeSQL(JSON.stringify(tempSessionData));
        await tempClient.query(
          `INSERT INTO vk_temp_sessions (session_id, data, expires_at) 
           VALUES (${escapeSQL(sessionId)}, ${dataJSON}, NOW() + INTERVAL '5 minutes')
           ON CONFLICT (session_id) DO UPDATE SET data = ${dataJSON}, expires_at = NOW() + INTERVAL '5 minutes'`
        );
        console.log('💾 Saved temp session:', sessionId);
      } finally {
        await tempClient.end();
      }
      
      // HTTP 302 redirect instead of HTML with script
      return {
        statusCode: 302,
        headers: { 
          'Location': `${BASE_URL}/?vk_session=${sessionId}`,
          'Set-Cookie': `vk_session=${sessionToken}; Path=/; Max-Age=2592000; Secure; HttpOnly; SameSite=Lax`,
          'Access-Control-Allow-Origin': '*'
        },
        body: '',
        isBase64Encoded: false
      };
    }
    
    // Update VK user activity
    if (httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const { action, vk_id } = body;
      
      if (action === 'update-activity' && vk_id) {
        const client = new Client({ connectionString: DATABASE_URL });
        try {
          await client.connect();
          await ensureTablesExist(client);
          const ipAddress = event.requestContext?.identity?.sourceIp || 'unknown';
          const userAgent = event.headers?.['User-Agent'] || '';
          
          await client.query(
            `UPDATE vk_users 
             SET last_login = CURRENT_TIMESTAMP,
                 ip_address = ${escapeSQL(ipAddress)},
                 user_agent = ${escapeSQL(userAgent)}
             WHERE vk_sub = ${escapeSQL(vk_id)}`
          );
          
          return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ success: true }),
            isBase64Encoded: false
          };
        } finally {
          await client.end();
        }
      }
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