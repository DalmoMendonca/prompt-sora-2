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
      let creditsUsed = user.daily_credits_used;
      
      const resetDate = user.credits_reset_date instanceof Date ? 
        user.credits_reset_date.toISOString().split('T')[0] : 
        user.credits_reset_date;
      
      if (resetDate !== today) {
        creditsUsed = 0;
        await pool.query(
          'UPDATE users SET daily_credits_used = 0, credits_reset_date = $1 WHERE id = $2',
          [today, userId]
        );
      }

      const creditLimits = {
        free: 5,
        premium: 30,
        pro: 200
      };

      const limit = creditLimits[user.account_tier] || 0;
      
      if (creditsUsed >= limit) {
        return {
          statusCode: 400,
          body: JSON.stringify({ 
            error: 'Daily credit limit reached',
            used: creditsUsed,
            limit: limit
          })
        };
      }

      // Use a credit
      const updateResult = await pool.query(
        'UPDATE users SET daily_credits_used = $1 WHERE id = $2 RETURNING daily_credits_used',
        [creditsUsed + 1, userId]
      );
      const updatedUser = updateResult.rows[0];

      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          used: updatedUser.daily_credits_used,
          remaining: limit - updatedUser.daily_credits_used
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
          creditsUsed = 0;
        } else {
          creditsUsed = session.credits_used;
        }
      }

      const limit = 3; // Anonymous users get 3 credits
      
      if (creditsUsed >= limit) {
        return {
          statusCode: 400,
          body: JSON.stringify({ 
            error: 'Daily credit limit reached. Sign in for more credits!',
            used: creditsUsed,
            limit: limit
          })
        };
      }

      // Use a credit
      if (sessionResult.rows.length > 0) {
        await pool.query(
          'UPDATE anonymous_sessions SET credits_used = $1, expires_at = $2 WHERE session_token = $3',
          [creditsUsed + 1, new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), sessionToken]
        );
      } else {
        await pool.query(
          'INSERT INTO anonymous_sessions (session_token, credits_used, ip_address, user_agent) VALUES ($1, 1, $2, $3)',
          [sessionToken, event.headers['x-forwarded-for'] || event.headers['x-real-ip'], event.headers['user-agent']]
        );
      }

      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          used: creditsUsed + 1,
          remaining: limit - (creditsUsed + 1)
        })
      };
    }

  } catch (error) {
    console.error('Use credit error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to use credit' })
    };
  }
};