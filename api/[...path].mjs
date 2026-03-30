/**
 * Vercel: todas las rutas /api/* → Express (cookies de sesión).
 */
import serverless from 'serverless-http';
import { createApp } from '../server/app.mjs';

const app = createApp();
export default serverless(app);
