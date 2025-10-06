-- Add session_token to prompts table for anonymous user tracking
ALTER TABLE prompts ADD COLUMN session_token VARCHAR(255);

-- Add index for session_token
CREATE INDEX idx_prompts_session_token ON prompts(session_token);

-- Update existing prompts to have session tokens if they don't have user_id
-- This is for historical data - new prompts will have session_token set during creation