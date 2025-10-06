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
          dateFilter = 'DATE(created_at) = CURRENT_DATE';
          break;
        case 'week':
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          dateFilter = `created_at >= $${++paramCount}`;
          queryParams.push(weekAgo.toISOString());
          break;
        case 'month':
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          dateFilter = `created_at >= $${++paramCount}`;
          queryParams.push(monthAgo.toISOString());
          break;
      }
      
      if (dateFilter) {
        whereClause += ` AND ${dateFilter}`;
      }
    }

    let totalCount = 0;
    let sessions = [];

    try {
      // Check if anonymous_sessions table exists
      const tableCheck = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'anonymous_sessions'
        );
      `);

      if (!tableCheck.rows[0].exists) {
        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sessions: [],
            totalCount: 0,
            page,
            pageSize,
            totalPages: 0,
            message: 'Anonymous sessions table not found. Please run database setup first.'
          })
        };
      }

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as count
        FROM anonymous_sessions
        ${whereClause}
      `;
      
      const countResult = await pool.query(countQuery, queryParams);
      totalCount = parseInt(countResult.rows[0].count);

      // Get sessions with pagination
      const offset = (page - 1) * pageSize;
      const sessionsQuery = `
        SELECT 
          session_token,
          credits_used,
          ip_address,
          user_agent,
          created_at,
          expires_at
        FROM anonymous_sessions
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${++paramCount} OFFSET $${++paramCount}
      `;
      
      queryParams.push(pageSize, offset);
      const sessionsResult = await pool.query(sessionsQuery, queryParams);
      sessions = sessionsResult.rows;

    } catch (error) {
      console.error('Anonymous sessions query error:', error);
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessions: [],
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
        sessions,
        totalCount,
        page,
        pageSize,
        totalPages: Math.ceil(totalCount / pageSize)
      })
    };

  } catch (error) {
    console.error('Admin anonymous sessions error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};