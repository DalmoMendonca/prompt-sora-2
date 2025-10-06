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

    // Verify admin access
    const adminCheck = await pool.query(
      'SELECT email FROM users WHERE id = (SELECT id FROM users WHERE email = $1)',
      ['dalmomendonca@gmail.com']
    );

    if (adminCheck.rows.length === 0) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Access denied' })
      };
    }

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