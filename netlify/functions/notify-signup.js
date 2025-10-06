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
    const { email } = JSON.parse(event.body);

    if (!email || !email.includes('@')) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Valid email required' })
      };
    }

    // Create notifications table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS upgrade_notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Insert email (ignore if already exists)
    await pool.query(
      'INSERT INTO upgrade_notifications (email) VALUES ($1) ON CONFLICT (email) DO NOTHING',
      [email.toLowerCase().trim()]
    );

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: true,
        message: 'You will be notified when premium tiers launch!'
      })
    };

  } catch (error) {
    console.error('Notify signup error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to sign up for notifications' })
    };
  }
};