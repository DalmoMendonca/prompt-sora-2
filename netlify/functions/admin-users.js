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
    const { sessionToken, page = 1, pageSize = 50, filters = {} } = JSON.parse(event.body);

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

    // Build filters
    let whereClause = 'WHERE 1=1';
    const queryParams = [];
    let paramCount = 0;

    // Date filter
    if (filters.dateRange && filters.dateRange !== 'all') {
      const now = new Date();
      let dateFilter;
      
      switch (filters.dateRange) {
        case 'today':
          dateFilter = 'DATE(u.created_at) = CURRENT_DATE';
          break;
        case 'week':
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          dateFilter = `u.created_at >= $${++paramCount}`;
          queryParams.push(weekAgo.toISOString());
          break;
        case 'month':
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          dateFilter = `u.created_at >= $${++paramCount}`;
          queryParams.push(monthAgo.toISOString());
          break;
      }
      
      if (dateFilter) {
        whereClause += ` AND ${dateFilter}`;
      }
    }

    // Tier filter
    if (filters.tier && filters.tier !== 'all') {
      whereClause += ` AND u.account_tier = $${++paramCount}`;
      queryParams.push(filters.tier);
    }

    // Email search
    if (filters.email) {
      whereClause += ` AND u.email ILIKE $${++paramCount}`;
      queryParams.push(`%${filters.email}%`);
    }

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as count
      FROM users u
      LEFT JOIN subscriptions s ON u.id = s.user_id
      ${whereClause}
    `;
    
    const countResult = await pool.query(countQuery, queryParams);
    const totalCount = parseInt(countResult.rows[0].count);

    // Get users with pagination
    const offset = (page - 1) * pageSize;
    const usersQuery = `
      SELECT 
        u.id,
        u.email,
        u.name,
        u.account_tier,
        u.daily_credits_used,
        u.created_at,
        s.status as subscription_status,
        s.tier as subscription_tier,
        (SELECT MAX(created_at) FROM prompts WHERE user_id = u.id) as last_prompt
      FROM users u
      LEFT JOIN subscriptions s ON u.id = s.user_id
      ${whereClause}
      ORDER BY u.created_at DESC
      LIMIT $${++paramCount} OFFSET $${++paramCount}
    `;
    
    queryParams.push(pageSize, offset);
    const usersResult = await pool.query(usersQuery, queryParams);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        users: usersResult.rows,
        totalCount,
        page,
        pageSize,
        totalPages: Math.ceil(totalCount / pageSize)
      })
    };

  } catch (error) {
    console.error('Admin users error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};