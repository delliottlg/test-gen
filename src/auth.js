const crypto = require('crypto');

class AuthMiddleware {
  constructor(config) {
    this.apiKey = config.apiKey || process.env.API_KEY;
    this.enabled = config.enabled !== false && this.apiKey;
    
    if (this.enabled && !this.apiKey) {
      console.warn('Authentication enabled but no API_KEY environment variable set');
      this.enabled = false;
    }
  }

  // Basic API key authentication
  authenticate() {
    return (req, res, next) => {
      // Skip auth for public endpoints and static assets
      const publicRoutes = ['/', '/health', '/status', '/webhook/test-runner'];
      if (publicRoutes.includes(req.path) || req.path.startsWith('/static/')) {
        return next();
      }

      if (!this.enabled) {
        return next();
      }

      const authHeader = req.headers.authorization;
      
      if (!authHeader) {
        return res.status(401).json({ 
          error: 'Authentication required',
          message: 'Please provide API key in Authorization header'
        });
      }

      // Support both "Bearer <key>" and "ApiKey <key>" formats
      const [type, key] = authHeader.split(' ');
      
      if (!key || (type !== 'Bearer' && type !== 'ApiKey')) {
        return res.status(401).json({ 
          error: 'Invalid authentication format',
          message: 'Use "Bearer <key>" or "ApiKey <key>" format'
        });
      }

      // Constant-time comparison to prevent timing attacks
      if (!this.constantTimeCompare(key, this.apiKey)) {
        return res.status(401).json({ 
          error: 'Invalid API key' 
        });
      }

      next();
    };
  }

  // Rate limiting middleware to prevent brute force attacks
  rateLimit(options = {}) {
    const {
      windowMs = 15 * 60 * 1000, // 15 minutes
      max = 100, // limit each IP to 100 requests per windowMs
      message = 'Too many requests, please try again later'
    } = options;

    const requests = new Map();

    return (req, res, next) => {
      const ip = req.ip || req.connection.remoteAddress;
      const now = Date.now();
      const windowStart = now - windowMs;

      // Clean up old entries
      for (const [key, timestamps] of requests.entries()) {
        const filtered = timestamps.filter(time => time > windowStart);
        if (filtered.length === 0) {
          requests.delete(key);
        } else {
          requests.set(key, filtered);
        }
      }

      // Check current IP
      const ipRequests = requests.get(ip) || [];
      const recentRequests = ipRequests.filter(time => time > windowStart);

      if (recentRequests.length >= max) {
        return res.status(429).json({ error: message });
      }

      recentRequests.push(now);
      requests.set(ip, recentRequests);
      
      next();
    };
  }

  // Constant-time string comparison
  constantTimeCompare(a, b) {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    
    return result === 0;
  }

  // Generate a secure API key
  static generateApiKey() {
    return crypto.randomBytes(32).toString('hex');
  }
}

module.exports = AuthMiddleware;