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
    const { sessionToken } = JSON.parse(event.body);

    if (!sessionToken) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing session token' })
      };
    }

    // For now, allow access with any session token - will be secured by frontend auth check
    // TODO: Implement proper admin verification once user is in database

    // Check if session_token column already exists
    const columnCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'prompts' AND column_name = 'session_token'
    `);

    if (columnCheck.rows.length === 0) {
      // Add session_token column
      await pool.query('ALTER TABLE prompts ADD COLUMN session_token VARCHAR(255)');
      
      // Add index
      await pool.query('CREATE INDEX idx_prompts_session_token ON prompts(session_token)');
      
      return {
        statusCode: 200,
        body: JSON.stringify({ 
          success: true, 
          message: 'Migration completed: Added session_token column to prompts table' 
        })
      };
    } else {
      return {
        statusCode: 200,
        body: JSON.stringify({ 
          success: true, 
          message: 'Migration already applied: session_token column exists' 
        })
      };
    }

  } catch (error) {
    console.error('Migration error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Migration failed: ' + error.message })
    };
  }
};