/**
 * Business: Безопасная авторизация через VK ID с PKCE и OpenID Connect
 * Args: event с httpMethod, queryStringParameters для OAuth callback
 * Returns: HTTP response с редиректом на VK или JSON профилем пользователя
 */

const crypto = require('crypto');
const { Client } = require('pg');

const BASE_URL = process.env.BASE_URL || 'https://foto-mix.ru';
const VK_CLIENT_ID = process.env.VK_CLIENT_ID || '';
const VK_CLIENT_SECRET = process.env.VK_CLIENT_SECRET || '';
const DATABASE_URL = process.env.DATABASE_URL || '';

function generateCodeVerifier() {
  return crypto.randomBytes(32).toString('base64url');
}

function generateCodeChallenge(verifier) {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

function generateState() {
  return crypto.randomBytes(32).toString('base64url');
}

function generateNonce() {
  return crypto.randomBytes(32).toString('base64url');
}

async function saveSession(state, nonce, codeVerifier) {
  const client = new Client({ connectionString: DATABASE_URL });
  try {
    await client.connect();
    const expiresAt = new Date(Date.now() + 600000);
    await client.query(
      `INSERT INTO oauth_sessions (state, nonce, code_verifier, provider, expires_at)
       VALUES (${escapeSQL(state)}, ${escapeSQL(nonce)}, ${escapeSQL(codeVerifier)}, 'vkid', ${escapeSQL(expiresAt.toISOString())})`
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
      `SELECT state, nonce, code_verifier FROM oauth_sessions 
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

async function discoverVKIssuer() {
  return {
    issuer: 'https://id.vk.com',
    authorization_endpoint: 'https://id.vk.com/authorize',
    token_endpoint: 'https://oauth.vk.com/access_token',
    userinfo_endpoint: 'https://id.vk.com/oauth2/user_info',
    jwks_uri: 'https://id.vk.com/.well-known/jwks.json'
  };
}

async function fetchVKUserInfo(accessToken, userId) {
  try {
    const params = new URLSearchParams({
      user_ids: userId,
      fields: 'photo_200,photo_max,screen_name,is_verified',
      access_token: accessToken,
      v: '5.131',
      lang: 'ru'
    });
    
    const response = await fetch(`https://api.vk.com/method/users.get?${params}`);
    const data = await response.json();
    return data.response?.[0] || null;
  } catch (e) {
    return null;
  }
}

function normalizeProfile(idTokenClaims, userinfo, vkUsersGet, tokenData) {
  const firstName = vkUsersGet?.first_name || '';
  const lastName = vkUsersGet?.last_name || '';
  const vkName = `${firstName} ${lastName}`.trim() || null;
  
  return {
    provider: 'vkid',
    sub: String(idTokenClaims?.sub || userinfo?.sub || vkUsersGet?.id || ''),
    email: idTokenClaims?.email || userinfo?.email,
    phone_number: idTokenClaims?.phone_number || userinfo?.phone_number,
    name: idTokenClaims?.name || userinfo?.name || vkName,
    picture: idTokenClaims?.picture || userinfo?.picture || vkUsersGet?.photo_max || vkUsersGet?.photo_200,
    is_verified: vkUsersGet?.is_verified === true || vkUsersGet?.is_verified === 1,
    raw: {
      id_token_claims: idTokenClaims,
      userinfo: userinfo,
      users_get: vkUsersGet,
      token_info: {
        has_access_token: !!tokenData.access_token,
        has_refresh_token: !!tokenData.refresh_token,
        token_type: tokenData.token_type,
        expires_in: tokenData.expires_in,
        scope: tokenData.scope
      }
    }
  };
}

function decodeIdTokenSimple(idToken) {
  try {
    const parts = idToken.split('.');
    if (parts.length !== 3) return {};
    
    const payload = parts[1];
    const decoded = Buffer.from(payload, 'base64url').toString('utf-8');
    return JSON.parse(decoded);
  } catch (e) {
    return {};
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

async function upsertVKUser(profile) {
  const client = new Client({ connectionString: DATABASE_URL });
  
  try {
    await client.connect();
    
    const vkSub = profile.sub;
    if (!vkSub) {
      throw new Error('VK sub is required');
    }
    
    const existingResult = await client.query(
      `SELECT user_id FROM vk_users WHERE vk_sub = ${escapeSQL(vkSub)}`
    );
    
    const rawProfileJson = JSON.stringify(profile.raw);
    
    if (existingResult.rows.length > 0) {
      const userId = existingResult.rows[0].user_id;
      await client.query(
        `UPDATE vk_users 
         SET email = ${escapeSQL(profile.email)}, 
             phone_number = ${escapeSQL(profile.phone_number)}, 
             full_name = ${escapeSQL(profile.name)}, 
             avatar_url = ${escapeSQL(profile.picture)}, 
             is_verified = ${escapeSQL(profile.is_verified)}, 
             raw_profile = ${escapeSQL(rawProfileJson)}, 
             last_login = CURRENT_TIMESTAMP
         WHERE user_id = ${escapeSQL(userId)}`
      );
      return userId;
    } else {
      const insertResult = await client.query(
        `INSERT INTO vk_users 
         (vk_sub, email, phone_number, full_name, avatar_url, is_verified, raw_profile)
         VALUES (${escapeSQL(vkSub)}, ${escapeSQL(profile.email)}, ${escapeSQL(profile.phone_number)}, 
                 ${escapeSQL(profile.name)}, ${escapeSQL(profile.picture)}, ${escapeSQL(profile.is_verified)}, 
                 ${escapeSQL(rawProfileJson)})
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
    
    if (httpMethod === 'GET' && !code) {
      const oidcConfig = await discoverVKIssuer();
      const authEndpoint = oidcConfig.authorization_endpoint;
      
      if (!authEndpoint) {
        return {
          statusCode: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ error: 'VK authorization endpoint not found' }),
          isBase64Encoded: false
        };
      }
      
      const state = generateState();
      const nonce = generateNonce();
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = generateCodeChallenge(codeVerifier);
      
      await saveSession(state, nonce, codeVerifier);
      
      const authParams = new URLSearchParams({
        client_id: VK_CLIENT_ID,
        redirect_uri: `${BASE_URL}/vk-callback.html`,
        response_type: 'code',
        scope: 'email phone',
        state,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256'
      });
      
      const authUrl = `${authEndpoint}?${authParams}`;
      
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
    
    if (httpMethod === 'GET' && code) {
      const state = queryStringParameters.state;
      
      const sessionData = await getSession(state);
      
      if (!sessionData) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ error: 'Invalid or expired state' }),
          isBase64Encoded: false
        };
      }
      
      await deleteSession(state);
      
      const oidcConfig = await discoverVKIssuer();
      const tokenEndpoint = oidcConfig.token_endpoint;
      const userinfoEndpoint = oidcConfig.userinfo_endpoint;
      
      const tokenParams = new URLSearchParams({
        client_id: VK_CLIENT_ID,
        client_secret: VK_CLIENT_SECRET,
        code,
        redirect_uri: `${BASE_URL}/vk-callback.html`,
        grant_type: 'authorization_code',
        code_verifier: sessionData.code_verifier
      });
      
      console.log('=== VK TOKEN EXCHANGE START ===');
      console.log('Token endpoint:', tokenEndpoint);
      console.log('Request params:', {
        client_id: VK_CLIENT_ID,
        redirect_uri: `${BASE_URL}/vk-callback.html`,
        grant_type: 'authorization_code',
        code_length: code.length
      });
      
      const tokenResponse = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: tokenParams
      });
      
      console.log('VK response status:', tokenResponse.status);
      console.log('VK response headers:', JSON.stringify(Object.fromEntries(tokenResponse.headers.entries())));
      
      const responseText = await tokenResponse.text();
      console.log('VK response body (raw):', responseText);
      
      let tokenData;
      try {
        tokenData = JSON.parse(responseText);
      } catch (e) {
        console.error('Failed to parse VK response as JSON:', e);
        return {
          statusCode: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ 
            error: 'Invalid VK response', 
            raw: responseText
          }),
          isBase64Encoded: false
        };
      }
      
      console.log('VK token data (parsed):', JSON.stringify(tokenData));
      console.log('=== VK TOKEN EXCHANGE END ===');
      
      if (tokenData.error) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ 
            error: 'Token exchange failed', 
            vk_error: tokenData.error,
            vk_error_description: tokenData.error_description,
            endpoint: tokenEndpoint,
            status: tokenResponse.status
          }),
          isBase64Encoded: false
        };
      }
      
      const accessToken = tokenData.access_token;
      const idToken = tokenData.id_token || '';
      
      const idTokenClaims = decodeIdTokenSimple(idToken);
      
      let userinfo = {};
      if (accessToken && userinfoEndpoint) {
        try {
          const userinfoResponse = await fetch(userinfoEndpoint, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
          });
          if (userinfoResponse.ok) {
            userinfo = await userinfoResponse.json();
          }
        } catch (e) {
          // Ignore
        }
      }
      
      let vkUsersGet = null;
      if (accessToken && (idTokenClaims.sub || userinfo.sub)) {
        const userId = String(idTokenClaims.sub || userinfo.sub);
        vkUsersGet = await fetchVKUserInfo(accessToken, userId);
      }
      
      const profile = normalizeProfile(idTokenClaims, userinfo, vkUsersGet, tokenData);
      
      let userId = null;
      try {
        userId = await upsertVKUser(profile);
      } catch (dbError) {
        console.error('DB upsert error:', dbError);
      }
      
      const sessionId = crypto.randomBytes(32).toString('base64url');
      const userData = {
        user_id: userId,
        vk_id: profile.sub,
        email: profile.email,
        name: profile.name,
        avatar: profile.picture,
        is_verified: profile.is_verified,
        phone: profile.phone_number,
        session_id: sessionId
      };
      
      const redirectHTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>VK Authorization</title>
</head>
<body>
  <script>
    localStorage.setItem('vk_user', JSON.stringify(${JSON.stringify(userData)}));
    localStorage.setItem('auth_token', '${sessionId}');
    window.location.href = '${BASE_URL}';
  </script>
  <p>Перенаправление...</p>
</body>
</html>`;
      
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
        body: redirectHTML,
        isBase64Encoded: false
      };
    }
    
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Method not allowed' }),
      isBase64Encoded: false
    };
    
  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ 
        error: 'Authentication failed', 
        message: error.message 
      }),
      isBase64Encoded: false
    };
  }
};