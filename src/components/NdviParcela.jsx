import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { getSentinelNDVI } from '../lib/externalApis';
import IndicesSatelitalesPanel from './IndicesSatelitalesPanel';

export default function NdviParcela({ lat, lon, cultivo, nombre, diasDesdeSiembra = 0, parcelaId = '', coordenadas = null }) {
  const [ndviData, setNdviData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!lat || !lon) return;
    setLoading(true);
    setError(null);
    getSentinelNDVI(lat, lon, 1, {
      cultivo: cultivo || '',
      dias: diasDesdeSiembra,
      parcelaId,
      coordenadas,
    })
      .then(data => {
        setNdviData(data);
        setLoading(false);
      })
      .catch(() => {
        setError('No se pudieron cargar los índices satelitales');
        setLoading(false);
      });
  }, [lat, lon, cultivo, diasDesdeSiembra, parcelaId]);

  if (loading) return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <div className="flex items-center gap-2 text-primary">
        <Loader2 size={18} className="animate-spin" />
        <p className="text-sm font-semibold">Analizando parcela (ubicación + edad del cultivo)...</p>
      </div>
    </div>
  );

  if (error || !ndviData) return (
    <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200">
      <p className="text-sm text-amber-800">{error || 'Sin datos satelitales'}</p>
      <p className="text-xs text-amber-600 mt-1">Mapea la parcela o ingresa GPS numérico (lat, lon) para resultados precisos.</p>
    </div>
  );

  return <IndicesSatelitalesPanel data={ndviData} cultivo={cultivo} />;
}
