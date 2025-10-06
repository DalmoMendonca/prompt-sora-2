const { Pool } = require('pg');

// Load environment variables in development
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

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
    const { sessionToken, userId } = JSON.parse(event.body);

    if (userId) {
      // Logged in user
      const userResult = await pool.query(
        'SELECT account_tier, daily_credits_used, credits_reset_date FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0) {
        return {
          statusCode: 404,
          body: JSON.stringify({ error: 'User not found' })
        };
      }

      let user = userResult.rows[0];

      // Reset credits if it's a new day
      const today = new Date().toISOString().split('T')[0];
      const resetDate = user.credits_reset_date instanceof Date ? 
        user.credits_reset_date.toISOString().split('T')[0] : 
        user.credits_reset_date;
      
      if (resetDate !== today) {
        await pool.query(
          'UPDATE users SET daily_credits_used = 0, credits_reset_date = $1 WHERE id = $2',
          [today, userId]
        );
        user.daily_credits_used = 0;
      }

      const creditLimits = {
        free: 5,
        premium: 30,
        pro: 200
      };

      const limit = creditLimits[user.account_tier] || 0;
      const remaining = Math.max(0, limit - user.daily_credits_used);

      return {
        statusCode: 200,
        body: JSON.stringify({
          used: user.daily_credits_used,
          limit: limit,
          remaining: remaining,
          tier: user.account_tier,
          canUse: remaining > 0
        })
      };

    } else {
      // Anonymous user
      const sessionResult = await pool.query(
        'SELECT credits_used, expires_at FROM anonymous_sessions WHERE session_token = $1',
        [sessionToken]
      );

      let creditsUsed = 0;
      
      if (sessionResult.rows.length > 0) {
        const session = sessionResult.rows[0];
        // Check if session expired
        if (new Date(session.expires_at) < new Date()) {
          // Reset expired session
          await pool.query(
            'UPDATE anonymous_sessions SET credits_used = 0, expires_at = $1 WHERE session_token = $2',
            [new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), sessionToken]
          );
        } else {
          creditsUsed = session.credits_used;
        }
      } else {
        // Create new anonymous session
        await pool.query(
          'INSERT INTO anonymous_sessions (session_token, credits_used, ip_address, user_agent) VALUES ($1, 0, $2, $3)',
          [sessionToken, event.headers['x-forwarded-for'] || event.headers['x-real-ip'], event.headers['user-agent']]
        );
      }

      const limit = 3; // Anonymous users get 3 credits
      const remaining = Math.max(0, limit - creditsUsed);

      return {
        statusCode: 200,
        body: JSON.stringify({
          used: creditsUsed,
          limit: limit,
          remaining: remaining,
          tier: 'anonymous',
          canUse: remaining > 0
        })
      };
    }

  } catch (error) {
    console.error('Check credits error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to check credits' })
    };
  }
};