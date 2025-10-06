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
    const { sessionToken, promptId } = JSON.parse(event.body);

    if (!sessionToken || !promptId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields' })
      };
    }

    // For now, allow access with any session token - will be secured by frontend auth check
    // TODO: Implement proper admin verification once user is in database

    // Get prompt details
    const promptQuery = `
      SELECT 
        p.*,
        u.email as user_email,
        u.name as user_name
      FROM prompts p
      LEFT JOIN users u ON p.user_id = u.id
      WHERE p.id = $1
    `;
    
    const promptResult = await pool.query(promptQuery, [promptId]);

    if (promptResult.rows.length === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Prompt not found' })
      };
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(promptResult.rows[0])
    };

  } catch (error) {
    console.error('Admin prompt details error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};