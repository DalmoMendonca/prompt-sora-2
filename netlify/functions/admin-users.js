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

    // For now, allow access with any session token - will be secured by frontend auth check
    // TODO: Implement proper admin verification once user is in database

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

    let totalCount = 0;
    let users = [];

    try {
      // Check if users table exists
      const tableCheck = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'users'
        );
      `);

      if (!tableCheck.rows[0].exists) {
        // Users table doesn't exist yet
        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            users: [],
            totalCount: 0,
            page,
            pageSize,
            totalPages: 0,
            message: 'Users table not found. Please run database migration first.'
          })
        };
      }

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as count
        FROM users u
        LEFT JOIN subscriptions s ON u.id = s.user_id
        ${whereClause}
      `;
      
      const countResult = await pool.query(countQuery, queryParams);
      totalCount = parseInt(countResult.rows[0].count);

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
      users = usersResult.rows;

    } catch (error) {
      console.error('Users query error:', error);
      // Return empty result instead of failing
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          users: [],
          totalCount: 0,
          page,
          pageSize,
          totalPages: 0,
          error: 'Database error: ' + error.message
        })
      };
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        users,
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