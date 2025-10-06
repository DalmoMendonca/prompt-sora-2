const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
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
    const { userId } = JSON.parse(event.body);

    if (!userId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'User ID required' })
      };
    }

    // Get user's Stripe customer ID
    const subscriptionResult = await pool.query(
      'SELECT stripe_customer_id FROM subscriptions WHERE user_id = $1',
      [userId]
    );

    if (subscriptionResult.rows.length === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'No subscription found' })
      };
    }

    const customerId = subscriptionResult.rows[0].stripe_customer_id;

    // Create customer portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${process.env.URL}/profile.html`,
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: session.url
      })
    };

  } catch (error) {
    console.error('Create customer portal error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to create customer portal session' })
    };
  }
};