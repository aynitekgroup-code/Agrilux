import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { getSentinelNDVI } from '../lib/externalApis';
import IndicesSatelitalesPanel from './IndicesSatelitalesPanel';

export default function NdviParcela({ lat, lon, cultivo, nombre }) {
  const [ndviData, setNdviData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!lat || !lon) return;
    setLoading(true);
    getSentinelNDVI(lat, lon, 1, cultivo || '')
      .then(data => {
        setNdviData(data);
        setLoading(false);
      })
      .catch(() => {
        setError('No se pudieron cargar los índices satelitales');
        setLoading(false);
      });
  }, [lat, lon, cultivo]);

  if (loading) return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <div className="flex items-center gap-2 text-primary">
        <Loader2 size={18} className="animate-spin" />
        <p className="text-sm font-semibold">Cargando índices satelitales...</p>
      </div>
    </div>
  );

  if (error || !ndviData) return null;

  return <IndicesSatelitalesPanel data={ndviData} cultivo={cultivo} />;
}
