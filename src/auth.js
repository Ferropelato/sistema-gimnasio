/**
 * Identidad para auditoría (sin login por usuario; acceso admin sigue en finanzas vía /api/auth)
 */
export function getAuthActor() {
  return 'usuario';
}
