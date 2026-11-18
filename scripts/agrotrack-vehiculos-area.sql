-- ===========================================================================
-- AGROACTIVITY · AREA DE UNIDADES DEL PADRÓN (consultada por Agrilux)
--
-- No crea tablas ni RPC. Agrega el campo `area` a la tabla existente
-- `agrotrack_vehiculos` e importa los valores del reporte maestro de Zonar:
--   2587-1K -> 33.PREP
--   M2-1737 -> 17.DIV.
--   M6E-859 -> CAMIÓN
--
-- Ejecutar completo en Supabase SQL Editor. Es repetible e idempotente.
-- ===========================================================================
alter table public.agrotrack_vehiculos
  add column if not exists area text;

update public.agrotrack_vehiculos
set area = v.area
from (values
  ('2587-1K', '33.PREP'),
  ('M2-1737', '17.DIV.'),
  ('M6E-859', 'CAMIÓN')
) as v(placa, area)
where public.agrotrack_vehiculos.placa = v.placa;

-- Actualiza el grupo solo como respaldo del mismo registro: el dato maestro
-- deberá contener la relación placa -> área que se usará en la UI.
update public.agrotrack_vehiculos
set grupo = v.grupo
from (values
  ('2587-1K', 'Motos Supervision'),
  ('M2-1737', 'Motos Supervision'),
  ('M6E-859', 'Maquinaria')
) as v(placa, grupo)
where public.agrotrack_vehiculos.placa = v.placa;
