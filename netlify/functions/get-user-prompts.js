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

    // Get user's prompts, ordered by creation date (newest first)
    const promptsResult = await pool.query(
      `SELECT id, seed_idea, axis_a_id, axis_b_id, axis_a_name, axis_b_name, 
              generated_prompts, created_at 
       FROM prompts 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT 50`,
      [userId]
    );

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompts: promptsResult.rows
      })
    };

  } catch (error) {
    console.error('Get user prompts error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to get user prompts' })
    };
  }
};