/**
 * Express: API de sesión (cookies firmadas) para Administración / Finanzas.
 * Contraseña: FINANZAS_CLAVE en entorno (misma que config Firebase en producción).
 */
import express from 'express';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import helmet from 'helmet';

const COOKIE_NAME = 'center_gym_auth';

function getFinanzasClave() {
  return process.env.FINANZAS_CLAVE || 'admin';
}

function isProduction() {
  return process.env.NODE_ENV === 'production';
}

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);

  const secret = process.env.SESSION_SECRET || 'center-gym-dev-secret-change-in-prod';
  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
  app.use(compression());
  app.use(cookieParser(secret));
  app.use(express.json({ limit: '32kb' }));

  const auth = express.Router();

  auth.post('/login', (req, res) => {
    const password = req.body?.password;
    if (typeof password !== 'string' || password !== getFinanzasClave()) {
      return res.status(401).json({ ok: false, error: 'unauthorized' });
    }
    const secure =
      isProduction() && process.env.FORCE_INSECURE_COOKIE !== '1';
    res.cookie(COOKIE_NAME, '1', {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      signed: true,
      path: '/'
    });
    return res.json({ ok: true });
  });

  auth.post('/logout', (req, res) => {
    res.clearCookie(COOKIE_NAME, { path: '/', signed: true });
    return res.json({ ok: true });
  });

  auth.get('/me', (req, res) => {
    const val = req.signedCookies?.[COOKIE_NAME];
    return res.json({ ok: val === '1' });
  });

  app.use('/api/auth', auth);

  app.get('/api/health', (_req, res) => {
    res.set('Cache-Control', 'no-store');
    return res.json({ ok: true, ts: Date.now() });
  });

  return app;
}
