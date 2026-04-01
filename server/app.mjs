/**
 * Express: API de sesión (cookies firmadas) para Administración / Finanzas.
 * Contraseña: FINANZAS_CLAVE en entorno (misma que config Firebase en producción).
 */
import express from 'express';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

const COOKIE_NAME = 'center_gym_auth';

function getFinanzasClave() {
  return process.env.FINANZAS_CLAVE || 'admin';
}

function isProduction() {
  return process.env.NODE_ENV === 'production';
}

/** Orígenes permitidos para credenciales (cookies). En prod definir CORS_ORIGIN=https://tudominio.com */
function corsOriginOption() {
  const raw = (process.env.CORS_ORIGIN || '').trim();
  if (!raw) {
    return isProduction() ? false : true;
  }
  const list = raw.split(',').map(s => s.trim()).filter(Boolean);
  if (list.length === 1) return list[0];
  return list;
}

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);

  const secret = process.env.SESSION_SECRET || 'center-gym-dev-secret-change-in-prod';
  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
  app.use(compression());
  app.use(
    cors({
      origin: corsOriginOption(),
      credentials: true
    })
  );
  app.use(cookieParser(secret));
  app.use(express.json({ limit: '32kb' }));

  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 40,
    standardHeaders: true,
    legacyHeaders: false,
    message: { ok: false, error: 'too_many_requests' }
  });

  const auth = express.Router();

  auth.post('/login', loginLimiter, (req, res) => {
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
