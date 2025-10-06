const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

function escapeCSV(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function arrayToCSV(data, headers) {
  const csvHeaders = headers.join(',');
  const csvRows = data.map(row => 
    headers.map(header => escapeCSV(row[header])).join(',')
  );
  return [csvHeaders, ...csvRows].join('\n');
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { sessionToken, type, filters = {} } = JSON.parse(event.body);

    if (!sessionToken || !type) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields' })
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
    const queryParams = [];
    let paramCount = 0;

    if (filters.dateRange && filters.dateRange !== 'all') {
      const now = new Date();
      
      switch (filters.dateRange) {
        case 'today':
          dateFilter = 'AND DATE(created_at) = CURRENT_DATE';
          break;
        case 'week':
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          dateFilter = `AND created_at >= $${++paramCount}`;
          queryParams.push(weekAgo.toISOString());
          break;
        case 'month':
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          dateFilter = `AND created_at >= $${++paramCount}`;
          queryParams.push(monthAgo.toISOString());
          break;
      }
    }

    let query, headers, filename;

    switch (type) {
      case 'users':
        query = `
          SELECT 
            u.email,
            u.name,
            u.account_tier,
            u.daily_credits_used,
            u.created_at,
            s.status as subscription_status,
            s.tier as subscription_tier,
            (SELECT COUNT(*) FROM prompts WHERE user_id = u.id) as total_prompts
          FROM users u
          LEFT JOIN subscriptions s ON u.id = s.user_id
          WHERE 1=1 ${dateFilter}
          ORDER BY u.created_at DESC
        `;
        headers = ['email', 'name', 'account_tier', 'daily_credits_used', 'created_at', 'subscription_status', 'subscription_tier', 'total_prompts'];
        filename = 'users';
        break;

      case 'prompts':
        query = `
          SELECT 
            COALESCE(u.email, 'Anonymous') as user_email,
            p.seed_idea,
            p.axis_a_name,
            p.axis_b_name,
            p.credits_used,
            p.created_at,
            CASE WHEN p.user_id IS NULL THEN p.session_token ELSE NULL END as session_token
          FROM prompts p
          LEFT JOIN users u ON p.user_id = u.id
          WHERE 1=1 ${dateFilter}
          ORDER BY p.created_at DESC
        `;
        headers = ['user_email', 'seed_idea', 'axis_a_name', 'axis_b_name', 'credits_used', 'created_at', 'session_token'];
        filename = 'prompts';
        break;

      case 'anonymous':
        query = `
          SELECT 
            session_token,
            credits_used,
            ip_address,
            user_agent,
            created_at,
            expires_at
          FROM anonymous_sessions
          WHERE 1=1 ${dateFilter}
          ORDER BY created_at DESC
        `;
        headers = ['session_token', 'credits_used', 'ip_address', 'user_agent', 'created_at', 'expires_at'];
        filename = 'anonymous_sessions';
        break;

      default:
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'Invalid export type' })
        };
    }

    const result = await pool.query(query, queryParams);
    const csv = arrayToCSV(result.rows, headers);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}-${new Date().toISOString().split('T')[0]}.csv"`
      },
      body: csv
    };

  } catch (error) {
    console.error('Admin export error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};