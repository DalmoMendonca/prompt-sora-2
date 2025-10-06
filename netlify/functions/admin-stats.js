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

    // Get total users
    const totalUsersResult = await pool.query(`
      SELECT COUNT(*) as count FROM users 
      WHERE 1=1 ${dateFilter}
    `);

    // Get total prompts (including anonymous)
    const totalPromptsResult = await pool.query(`
      SELECT COUNT(*) as count FROM prompts 
      WHERE 1=1 ${dateFilter}
    `);

    // Get credits used today
    const creditsToday = await pool.query(`
      SELECT 
        COALESCE(SUM(u.daily_credits_used), 0) + 
        COALESCE(SUM(a.credits_used), 0) as total
      FROM users u
      FULL OUTER JOIN anonymous_sessions a ON 1=1
      WHERE (u.credits_reset_date = CURRENT_DATE OR u.credits_reset_date IS NULL)
        AND (DATE(a.created_at) = CURRENT_DATE OR a.created_at IS NULL)
    `);

    // Get active subscriptions
    const activeSubscriptionsResult = await pool.query(`
      SELECT COUNT(*) as count FROM subscriptions 
      WHERE status = 'active'
    `);

    // Get anonymous sessions
    const anonymousSessionsResult = await pool.query(`
      SELECT COUNT(*) as count FROM anonymous_sessions 
      WHERE expires_at > NOW() ${dateFilter}
    `);

    // Calculate estimated revenue (rough estimate)
    const revenueResult = await pool.query(`
      SELECT 
        COUNT(CASE WHEN tier = 'premium' THEN 1 END) * 3 +
        COUNT(CASE WHEN tier = 'pro' THEN 1 END) * 10 as revenue
      FROM subscriptions 
      WHERE status = 'active'
    `);

    const stats = {
      totalUsers: parseInt(totalUsersResult.rows[0].count),
      totalPrompts: parseInt(totalPromptsResult.rows[0].count),
      creditsToday: parseInt(creditsToday.rows[0].total) || 0,
      activeSubscriptions: parseInt(activeSubscriptionsResult.rows[0].count),
      anonymousSessions: parseInt(anonymousSessionsResult.rows[0].count),
      estimatedRevenue: parseInt(revenueResult.rows[0].revenue) || 0
    };

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