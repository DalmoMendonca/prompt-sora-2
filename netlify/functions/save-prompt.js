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
    const { 
      userId, 
      sessionToken,
      seedIdea, 
      axisAId, 
      axisBId, 
      axisAName, 
      axisBName, 
      generatedPrompts 
    } = JSON.parse(event.body);

    if (!seedIdea || !generatedPrompts || (!userId && !sessionToken)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields' })
      };
    }

    // Save prompt to database
    const result = await pool.query(
      `INSERT INTO prompts 
       (user_id, session_token, seed_idea, axis_a_id, axis_b_id, axis_a_name, axis_b_name, generated_prompts)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [userId || null, sessionToken, seedIdea, axisAId, axisBId, axisAName, axisBName, JSON.stringify(generatedPrompts)]
    );

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: true,
        promptId: result.rows[0].id
      })
    };

  } catch (error) {
    console.error('Save prompt error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to save prompt' })
    };
  }
};