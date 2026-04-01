/**
 * Identidad para auditoría (Firebase Auth)
 */
import { auth } from './firebase.js';

export function getAuthActor() {
  const u = auth.currentUser;
  if (!u) return 'sin-sesión';
  return u.email || u.uid || 'usuario';
}
