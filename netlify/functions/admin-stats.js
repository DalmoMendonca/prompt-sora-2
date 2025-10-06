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
    const { sessionToken, filters } = JSON.parse(event.body);

    if (!sessionToken) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing session token' })
      };
    }

    // For now, allow access with any session token - will be secured by frontend auth check
    // TODO: Implement proper admin verification once user is in database

    // Build date filter
    let dateFilter = '';
    const now = new Date();
    
    switch (filters?.dateRange) {
      case 'today':
        dateFilter = `AND DATE(created_at) = CURRENT_DATE`;
        break;
      case 'week':
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        dateFilter = `AND created_at >= '${weekAgo.toISOString()}'`;
        break;
      case 'month':
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        dateFilter = `AND created_at >= '${monthAgo.toISOString()}'`;
        break;
      default:
        dateFilter = '';
    }

    // Initialize stats with default values
    let stats = {
      totalUsers: 0,
      totalPrompts: 0,
      creditsToday: 0,
      activeSubscriptions: 0,
      anonymousSessions: 0,
      estimatedRevenue: 0
    };

    try {
      // Check if tables exist and get counts safely
      
      // Get total users
      try {
        const totalUsersResult = await pool.query(`
          SELECT COUNT(*) as count FROM users 
          WHERE 1=1 ${dateFilter}
        `);
        stats.totalUsers = parseInt(totalUsersResult.rows[0].count);
      } catch (error) {
        console.log('Users table not found or error:', error.message);
      }

      // Get total prompts
      try {
        const totalPromptsResult = await pool.query(`
          SELECT COUNT(*) as count FROM prompts 
          WHERE 1=1 ${dateFilter}
        `);
        stats.totalPrompts = parseInt(totalPromptsResult.rows[0].count);
      } catch (error) {
        console.log('Prompts table not found or error:', error.message);
      }

      // Get credits used today
      try {
        const creditsToday = await pool.query(`
          SELECT 
            COALESCE(SUM(daily_credits_used), 0) as total
          FROM users
          WHERE credits_reset_date = CURRENT_DATE
        `);
        stats.creditsToday = parseInt(creditsToday.rows[0].total) || 0;
      } catch (error) {
        console.log('Credits query error:', error.message);
      }

      // Get active subscriptions
      try {
        const activeSubscriptionsResult = await pool.query(`
          SELECT COUNT(*) as count FROM subscriptions 
          WHERE status = 'active'
        `);
        stats.activeSubscriptions = parseInt(activeSubscriptionsResult.rows[0].count);
      } catch (error) {
        console.log('Subscriptions table not found or error:', error.message);
      }

      // Get anonymous sessions
      try {
        const anonymousSessionsResult = await pool.query(`
          SELECT COUNT(*) as count FROM anonymous_sessions 
          WHERE expires_at > NOW() ${dateFilter}
        `);
        stats.anonymousSessions = parseInt(anonymousSessionsResult.rows[0].count);
      } catch (error) {
        console.log('Anonymous sessions table not found or error:', error.message);
      }

      // Calculate estimated revenue
      try {
        const revenueResult = await pool.query(`
          SELECT 
            COUNT(CASE WHEN tier = 'premium' THEN 1 END) * 3 +
            COUNT(CASE WHEN tier = 'pro' THEN 1 END) * 10 as revenue
          FROM subscriptions 
          WHERE status = 'active'
        `);
        stats.estimatedRevenue = parseInt(revenueResult.rows[0].revenue) || 0;
      } catch (error) {
        console.log('Revenue calculation error:', error.message);
      }

    } catch (error) {
      console.log('General stats error:', error.message);
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(stats)
    };

  } catch (error) {
    console.error('Admin stats error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};