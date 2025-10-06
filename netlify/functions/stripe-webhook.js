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

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  const sig = event.headers['stripe-signature'];
  let stripeEvent;

  try {
    stripeEvent = stripe.webhooks.constructEvent(event.body, sig, endpointSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Webhook signature verification failed' })
    };
  }

  try {
    switch (stripeEvent.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(stripeEvent.data.object);
        break;
      
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(stripeEvent.data.object);
        break;
      
      case 'customer.subscription.deleted':
        await handleSubscriptionCancelled(stripeEvent.data.object);
        break;
      
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(stripeEvent.data.object);
        break;
      
      case 'invoice.payment_failed':
        await handlePaymentFailed(stripeEvent.data.object);
        break;
      
      default:
        console.log(`Unhandled event type: ${stripeEvent.type}`);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ received: true })
    };

  } catch (error) {
    console.error('Webhook handler error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Webhook handler failed' })
    };
  }
};

async function handleCheckoutCompleted(session) {
  const { userId, tier } = session.metadata;
  
  if (!userId || !tier) {
    console.error('Missing metadata in checkout session:', session.id);
    return;
  }

  // Update user's account tier
  await pool.query(
    'UPDATE users SET account_tier = $1, updated_at = NOW() WHERE id = $2',
    [tier, userId]
  );

  // Create subscription record
  await pool.query(
    `INSERT INTO subscriptions (user_id, stripe_subscription_id, stripe_customer_id, tier, status)
     VALUES ($1, $2, $3, $4, 'active')
     ON CONFLICT (user_id) DO UPDATE SET
       stripe_subscription_id = $2,
       stripe_customer_id = $3,
       tier = $4,
       status = 'active',
       updated_at = NOW()`,
    [userId, session.subscription, session.customer, tier]
  );

  console.log(`User ${userId} upgraded to ${tier}`);
}

async function handleSubscriptionUpdated(subscription) {
  // Update subscription status
  await pool.query(
    'UPDATE subscriptions SET status = $1, updated_at = NOW() WHERE stripe_subscription_id = $2',
    [subscription.status, subscription.id]
  );

  // If subscription is cancelled or past_due, downgrade user
  if (['canceled', 'past_due', 'unpaid'].includes(subscription.status)) {
    await pool.query(
      `UPDATE users SET account_tier = 'free', updated_at = NOW() 
       WHERE id = (SELECT user_id FROM subscriptions WHERE stripe_subscription_id = $1)`,
      [subscription.id]
    );
  }
}

async function handleSubscriptionCancelled(subscription) {
  // Downgrade user to free tier
  await pool.query(
    `UPDATE users SET account_tier = 'free', updated_at = NOW() 
     WHERE id = (SELECT user_id FROM subscriptions WHERE stripe_subscription_id = $1)`,
    [subscription.id]
  );

  // Update subscription status
  await pool.query(
    'UPDATE subscriptions SET status = $1, updated_at = NOW() WHERE stripe_subscription_id = $2',
    ['canceled', subscription.id]
  );

  console.log(`Subscription ${subscription.id} cancelled`);
}

async function handlePaymentSucceeded(invoice) {
  // Reset daily credits on successful payment
  const subscriptionId = invoice.subscription;
  
  await pool.query(
    `UPDATE users SET daily_credits_used = 0, credits_reset_date = CURRENT_DATE, updated_at = NOW()
     WHERE id = (SELECT user_id FROM subscriptions WHERE stripe_subscription_id = $1)`,
    [subscriptionId]
  );

  console.log(`Payment succeeded for subscription ${subscriptionId}`);
}

async function handlePaymentFailed(invoice) {
  console.log(`Payment failed for subscription ${invoice.subscription}`);
  // Could send email notification here
}