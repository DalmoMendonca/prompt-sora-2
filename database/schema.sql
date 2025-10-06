-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  avatar_url TEXT,
  google_id VARCHAR(255) UNIQUE NOT NULL,
  account_tier VARCHAR(20) DEFAULT 'free' CHECK (account_tier IN ('free', 'premium', 'pro')),
  daily_credits_used INTEGER DEFAULT 0,
  credits_reset_date DATE DEFAULT CURRENT_DATE,
  openai_api_key TEXT, -- For premium/pro users
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Prompts table
CREATE TABLE prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  seed_idea TEXT NOT NULL,
  axis_a_id VARCHAR(50) NOT NULL,
  axis_b_id VARCHAR(50) NOT NULL,
  axis_a_name VARCHAR(100) NOT NULL,
  axis_b_name VARCHAR(100) NOT NULL,
  generated_prompts JSONB NOT NULL, -- Store the 2x2 grid
  credits_used INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Anonymous sessions (for non-logged-in users)
CREATE TABLE anonymous_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_token VARCHAR(255) UNIQUE NOT NULL,
  credits_used INTEGER DEFAULT 0,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '24 hours'
);

-- Indexes for performance
CREATE INDEX idx_users_google_id ON users(google_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_prompts_user_id ON prompts(user_id);
CREATE INDEX idx_prompts_created_at ON prompts(created_at DESC);
CREATE INDEX idx_anonymous_sessions_token ON anonymous_sessions(session_token);
CREATE INDEX idx_anonymous_sessions_expires ON anonymous_sessions(expires_at);

-- Function to reset daily credits
CREATE OR REPLACE FUNCTION reset_daily_credits()
RETURNS void AS $$
BEGIN
  UPDATE users 
  SET daily_credits_used = 0, credits_reset_date = CURRENT_DATE
  WHERE credits_reset_date < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

-- Subscriptions table
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  stripe_subscription_id VARCHAR(255) UNIQUE,
  stripe_customer_id VARCHAR(255),
  tier VARCHAR(20) NOT NULL CHECK (tier IN ('premium', 'pro')),
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Upgrade notifications table
CREATE TABLE IF NOT EXISTS upgrade_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for subscriptions
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe_subscription_id ON subscriptions(stripe_subscription_id);
CREATE INDEX idx_subscriptions_stripe_customer_id ON subscriptions(stripe_customer_id);

-- Function to get user credit limits
CREATE OR REPLACE FUNCTION get_credit_limit(tier VARCHAR(20))
RETURNS INTEGER AS $$
BEGIN
  CASE tier
    WHEN 'free' THEN RETURN 5;
    WHEN 'premium' THEN RETURN 30;
    WHEN 'pro' THEN RETURN 200;
    ELSE RETURN 0;
  END CASE;
END;
$$ LANGUAGE plpgsql;