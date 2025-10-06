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

    const results = [];

    // Create users table
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          email VARCHAR(255) UNIQUE NOT NULL,
          name VARCHAR(255) NOT NULL,
          avatar_url TEXT,
          google_id VARCHAR(255) UNIQUE NOT NULL,
          account_tier VARCHAR(20) DEFAULT 'free' CHECK (account_tier IN ('free', 'premium', 'pro')),
          daily_credits_used INTEGER DEFAULT 0,
          credits_reset_date DATE DEFAULT CURRENT_DATE,
          openai_api_key TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);
      results.push('Users table created/verified');
    } catch (error) {
      results.push('Users table error: ' + error.message);
    }

    // Create prompts table
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS prompts (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          session_token VARCHAR(255),
          seed_idea TEXT NOT NULL,
          axis_a_id VARCHAR(50) NOT NULL,
          axis_b_id VARCHAR(50) NOT NULL,
          axis_a_name VARCHAR(100) NOT NULL,
          axis_b_name VARCHAR(100) NOT NULL,
          generated_prompts JSONB NOT NULL,
          credits_used INTEGER DEFAULT 1,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);
      results.push('Prompts table created/verified');
    } catch (error) {
      results.push('Prompts table error: ' + error.message);
    }

    // Create anonymous_sessions table
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS anonymous_sessions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          session_token VARCHAR(255) UNIQUE NOT NULL,
          credits_used INTEGER DEFAULT 0,
          ip_address INET,
          user_agent TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '24 hours'
        );
      `);
      results.push('Anonymous sessions table created/verified');
    } catch (error) {
      results.push('Anonymous sessions table error: ' + error.message);
    }

    // Create subscriptions table
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS subscriptions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
          stripe_subscription_id VARCHAR(255) UNIQUE,
          stripe_customer_id VARCHAR(255),
          tier VARCHAR(20) NOT NULL CHECK (tier IN ('premium', 'pro')),
          status VARCHAR(50) DEFAULT 'active',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);
      results.push('Subscriptions table created/verified');
    } catch (error) {
      results.push('Subscriptions table error: ' + error.message);
    }

    // Create indexes
    try {
      await pool.query('CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_prompts_user_id ON prompts(user_id);');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_prompts_session_token ON prompts(session_token);');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_prompts_created_at ON prompts(created_at DESC);');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_anonymous_sessions_token ON anonymous_sessions(session_token);');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_anonymous_sessions_expires ON anonymous_sessions(expires_at);');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);');
      results.push('Indexes created/verified');
    } catch (error) {
      results.push('Indexes error: ' + error.message);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        success: true, 
        message: 'Database setup completed',
        details: results
      })
    };

  } catch (error) {
    console.error('Database setup error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Database setup failed: ' + error.message })
    };
  }
};