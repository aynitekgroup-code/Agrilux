import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { filasStatusHunterExcel, geocercaHunter } from '../src/lib/hunterStatusExport.js';

test('Excel Hunter conserva los datos filtrados y los desconocidos', () => {
  const filas = filasStatusHunterExcel([{ equipo_id: '123', unidad: 'CASE 2', velocidad_kmh: 0 }], {
    fecha: (f) => f || '—', clasificar: () => 'Desconocido',
  });
  assert.equal(filas.length, 1);
  assert.equal(filas[0]['ID equipo Hunter'], '123');
  assert.equal(filas[0]['Velocidad (km/h)'], 0);
  assert.equal(filas[0]['Geocerca'], 'Sin coincidencia');
  assert.equal(filas[0]['Estado orientativo'], 'Desconocido');
});

test('geocerca operativa prevalece y departamento solo es respaldo', () => {
  assert.equal(geocercaHunter({ geocerca: 'Fábrica', departamento: 'LAMBAYEQUE' }), 'Fábrica');
  assert.equal(geocercaHunter({ departamento: 'LIMA' }), 'Dpto. LIMA');
  assert.equal(geocercaHunter({}), 'Sin coincidencia');
});

test('Excel Hunter distingue área de grupo operativo', () => {
  const [fila] = filasStatusHunterExcel([{ equipo_id: '1', area_operativa: 'Excavadora', grupos_operativos: ['Drenajes'] }], { fecha: () => '—', clasificar: () => 'Desconocido' });
  assert.equal(fila['Área operativa'], 'Excavadora');
  assert.equal(fila['Grupo operativo'], 'Drenajes');
});

test('Excel Hunter escribe valores externos como texto y no fórmulas', () => {
  const datos = filasStatusHunterExcel([{ equipo_id: '1', unidad: '=1+1' }], { fecha: () => '—', clasificar: () => 'Desconocido' });
  const hoja = XLSX.utils.json_to_sheet(datos);
  assert.equal(hoja.A2.t, 's');
  assert.equal(hoja.A2.f, undefined);
});
