const { Pool } = require('pg');

// Load environment variables in development
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { code } = JSON.parse(event.body);

    if (!code) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Authorization code required' })
      };
    }

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: `${process.env.URL}/auth/callback`
      })
    });

    if (!tokenResponse.ok) {
      throw new Error('Failed to exchange code for tokens');
    }

    const tokens = await tokenResponse.json();

    // Get user info from Google using the modern userinfo endpoint
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`
      }
    });

    if (!userResponse.ok) {
      throw new Error('Failed to get user info');
    }

    const googleUser = await userResponse.json();
    
    // Debug: Log what Google returns
    console.log('Google user response:', JSON.stringify(googleUser, null, 2));
    
    // Google userinfo v3 returns 'sub' as the user ID, not 'id'
    const googleId = googleUser.sub || googleUser.id;
    
    if (!googleId) {
      console.error('Google user object:', googleUser);
      throw new Error('No Google user ID found in response');
    }
    
    console.log('Using Google ID:', googleId);

    // Check if user exists in database
    const existingUserResult = await pool.query(
      'SELECT * FROM users WHERE google_id = $1',
      [googleId]
    );

    let user;
    if (existingUserResult.rows.length > 0) {
      // Update existing user
      const updateResult = await pool.query(
        `UPDATE users 
         SET name = $1, email = $2, avatar_url = $3, updated_at = NOW()
         WHERE google_id = $4
         RETURNING *`,
        [googleUser.name, googleUser.email, googleUser.picture, googleId]
      );
      user = updateResult.rows[0];
    } else {
      // Create new user
      const insertResult = await pool.query(
        `INSERT INTO users (email, name, avatar_url, google_id, account_tier)
         VALUES ($1, $2, $3, $4, 'free')
         RETURNING *`,
        [googleUser.email, googleUser.name, googleUser.picture, googleId]
      );
      user = insertResult.rows[0];
    }

    // Generate session token
    const sessionToken = 'user_' + Math.random().toString(36).substring(2) + Date.now().toString(36);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar_url: user.avatar_url,
          account_tier: user.account_tier
        },
        token: sessionToken
      })
    };

  } catch (error) {
    console.error('Auth callback error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Authentication failed' })
    };
  }
};