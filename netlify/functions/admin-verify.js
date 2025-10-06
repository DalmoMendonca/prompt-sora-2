const { Pool } = require('pg');

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

    if (!sessionToken || !userId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields' })
      };
    }

    // Get user from database
    const userResult = await pool.query(
      'SELECT email FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'User not found' })
      };
    }

    const user = userResult.rows[0];

    // Check if user is admin
    if (user.email !== 'dalmomendonca@gmail.com') {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Access denied' })
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ authorized: true })
    };

  } catch (error) {
    console.error('Admin verify error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};