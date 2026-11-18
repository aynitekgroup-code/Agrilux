import { supabase } from './supabase';
import { normalizarPlaca } from './agrotrackGrupos';

const COLUMNAS =
  'placa, area, grupo, estado_operativo, estado_movimiento, activo';

export async function cargarVehiculosMaestro(empresaId) {
  if (!empresaId) return { unidades: [], disponible: false, aviso: null };

  try {
    const { data, error } = await supabase
      .from('agrotrack_vehiculos')
      .select(COLUMNAS)
      .eq('empresa_id', empresaId)
      .eq('activo', true)
      .order('placa');

    if (error) throw error;

    const unidades = (data || [])
      .map((fila) => {
        const placa = normalizarPlaca(fila?.placa);
        if (!placa) return null;
        return {
          placa,
          area: String(fila?.area || '').trim(),
          descripcion: String(fila?.area || '').trim(),
          grupo: String(fila?.grupo || '').trim(),
          estado_operativo: String(fila?.estado_operativo || '').trim(),
          estado_movimiento: String(fila?.estado_movimiento || '').trim(),
          activo: fila?.activo !== false,
          fuente: 'maestro',
          sin_telemetria: true,
        };
      })
      .filter(Boolean);

    return { unidades, disponible: true, aviso: null };
  } catch (error) {
    const detalle = String(error?.message || error || '');
    const disponible = false;
    const aviso =
      /permission denied|row-level security|42501/i.test(detalle)
        ? 'El padrón de unidades no es legible para esta empresa. Ejecuta el SQL de agrotrack_vehiculos o revisa los permisos.'
        : /schema cache|does not exist|42P01|PGRST202/i.test(detalle)
          ? 'Falta permiso/soporte de agrotrack_vehiculos en Supabase. Ejecuta scripts/agrotrack-vehiculos-area.sql.'
          : `No se pudo leer el padrón de unidades: ${detalle || 'error desconocido'}`;
    return { unidades: [], disponible, aviso };
  }
}
