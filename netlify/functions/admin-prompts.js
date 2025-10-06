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
          dateFilter = 'DATE(p.created_at) = CURRENT_DATE';
          break;
        case 'week':
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          dateFilter = `p.created_at >= $${++paramCount}`;
          queryParams.push(weekAgo.toISOString());
          break;
        case 'month':
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          dateFilter = `p.created_at >= $${++paramCount}`;
          queryParams.push(monthAgo.toISOString());
          break;
      }
      
      if (dateFilter) {
        whereClause += ` AND ${dateFilter}`;
      }
    }

    // User type filter
    if (filters.userType && filters.userType !== 'all') {
      if (filters.userType === 'registered') {
        whereClause += ` AND p.user_id IS NOT NULL`;
      } else if (filters.userType === 'anonymous') {
        whereClause += ` AND p.user_id IS NULL`;
      }
    }

    // Email search (only for registered users)
    if (filters.email) {
      whereClause += ` AND u.email ILIKE $${++paramCount}`;
      queryParams.push(`%${filters.email}%`);
    }

    let totalCount = 0;
    let prompts = [];

    try {
      // Check if prompts table exists
      const tableCheck = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'prompts'
        );
      `);

      if (!tableCheck.rows[0].exists) {
        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompts: [],
            totalCount: 0,
            page,
            pageSize,
            totalPages: 0,
            message: 'Prompts table not found. Please run database setup first.'
          })
        };
      }

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as count
        FROM prompts p
        LEFT JOIN users u ON p.user_id = u.id
        ${whereClause}
      `;
      
      const countResult = await pool.query(countQuery, queryParams);
      totalCount = parseInt(countResult.rows[0].count);

      // Get prompts with pagination
      const offset = (page - 1) * pageSize;
      const promptsQuery = `
        SELECT 
          p.id,
          p.seed_idea,
          p.axis_a_name,
          p.axis_b_name,
          p.credits_used,
          p.created_at,
          u.email as user_email,
          u.name as user_name,
          CASE 
            WHEN p.user_id IS NULL THEN p.session_token
            ELSE NULL
          END as session_token
        FROM prompts p
        LEFT JOIN users u ON p.user_id = u.id
        ${whereClause}
        ORDER BY p.created_at DESC
        LIMIT $${++paramCount} OFFSET $${++paramCount}
      `;
      
      queryParams.push(pageSize, offset);
      const promptsResult = await pool.query(promptsQuery, queryParams);
      prompts = promptsResult.rows;

    } catch (error) {
      console.error('Prompts query error:', error);
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompts: [],
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
        prompts,
        totalCount,
        page,
        pageSize,
        totalPages: Math.ceil(totalCount / pageSize)
      })
    };

  } catch (error) {
    console.error('Admin prompts error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};