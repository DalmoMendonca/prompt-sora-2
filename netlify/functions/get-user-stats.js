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
    const { userId } = JSON.parse(event.body);

    if (!userId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'User ID required' })
      };
    }

    // Get total prompts count
    const promptsResult = await pool.query(
      'SELECT COUNT(*) as total FROM prompts WHERE user_id = $1',
      [userId]
    );

    // Get days active (days since account creation)
    const userResult = await pool.query(
      'SELECT created_at FROM users WHERE id = $1',
      [userId]
    );

    const totalPrompts = parseInt(promptsResult.rows[0].total);
    const createdAt = new Date(userResult.rows[0].created_at);
    const now = new Date();
    const daysActive = Math.ceil((now - createdAt) / (1000 * 60 * 60 * 24));

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        totalPrompts,
        daysActive: Math.max(1, daysActive) // At least 1 day
      })
    };

  } catch (error) {
    console.error('Get user stats error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to get user stats' })
    };
  }
};