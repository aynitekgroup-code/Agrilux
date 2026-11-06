export const FLEET = {
  forest: '#0F4C3A',
  forestDark: '#0B3A2B',
  forestLight: '#1A5E48',
  bg: '#F8F9FA',
  card: '#FFFFFF',
  border: '#E2E8F0',
  text: '#0F172A',
  muted: '#64748B',
  green: '#15803D',
  greenSoft: '#DCFCE7',
  amber: '#B45309',
  amberSoft: '#FEF3C7',
  red: '#B91C1C',
  redSoft: '#FEE2E2',
  grey: '#6B7280',
  greySoft: '#F1F5F9',
  blue: '#1D4ED8',
  blueSoft: '#DBEAFE',
};

export const STATUS_META = {
  en_ruta: { label: 'En ruta', color: FLEET.green, bg: FLEET.greenSoft, dot: '#22C55E' },
  detenido: { label: 'Detenido', color: FLEET.amber, bg: FLEET.amberSoft, dot: '#F59E0B' },
  alerta: { label: 'Alerta', color: FLEET.red, bg: FLEET.redSoft, dot: '#EF4444' },
  offline: { label: 'Sin conexión', color: FLEET.grey, bg: FLEET.greySoft, dot: '#9CA3AF' },
};

export const SEVERITY_META = {
  critica: { label: 'Crítica', color: '#FFFFFF', bg: FLEET.red, stripe: '#DC2626' },
  alta: { label: 'Alta', color: FLEET.red, bg: FLEET.redSoft, stripe: '#F97316' },
  media: { label: 'Media', color: FLEET.amber, bg: FLEET.amberSoft, stripe: '#F59E0B' },
  info: { label: 'Info', color: FLEET.blue, bg: FLEET.blueSoft, stripe: '#3B82F6' },
};

export const FUEL_TYPE_META = {
  manual: { label: 'Manual', color: FLEET.amber, bg: FLEET.amberSoft },
  sensor: { label: 'Sensor', color: FLEET.green, bg: FLEET.greenSoft },
  simulado: { label: 'Simulado', color: FLEET.blue, bg: FLEET.blueSoft },
};

export const ANOMALY_META = {
  caida_sospechosa: { label: 'Caída sospechosa', color: FLEET.red, bg: FLEET.redSoft },
  consumo_excesivo: { label: 'Consumo excesivo', color: FLEET.amber, bg: FLEET.amberSoft },
  sin_registro: { label: 'Sin registro', color: FLEET.blue, bg: FLEET.blueSoft },
};

export const vehicleLabel = (vehicles, id) => {
  const found = vehicles.find((v) => v.id === id);
  return found ? `${found.placa} · ${found.modelo}` : id;
};

export const formatMoney = (value) => `S/ ${Number(value || 0).toFixed(2)}`;
