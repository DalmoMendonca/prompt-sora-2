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
    const { userId, tier } = JSON.parse(event.body);

    if (!userId || !tier) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'User ID and tier required' })
      };
    }

    // Verify user exists
    const userResult = await pool.query(
      'SELECT email, name FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'User not found' })
      };
    }

    const user = userResult.rows[0];

    // Define pricing
    const prices = {
      premium: {
        amount: 300, // $3.00 in cents
        name: 'Premium Plan',
        description: '30 credits per day + use your own API key'
      },
      pro: {
        amount: 1000, // $10.00 in cents
        name: 'Pro Plan', 
        description: '200 credits per day + unlimited API key usage'
      }
    };

    if (!prices[tier]) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid tier' })
      };
    }

    const price = prices[tier];

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      customer_email: user.email,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: price.name,
              description: price.description,
            },
            unit_amount: price.amount,
            recurring: {
              interval: 'month',
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        userId: userId,
        tier: tier,
        userEmail: user.email
      },
      success_url: `${process.env.URL}/profile.html?upgrade=success&tier=${tier}`,
      cancel_url: `${process.env.URL}/profile.html?upgrade=cancelled`,
      allow_promotion_codes: true,
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId: session.id,
        url: session.url
      })
    };

  } catch (error) {
    console.error('Create checkout session error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to create checkout session' })
    };
  }
};