import test from 'node:test';
import assert from 'node:assert/strict';
import { prepararStatusCompartido } from '../src/lib/hunterCompartir.js';

test('el reporte compartido conserva filtros, hora, estado y solo unidades visibles', () => {
  const filas = [{ equipo_id: '1', unidad: 'CASE 2', area_operativa: 'Cosecha', fecha: 'fecha-real' }];
  const r = prepararStatusCompartido(filas, { fecha: (v) => v || '—', clasificar: () => 'Apagado', geocerca: () => 'Campo', filtros: 'Área: Cosecha', generado: 'corte' });
  assert.equal(r.generado, 'corte');
  assert.equal(r.filtros, 'Área: Cosecha');
  assert.deepEqual(r.filas, [{ unidad: 'CASE 2', area: 'Cosecha', estado: 'Apagado', geocerca: 'Campo', posicion: 'fecha-real' }]);
});
