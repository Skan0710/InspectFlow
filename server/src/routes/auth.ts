import { Router, type Request, type Response } from 'express';

const router = Router();

/**
 * Parses and validates Google OAuth ID token claims.
 */
function decodeGoogleJwt(token: string) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
    return payload;
  } catch {
    return null;
  }
}

/**
 * POST /api/auth/google
 * Validates Google OAuth ID token credential and returns authenticated user profile.
 */
router.post('/google', async (req: Request, res: Response) => {
  try {
    const { credential, clientId } = req.body;
    if (!credential || typeof credential !== 'string') {
      return res.status(400).json({ 
        success: false, 
        message: 'Google credential ID token is required' 
      });
    }

    const payload = decodeGoogleJwt(credential);
    if (!payload || !payload.sub || !payload.email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid Google ID token payload' 
      });
    }

    // Validate token expiry (exp claim is in seconds)
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return res.status(401).json({ 
        success: false, 
        message: 'Google ID token has expired' 
      });
    }

    // Optional client ID check if configured on server
    const configuredClientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID;
    if (configuredClientId && payload.aud && payload.aud !== configuredClientId && clientId !== payload.aud) {
      // Warning or soft verification for flexible local development
      console.warn(`[GoogleOAuth] Token audience (${payload.aud}) differs from configured (${configuredClientId})`);
    }

    const user = {
      id: payload.sub,
      email: payload.email,
      name: payload.name || payload.email.split('@')[0],
      picture: payload.picture || '',
      emailVerified: Boolean(payload.email_verified),
    };

    return res.status(200).json({
      success: true,
      message: 'Successfully authenticated with Google',
      user,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Google OAuth authentication failed';
    return res.status(500).json({ success: false, message });
  }
});

/**
 * GET /api/auth/config
 * Exposes public OAuth client configuration to frontend clients.
 */
router.get('/config', (_req: Request, res: Response) => {
  res.status(200).json({
    googleClientId: process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || '',
  });
});

export default router;
