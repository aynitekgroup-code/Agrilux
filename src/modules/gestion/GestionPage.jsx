import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import GestionHeader from './components/GestionHeader';
import FiltrosFundo from './components/FiltrosFundo';
import PanelGestion from './components/PanelGestion';
import MetricasFundo from './components/MetricasFundo';
import AlertaGestion from './components/AlertaGestion';
import AccesosGestion from './components/AccesosGestion';

export default function Gestion() {
  const navigate = useNavigate();
  const [filtroActivo, setFiltroActivo] = useState('Todo el fundo');

  return (
    <div className="min-h-[calc(100vh-120px)] bg-slate-50 -mx-4 px-4 pb-6">
      <GestionHeader />
      <FiltrosFundo activo={filtroActivo} onChange={setFiltroActivo} />
      <PanelGestion onParcelas={() => navigate('/parcela')} onCiclo={() => navigate('/ciclo')} />
      <MetricasFundo />
      <AlertaGestion />
      <AccesosGestion onNavigate={(ruta) => ruta && navigate(ruta)} />
    </div>
  );
}
