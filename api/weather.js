// api/weather.js
// Clima unificado: OpenWeatherMap → Open-Meteo + estaciones SENAMHI + pronóstico agrícola caña

const ESTACIONES_SENAMHI = [
  { codigo:'A001', nombre:'Tumbes', dept:'Tumbes', prov:'Tumbes', lat:-3.57, lon:-80.45, alt:25 },
  { codigo:'A002', nombre:'Piura', dept:'Piura', prov:'Piura', lat:-5.17, lon:-80.63, alt:29 },
  { codigo:'A004', nombre:'Sullana', dept:'Piura', prov:'Sullana', lat:-4.90, lon:-80.68, alt:62 },
  { codigo:'A005', nombre:'Chiclayo', dept:'Lambayeque', prov:'Chiclayo', lat:-6.77, lon:-79.84, alt:27 },
  { codigo:'A006', nombre:'Lambayeque', dept:'Lambayeque', prov:'Lambayeque', lat:-6.70, lon:-79.91, alt:13 },
  { codigo:'A007', nombre:'Ferreñafe', dept:'Lambayeque', prov:'Ferreñafe', lat:-6.64, lon:-79.79, alt:43 },
  { codigo:'A008', nombre:'Trujillo', dept:'La Libertad', prov:'Trujillo', lat:-8.11, lon:-79.03, alt:34 },
  { codigo:'A009', nombre:'Chepen', dept:'La Libertad', prov:'Chepen', lat:-7.23, lon:-79.43, alt:55 },
  { codigo:'A010', nombre:'Chimbote', dept:'Áncash', prov:'Santa', lat:-9.07, lon:-78.59, alt:4 },
  { codigo:'A011', nombre:'Huaral', dept:'Lima', prov:'Huaral', lat:-11.50, lon:-77.21, alt:410 },
  { codigo:'A012', nombre:'Lima', dept:'Lima', prov:'Lima', lat:-12.03, lon:-76.93, alt:182 },
  { codigo:'A013', nombre:'Pisco', dept:'Ica', prov:'Pisco', lat:-13.70, lon:-76.02, alt:13 },
  { codigo:'A014', nombre:'Ica', dept:'Ica', prov:'Ica', lat:-14.07, lon:-75.73, alt:400 },
  { codigo:'A015', nombre:'Nazca', dept:'Ica', prov:'Nazca', lat:-14.83, lon:-74.95, alt:520 },
  { codigo:'A016', nombre:'Arequipa', dept:'Arequipa', prov:'Arequipa', lat:-16.34, lon:-71.57, alt:2050 },
  { codigo:'A017', nombre:'Chincha', dept:'Ica', prov:'Chincha', lat:-13.41, lon:-76.13, alt:69 },
  { codigo:'A018', nombre:'Cañete', dept:'Lima', prov:'Cañete', lat:-13.07, lon:-76.35, alt:93 },
  { codigo:'A019', nombre:'Ilo', dept:'Moquegua', prov:'Ilo', lat:-17.64, lon:-71.34, alt:11 },
  { codigo:'A020', nombre:'Tacna', dept:'Tacna', prov:'Tacna', lat:-18.01, lon:-70.25, alt:441 },
];

function findEstacion(lat, lon) {
  let min = Infinity, best = ESTACIONES_SENAMHI[0];
  for (const e of ESTACIONES_SENAMHI) {
    const d = Math.hypot(lat - e.lat, lon - e.lon);
    if (d < min) { min = d; best = e; }
  }
  return { ...best, distanciaKm: Math.round(min * 111) };
}

function codClima(c) {
  return { 0:'Despejado',1:'Mayormente despejado',2:'Parcialmente nublado',3:'Nublado',
    45:'Neblina',48:'Neblina con escarcha',51:'Llovizna leve',53:'Llovizna moderada',
    55:'Llovizna densa',61:'Lluvia leve',63:'Lluvia moderada',65:'Lluvia fuerte',
    71:'Nevada leve',73:'Nevada moderada',75:'Nevada fuerte',77:'Granizo',
    80:'Chubasco leve',81:'Chubasco moderado',82:'Chubasco fuerte',
    95:'Tormenta',96:'Tormenta con granizo',99:'Tormenta fuerte con granizo',
  }[c] || 'Desconocido';
}

function indicadoresAgricolas(daily) {
  if (!daily) return null;
  let precip=0, tMax=-999, tMin=999, et0=0;
  for (let i=0;i<7;i++) {
    precip += daily.precipitation_sum?.[i]||0;
    tMax = Math.max(tMax, daily.temperature_2m_max?.[i]||0);
    tMin = Math.min(tMin, daily.temperature_2m_min?.[i]||999);
    et0 += daily.et0_fao_evapotranspiration?.[i]||0;
  }
  const balance = Math.round((precip-et0)*10)/10;
  let riesgo = 'Equilibrado';
  if (balance<-20) riesgo='Severa sequía';
  else if (balance<-10) riesgo='Sequía moderada';
  else if (balance<0) riesgo='Sequía leve';
  else if (balance>20) riesgo='Exceso hídrico';
  let frio='Sin riesgo';
  if (tMin<0) frio='Helada severa';
  else if (tMin<5) frio='Riesgo de helada';
  else if (tMin<12) frio='Frío moderado';
  return { precipitacionTotal7d:Math.round(precip*10)/10, temperaturaMax:Math.round(tMax*10)/10,
    temperaturaMin:Math.round(tMin*10)/10, temperaturaPromedio:Math.round((tMax+tMin)/2*10)/10,
    evapotranspiracion7d:Math.round(et0*10)/10, balanceHidrico:balance, riesgoHidrico:riesgo, zonaFrio:frio };
}

function pronosticoCana(ind) {
  if (!ind) return null;
  const rec = [];
  if (ind.balanceHidrico<-10) rec.push({area:'Riego',prioridad:'ALTA',msg:'Déficit hídrico severo. Aumentar riego a cada 3-4 días.'});
  else if (ind.balanceHidrico<0) rec.push({area:'Riego',prioridad:'MEDIA',msg:'Déficit leve. Mantener riego y vigilar humedad.'});
  else if (ind.balanceHidrico>15) rec.push({area:'Riego',prioridad:'MEDIA',msg:'Exceso hídrico. Reducir riego para evitar pudrición.'});
  if (ind.humedad>80||ind.precipitacionTotal7d>30) rec.push({area:'Plagas',prioridad:'ALTA',msg:'Humedad alta: riesgo de royas y hongos. Aplicar fungicida preventivo.'});
  if (ind.temperaturaPromedio>28&&ind.precipitacionTotal7d>20) rec.push({area:'Plagas',prioridad:'MEDIA',msg:'Cálido+húmedo: alto riesgo de gusano taladrador. Colocar trampas.'});
  if (ind.temperaturaPromedio<20) rec.push({area:'Maduración',prioridad:'MEDIA',msg:'Temperaturas bajas favorecen sacarosa. Monitorear brix.'});
  return rec.length ? rec : [{area:'General',prioridad:'BAJA',msg:'Condiciones favorables. Mantener manejo actual.'}];
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if (req.method==='OPTIONS') return res.status(200).end();
  if (req.method!=='GET') return res.status(405).end();

  const url = new URL(req.url,'http://localhost');
  const lat = parseFloat(url.searchParams.get('lat'))||null;
  const lon = parseFloat(url.searchParams.get('lon'))||null;
  const label = url.searchParams.get('label')||'';
  const q = url.searchParams.get('q');
  const senamhi = url.searchParams.get('senamhi');

  try {
    let la=lat, lo=lon, name=label;

    if ((!la||!lo)&&q) {
      const g = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&accept-language=es&q=${encodeURIComponent(q)}`,{
        headers:{'User-Agent':'Agrilux/1.0'}
      });
      const gd = await g.json();
      if (!gd.length) return res.status(404).json({error:'Ubicación no encontrada'});
      la=parseFloat(gd[0].lat); lo=parseFloat(gd[0].lon); name=gd[0].display_name;
    }
    if (!la||!lo) return res.status(400).json({error:'Falta lat/lon o q'});

    // Open-Meteo (gratis)
    const omRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${la}&longitude=${lo}&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,wind_direction_10m,weather_code,cloud_cover,shortwave_radiation&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,et0_fao_evapotranspiration&timezone=auto&forecast_days=7`);
    const om = await omRes.json();

    const estacion = findEstacion(la, lo);
    const actual = om.current;
    const ind = indicadoresAgricolas(om.daily);
    const pronostico = pronosticoCana(ind);

    const base = {
      source: 'SENAMHI+Open-Meteo',
      location: { name: name||estacion.nombre, lat:la, lon:lo },
      estacion: { codigo:estacion.codigo, nombre:estacion.nombre, departamento:estacion.dept, provincia:estacion.prov, altitud:estacion.alt, distanciaKm:estacion.distanciaKm },
      current: actual ? {
        temp: actual.temperature_2m, humidity: actual.relative_humidity_2m,
        precip: actual.precipitation, wind: actual.wind_speed_10m,
        windDir: actual.wind_direction_10m, clouds: actual.cloud_cover,
        radiation: actual.shortwave_radiation, description: codClima(actual.weather_code),
      } : null,
      daily: om.daily,
      timezone: om.timezone,
    };

    // Si senamhi=true, incluir datos agrícolas completos
    if (senamhi) {
      base.indicadoresAgricolas = ind;
      base.pronosticoCana = pronostico;
    }

    return res.status(200).json(base);
  } catch (error) {
    console.error('Weather error:', error);
    return res.status(500).json({error:error.message});
  }
}
