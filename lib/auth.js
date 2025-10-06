// Authentication utilities
export class AuthManager {
  constructor() {
    this.user = null;
    this.sessionToken = null;
    this.init();
  }

  init() {
    // Check for existing session
    const userData = localStorage.getItem('sora2_user');
    const sessionToken = localStorage.getItem('sora2_session');
    
    if (userData) {
      this.user = JSON.parse(userData);
    }
    
    if (sessionToken) {
      this.sessionToken = sessionToken;
    } else {
      // Generate anonymous session token
      this.sessionToken = this.generateSessionToken();
      localStorage.setItem('sora2_session', this.sessionToken);
    }
  }

  generateSessionToken() {
    return 'anon_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  async signInWithGoogle() {
    try {
      // Get client ID from environment
      const response = await fetch('/.netlify/functions/get-config');
      const config = await response.json();
      
      const redirectUri = encodeURIComponent(window.location.origin + '/auth/callback');
      const scope = encodeURIComponent('openid email profile');
      
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${config.googleClientId}&` +
        `redirect_uri=${redirectUri}&` +
        `response_type=code&` +
        `scope=${scope}&` +
        `access_type=offline&` +
        `prompt=consent`;
      
      window.location.href = authUrl;
    } catch (error) {
      console.error('Sign in error:', error);
      throw error;
    }
  }

  async handleAuthCallback(code) {
    try {
      const response = await fetch('/.netlify/functions/auth-callback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code })
      });

      if (!response.ok) {
        throw new Error('Authentication failed');
      }

      const { user, token } = await response.json();
      
      this.user = user;
      this.sessionToken = token;
      
      localStorage.setItem('sora2_user', JSON.stringify(user));
      localStorage.setItem('sora2_session', token);
      
      return user;
    } catch (error) {
      console.error('Auth callback error:', error);
      throw error;
    }
  }

  signOut() {
    this.user = null;
    localStorage.removeItem('sora2_user');
    
    // Keep anonymous session for credits
    this.sessionToken = this.generateSessionToken();
    localStorage.setItem('sora2_session', this.sessionToken);
    
    window.location.reload();
  }

  isSignedIn() {
    return !!this.user;
  }

  getUser() {
    return this.user;
  }

  getSessionToken() {
    return this.sessionToken;
  }

  async checkCredits() {
    try {
      const response = await fetch('/.netlify/functions/check-credits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
        },
        body: JSON.stringify({ 
          sessionToken: this.sessionToken,
          userId: this.user?.id,
          timestamp: Date.now() // Force cache bust
        })
      });

      if (!response.ok) {
        throw new Error('Failed to check credits');
      }

      return await response.json();
    } catch (error) {
      console.error('Credit check error:', error);
      throw error;
    }
  }

  async useCredit() {
    try {
      const response = await fetch('/.netlify/functions/use-credit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          sessionToken: this.sessionToken,
          userId: this.user?.id 
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to use credit');
      }

      return await response.json();
    } catch (error) {
      console.error('Use credit error:', error);
      throw error;
    }
  }
}

// Global auth instance
export const auth = new AuthManager();