import { describe, it, expect } from 'vitest';
import { getFechaUltimoPagoEfectivo } from '../src/utils.js';

describe('getFechaUltimoPagoEfectivo', () => {
  const socio = { id: 's1', nombre: 'Juan Pérez', ultimo_pago: '2025-01-01' };

  it('prioriza cuotas con mismo socio_id', () => {
    const cuotas = [
      { nombre: 'Otro', fecha: '2025-06-01', socio_id: 'x' },
      { nombre: 'Juan Pérez', fecha: '2025-03-15', socio_id: 's1' }
    ];
    expect(getFechaUltimoPagoEfectivo(socio, cuotas)).toBe('2025-03-15');
  });

  it('sin socio_id en cuota, coincide por nombre (legado)', () => {
    const cuotas = [{ nombre: 'Juan Pérez', fecha: '2025-04-01' }];
    expect(getFechaUltimoPagoEfectivo(socio, cuotas)).toBe('2025-04-01');
  });

  it('ignora cuota de otro socio_id', () => {
    const cuotas = [{ nombre: 'Juan Pérez', fecha: '2025-08-01', socio_id: 'otro' }];
    expect(getFechaUltimoPagoEfectivo(socio, cuotas)).toBe('2025-01-01');
  });
});
