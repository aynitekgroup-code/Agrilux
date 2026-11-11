import React, { useEffect, useMemo, useState } from 'react';
import { Download, Library } from 'lucide-react';
import { alerts, geofences, vehicles } from '../../mocks/agrotrackData';

const REPORTS = [
  { id: 'rendimiento', label: 'Rendimiento del vehículo', group: 'Rendimientos', type: 'vehicles' },
  { id: 'basico', label: 'Reporte básico', group: 'Alertas y eventos', type: 'vehicles' },
  { id: 'uso-motor', label: 'Tiempo de uso del motor', group: 'Rendimientos', type: 'vehicles' },
  { id: 'horas-motor', label: 'Horas totales de motor', group: 'Rendimientos', type: 'vehicles' },
  { id: 'actividades-sumarizado', label: 'Actividades (sumarizado)', group: 'Actividades', type: 'activities' },
  { id: 'actividades', label: 'Actividades', group: 'Actividades', type: 'activities' },
  { id: 'actividades-latlon', label: 'Actividades - LatLon', group: 'Actividades', type: 'coordinates' },
  { id: 'actividades-detalladas', label: 'Actividades detalladas', group: 'Actividades', type: 'activities' },
  { id: 'dot-horas', label: 'DOT - Horas de servicio', group: 'Alertas y eventos', type: 'drivers' },
  { id: 'log-conductores', label: 'Log de conductores', group: 'Conductores', type: 'drivers' },
  { id: 'conductores', label: 'Conductores', group: 'Conductores', type: 'drivers' },
  { id: 'estados-conductores', label: 'Estados - Conductores', group: 'Conductores', type: 'drivers' },
  { id: 'tiempos-conductor', label: 'Tarjeta de tiempos conductor', group: 'Conductores', type: 'drivers' },
  { id: 'geocercas-entradas', label: 'Geocercas: entradas y salidas', group: 'Geocercas y rutas', type: 'geofences' },
  { id: 'limite-velocidad', label: 'Geocercas: límite de velocidad', group: 'Geocercas y rutas', type: 'speed' },
  { id: 'rutas-historicas', label: 'Rutas históricas', group: 'Geocercas y rutas', type: 'routes' },
  { id: 'ralenti-eventos', label: 'Ralentí: entradas y salidas', group: 'Geocercas y rutas', type: 'idle' },
  { id: 'ralenti', label: 'Ralentí', group: 'Geocercas y rutas', type: 'idle' },
  { id: 'alertas', label: 'Alertas', group: 'Alertas y eventos', type: 'alerts' },
  { id: 'eventos', label: 'Eventos', group: 'Alertas y eventos', type: 'events' },
  { id: 'eventos-resumidos', label: 'Eventos resumidos', group: 'Alertas y eventos', type: 'alertSummary' },
];

const MODULE_REPORT_GROUPS = {
  flota: ['Rendimientos', 'Actividades', 'Conductores'],
  geocercas: ['Geocercas y rutas'],
  alertas: ['Alertas y eventos'],
};
const HISTORICAL_ROUTE_OPTIONS = [
  { id: 'pomalca-planta', nombre: 'Pomalca → Planta / grifo', origen: 'Lote 12 · Caña', destino: 'Planta / grifo', distancia: 8.4 },
  { id: 'cosecha-carretera', nombre: 'Lote 07 · Cosecha → Carretera norte', origen: 'Lote 07 · Cosecha', destino: 'Carretera norte', distancia: 14.2 },
  { id: 'planta-pomalca', nombre: 'Planta / grifo → Zona autorizada Pomalca', origen: 'Planta / grifo', destino: 'Zona autorizada Pomalca', distancia: 6.8 },
];
const DEMO_DATE = '10/11/2026';

function toLocalDateTimeValue(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function currentDayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setHours(23, 59, 0, 0);
  return { desde: toLocalDateTimeValue(start), hasta: toLocalDateTimeValue(end) };
}

function recentDateRange() {
  const end = new Date();
  end.setHours(23, 59, 0, 0);
  const start = new Date(end);
  start.setDate(start.getDate() - 6);
  start.setHours(0, 0, 0, 0);
  return { desde: toLocalDateTimeValue(start), hasta: toLocalDateTimeValue(end) };
}

function currentDateValue() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function dotServiceReport(filters) {
  if (!filters.fecha) return [];

  const selectedVehicles = vehicles.filter((vehicle) => (
    !filters.conductor || vehicle.conductor_id === filters.conductor
  ));
  const schedule = [
    { status: 'OFF', start: 0, end: 6 },
    { status: 'SB', start: 6, end: 8 },
    { status: 'D', start: 8, end: 12 },
    { status: 'ON', start: 12, end: 13 },
    { status: 'D', start: 13, end: 16 },
    { status: 'SB', start: 16, end: 18 },
    { status: 'OFF', start: 18, end: 24 },
  ];
  const formatDuration = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}h:${String(minutes % 60).padStart(2, '0')}m`;

  return selectedVehicles.map((vehicle) => {
    const totals = schedule.reduce((result, segment) => {
      result[segment.status] += (segment.end - segment.start) * 60;
      return result;
    }, { OFF: 0, SB: 0, D: 0, ON: 0 });
    const entries = schedule.map((segment, index) => {
      const start = new Date(`${filters.fecha}T00:00:00`);
      start.setMinutes(segment.start * 60);
      return {
        id: `${vehicle.id}-dot-${index}`,
        hora: start.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }),
        duracion: formatDuration((segment.end - segment.start) * 60),
        vehiculo: vehicle.placa,
        millas: segment.status === 'D' ? `${((segment.end - segment.start) * (8 + (vehicle.odometro_km % 5))).toFixed(1)}` : '0.0',
        estado: segment.status,
        direccion: `${vehicle.ultima_ubicacion}, Pomalca, Lambayeque`,
      };
    });

    return {
      conductor: vehicle.conductor_nombre,
      unidad: vehicle.placa,
      totals: {
        fueraDeServicio: formatDuration(totals.OFF),
        descansando: formatDuration(totals.SB),
        conduciendo: formatDuration(totals.D),
        servicioNoConduciendo: formatDuration(totals.ON),
      },
      schedule,
      entries,
    };
  });
}

function alertReportRows(filters) {
  const start = new Date(filters.desde);
  const end = new Date(filters.hasta);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [];

  const rows = alerts.flatMap((alert) => {
    const vehicle = vehicles.find((item) => item.id === alert.vehiculo_id);
    if (!vehicle) return [];
    if (filters.modo === 'grupo' && filters.grupo && vehicle.tipo !== filters.grupo) return [];
    if (filters.modo === 'unidad' && filters.unidad && vehicle.placa !== filters.unidad) return [];
    if (filters.conductor && vehicle.conductor_nombre !== filters.conductor) return [];

    const match = alert.fecha.match(/^(\d{2})\/(\d{2})\s*[·-]\s*(\d{2}):(\d{2})$/);
    if (!match) return [];
    const [, day, month, hour, minute] = match;
    const date = new Date(start.getFullYear(), Number(month) - 1, Number(day), Number(hour), Number(minute));
    if (date < start || date > end) return [];

    const geofenceEvent = alert.origen === 'Geocerca';
    const detail = geofenceEvent
      ? /ingreso|entrada/i.test(alert.mensaje) ? 'IN' : 'OUT'
      : alert.mensaje;
    return [{
      id: alert.id,
      unidad: vehicle.placa,
      categoria: geofenceEvent ? 'Geofence Alert' : `${alert.origen} Alert`,
      fechaEvento: date.toLocaleString('es-PE'),
      sortAt: date.getTime(),
      ubicacion: `${vehicle.ultima_ubicacion}, Pomalca, Lambayeque, Perú`,
      conductor: vehicle.conductor_nombre || 'Sin asignar',
      detalle: detail,
    }];
  });
  return rows
    .sort((a, b) => a.sortAt - b.sortAt)
    .map(({ sortAt, ...row }) => row);
}

function eventReportRows(filters) {
  const start = new Date(filters.desde);
  const end = new Date(filters.hasta);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [];

  const selectedVehicles = vehicles.filter((vehicle) => (
    filters.modo === 'grupo'
      ? !filters.grupo || vehicle.tipo === filters.grupo
      : !filters.unidad || vehicle.placa === filters.unidad
  ));
  const eventTemplates = [
    { minute: 0, evento: 'Parked', duration: '00:06:12', velocidad: 0, sentido: '—' },
    { minute: 372, evento: 'Ignition ON', duration: '', velocidad: 0, sentido: 'W' },
    { minute: 379, evento: 'Idle - Stop', duration: '00:04:05', velocidad: 0, sentido: '—' },
    { minute: 383, evento: 'Drive', duration: '', velocidad: 4, sentido: 'NE' },
    { minute: 397, evento: 'Drive', duration: '', velocidad: 9, sentido: 'W' },
    { minute: 415, evento: 'Parked', duration: '00:03:14', velocidad: 0, sentido: 'N' },
    { minute: 418, evento: 'Ignition OFF', duration: '', velocidad: 0, sentido: '—' },
  ];
  const firstDay = new Date(start);
  firstDay.setHours(0, 0, 0, 0);
  const lastDay = new Date(end);
  lastDay.setHours(0, 0, 0, 0);

  return selectedVehicles.flatMap((vehicle, vehicleIndex) => {
    const rows = [];
    for (const day = new Date(firstDay); day <= lastDay; day.setDate(day.getDate() + 1)) {
      eventTemplates.forEach((template, eventIndex) => {
        const eventDate = new Date(day);
        eventDate.setMinutes(template.minute + vehicleIndex * 3);
        if (eventDate < start || eventDate > end) return;
        rows.push({
          id: `${vehicle.id}-${day.toISOString().slice(0, 10)}-event-${eventIndex}`,
          unidad: vehicle.placa,
          tipo: vehicle.tipo,
          evento: template.evento,
          fechaEvento: eventDate.toLocaleString('es-PE'),
          direccion: `${vehicle.ultima_ubicacion}, Pomalca, Chiclayo, Lambayeque, Perú`,
          conductor: vehicle.conductor_nombre || 'Sin asignar',
          duracion: template.duration,
          velocidad: template.velocidad + (eventIndex > 2 ? vehicleIndex % 4 : 0),
          sentido: template.sentido,
          sortAt: eventDate.getTime(),
        });
      });
    }
    return rows;
  })
    .sort((a, b) => a.sortAt - b.sortAt)
    .map(({ sortAt, ...row }) => row);
}

function formatEventDuration(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function eventSummaryRows(filters) {
  const start = new Date(filters.desde);
  const end = new Date(filters.hasta);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [];

  const selectedVehicles = vehicles.filter((vehicle) => (
    filters.modo === 'grupo'
      ? !filters.grupo || vehicle.tipo === filters.grupo
      : !filters.unidad || vehicle.placa === filters.unidad
  ));
  const firstDay = new Date(start);
  firstDay.setHours(0, 0, 0, 0);
  const lastDay = new Date(end);
  lastDay.setHours(0, 0, 0, 0);

  return selectedVehicles.flatMap((vehicle, vehicleIndex) => {
    const dailyRows = [];
    for (const day = new Date(firstDay); day <= lastDay; day.setDate(day.getDate() + 1)) {
      const dayStart = new Date(day);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(day);
      dayEnd.setHours(23, 59, 59, 0);
      if (dayEnd < start || dayStart > end) continue;

      const idleSeconds = 3779 + (vehicleIndex % 4) * 420;
      const driveSeconds = 9509 + (vehicleIndex % 3) * 600;
      const totalSeconds = 86399;
      const stopSeconds = totalSeconds - idleSeconds - driveSeconds;
      const periodSeconds = Math.max(0, Math.floor(
        (Math.min(dayEnd, end).getTime() - Math.max(dayStart, start).getTime()) / 1000,
      ));
      const scaledIdle = Math.round(idleSeconds * periodSeconds / totalSeconds);
      const scaledDrive = Math.round(driveSeconds * periodSeconds / totalSeconds);
      const scaledStop = Math.max(0, periodSeconds - scaledIdle - scaledDrive);
      dailyRows.push({
        id: `${vehicle.id}-${day.toISOString().slice(0, 10)}-event-summary`,
        unidad: vehicle.placa,
        tipo: vehicle.tipo,
        fecha: day.toLocaleDateString('es-PE'),
        totalStopSeconds: scaledStop,
        stopPercent: periodSeconds ? scaledStop / periodSeconds * 100 : 0,
        totalIdleSeconds: scaledIdle,
        idlePercent: periodSeconds ? scaledIdle / periodSeconds * 100 : 0,
        totalDriveSeconds: scaledDrive,
        drivePercent: periodSeconds ? scaledDrive / periodSeconds * 100 : 0,
        totalSeconds: periodSeconds,
      });
    }
    return dailyRows;
  });
}

function speedLimitRows(filters) {
  const start = new Date(filters.desde);
  const end = new Date(filters.hasta);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [];

  const selectedVehicles = vehicles.filter((vehicle) => (
    (filters.modo === 'grupo'
      ? !filters.grupo || vehicle.tipo === filters.grupo
      : !filters.unidad || vehicle.placa === filters.unidad)
    && (!filters.geocercas.length || filters.geocercas.includes(vehicle.geocerca_id))
    && vehicle.velocidad_kmh > 0
  ));
  const firstDay = new Date(start);
  firstDay.setHours(0, 0, 0, 0);
  const lastDay = new Date(end);
  lastDay.setHours(0, 0, 0, 0);

  return selectedVehicles.flatMap((vehicle, vehicleIndex) => {
    const rows = [];
    for (const day = new Date(firstDay); day <= lastDay; day.setDate(day.getDate() + 1)) {
      [
        { minute: 9 * 60 + 15 + vehicleIndex * 4, extraSpeed: 3, durationSeconds: 48 + vehicleIndex * 11 },
        { minute: 13 * 60 + 40 + vehicleIndex * 3, extraSpeed: 12, durationSeconds: 76 + vehicleIndex * 13 },
      ].forEach((event, eventIndex) => {
        const date = new Date(day);
        date.setMinutes(event.minute);
        if (date < start || date > end) return;
        const limit = 40;
        const speed = Math.max(limit + event.extraSpeed, vehicle.velocidad_kmh);
        const duration = event.durationSeconds;
        const fence = geofences.find((item) => item.id === vehicle.geocerca_id);
        rows.push({
          id: `${vehicle.id}-${day.toISOString().slice(0, 10)}-speed-${eventIndex}`,
          unidad: vehicle.placa,
          tipo: vehicle.tipo,
          conductor: vehicle.conductor_nombre || 'Sin asignar',
          geocerca: fence?.nombre || vehicle.geocerca_id,
          fechaHora: date.toLocaleString('es-PE'),
          velocidad: speed,
          limite: limit,
          exceso: speed - limit,
          duracion: formatEventDuration(duration),
          ubicacion: `${vehicle.ultima_ubicacion}, Pomalca, Chiclayo, Lambayeque, Perú`,
          sortAt: date.getTime(),
        });
      });
    }
    return rows;
  })
    .sort((a, b) => a.sortAt - b.sortAt)
    .map(({ sortAt, ...row }) => row);
}

function geofenceVisitRows(filters) {
  const start = new Date(filters.desde);
  const end = new Date(filters.hasta);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [];

  const selectedFences = geofences.filter((fence) => (
    fence.activa && (!filters.geocercas.length || filters.geocercas.includes(fence.id))
  ));
  const selectedVehicles = vehicles.filter((vehicle) => (
    filters.modo === 'grupo'
      ? !filters.grupo || vehicle.tipo === filters.grupo
      : !filters.unidad || vehicle.placa === filters.unidad
  ));
  const firstDay = new Date(start);
  firstDay.setHours(0, 0, 0, 0);
  const lastDay = new Date(end);
  lastDay.setHours(0, 0, 0, 0);
  const visitMinutes = [
    { entrada: 6 * 60 + 1, durationSeconds: 9 * 60 + 34 },
    { entrada: 6 * 60 + 25, durationSeconds: 10 * 60 + 47 },
    { entrada: 6 * 60 + 40, durationSeconds: 31 * 60 + 8 },
    { entrada: 6 * 60 + 51, durationSeconds: 10 * 60 + 13 },
    { entrada: 6 * 60 + 55, durationSeconds: 1 * 60 + 59 },
    { entrada: 7 * 60 + 14, durationSeconds: 18 * 60 + 34 },
  ];

  return selectedVehicles.flatMap((vehicle, vehicleIndex) => {
    const visits = [];
    for (let day = new Date(firstDay); day <= lastDay; day.setDate(day.getDate() + 1)) {
      visitMinutes.forEach((visit, visitIndex) => {
        const fence = selectedFences[(vehicleIndex + visitIndex) % selectedFences.length];
        if (!fence) return;
        const entryAt = new Date(day);
        entryAt.setMinutes(visit.entrada + vehicleIndex * 2 + visitIndex * 3);
        const exitAt = new Date(entryAt.getTime() + visit.durationSeconds * 1000);
        if (entryAt < start || exitAt > end) return;
        const isTestVisit = visitIndex === 0;
        if (isTestVisit && !filters.pruebaVisita) return;

        visits.push({
          id: `${vehicle.id}-${fence.id}-${day.toISOString().slice(0, 10)}-visit-${visitIndex}`,
          unidad: vehicle.placa,
          tipo: vehicle.tipo,
          geocerca: fence.nombre,
          entradaFecha: entryAt.toLocaleDateString('es-PE'),
          entradaHora: entryAt.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false }),
          entradaTurno: entryAt.getHours() < 12 ? 'a. m.' : 'p. m.',
          salidaFecha: exitAt.toLocaleDateString('es-PE'),
          salidaHora: exitAt.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false }),
          salidaTurno: exitAt.getHours() < 12 ? 'a. m.' : 'p. m.',
          duracion: formatEventDuration(visit.durationSeconds),
          pruebaVisita: isTestVisit ? 'Sí' : 'No',
          sortAt: entryAt.getTime(),
        });
      });
    }
    return visits;
  })
    .sort((a, b) => a.unidad.localeCompare(b.unidad) || a.sortAt - b.sortAt)
    .map(({ sortAt, ...row }) => row);
}

function historicalRouteRows(filters) {
  const start = new Date(filters.desde);
  const end = new Date(filters.hasta);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [];

  const selectedVehicles = vehicles.filter((vehicle) => (
    (filters.modo === 'grupo'
      ? !filters.grupo || vehicle.tipo === filters.grupo
      : !filters.unidad || vehicle.placa === filters.unidad)
    && (!filters.conductor || vehicle.conductor_id === filters.conductor)
  ));
  const firstDay = new Date(start);
  firstDay.setHours(0, 0, 0, 0);
  const lastDay = new Date(end);
  lastDay.setHours(0, 0, 0, 0);
  const trips = [];

  selectedVehicles.forEach((vehicle, vehicleIndex) => {
    for (let day = new Date(firstDay); day <= lastDay; day.setDate(day.getDate() + 1)) {
      HISTORICAL_ROUTE_OPTIONS.forEach((route, routeIndex) => {
        if (filters.ruta && route.id !== filters.ruta) return;
        const departureAt = new Date(day);
        departureAt.setHours(7 + routeIndex * 3, 15 + vehicleIndex * 4, 0, 0);
        const durationMinutes = 18 + routeIndex * 7 + (vehicleIndex % 4) * 3;
        const arrivalAt = new Date(departureAt.getTime() + durationMinutes * 60_000);
        if (departureAt < start || arrivalAt > end) return;

        trips.push({
          id: `${vehicle.id}-${route.id}-${day.toISOString().slice(0, 10)}`,
          unidad: vehicle.placa,
          tipo: vehicle.tipo,
          conductor: vehicle.conductor_nombre || 'Sin asignar',
          ruta: route.nombre,
          origen: route.origen,
          destino: route.destino,
          salida: departureAt.toLocaleString('es-PE'),
          llegada: arrivalAt.toLocaleString('es-PE'),
          distancia: route.distancia.toFixed(1),
          duracion: formatEventDuration(durationMinutes * 60),
          velocidadMaxima: Math.min(vehicle.velocidad_kmh + routeIndex * 4, 80),
          sortAt: departureAt.getTime(),
        });
      });
    }
  });

  return trips
    .sort((a, b) => a.sortAt - b.sortAt)
    .map(({ sortAt, ...trip }) => trip);
}

function idleEventRows(filters) {
  const start = new Date(filters.desde);
  const end = new Date(filters.hasta);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [];

  const selectedVehicles = vehicles.filter((vehicle) => (
    filters.modo === 'grupo'
      ? !filters.grupo || vehicle.tipo === filters.grupo
      : !filters.unidad || vehicle.placa === filters.unidad
  ));
  const events = [
    { minute: 378, duration: 245, direction: 'N' },
    { minute: 389, duration: 301, direction: 'NE' },
    { minute: 411, duration: 267, direction: 'E' },
    { minute: 432, duration: 438, direction: 'SE' },
    { minute: 458, duration: 194, direction: 'S' },
    { minute: 481, duration: 352, direction: 'SO' },
    { minute: 506, duration: 226, direction: 'O' },
    { minute: 529, duration: 498, direction: 'NO' },
  ];
  const firstDay = new Date(start);
  firstDay.setHours(0, 0, 0, 0);
  const lastDay = new Date(end);
  lastDay.setHours(0, 0, 0, 0);

  return selectedVehicles.flatMap((vehicle, vehicleIndex) => {
    const rows = [];
    for (let day = new Date(firstDay); day <= lastDay; day.setDate(day.getDate() + 1)) {
      events.forEach((event, eventIndex) => {
        const eventAt = new Date(day);
        eventAt.setMinutes(event.minute + vehicleIndex * 3 + eventIndex);
        if (eventAt < start || eventAt > end) return;
        rows.push({
          id: `${vehicle.id}-${day.toISOString().slice(0, 10)}-idle-${eventIndex}`,
          unidad: vehicle.placa,
          tipo: vehicle.tipo,
          conductor: vehicle.conductor_nombre || 'Sin asignar',
          evento: 'Idle - Stop',
          fechaHora: eventAt.toLocaleString('es-PE'),
          ubicacion: `${vehicle.ultima_ubicacion}, Pomalca, Chiclayo, Lambayeque, Perú`,
          duracion: formatEventDuration(event.duration + (vehicleIndex % 3) * 17),
          velocidad: eventIndex === 6 && vehicleIndex % 3 === 0 ? 58 : 0,
          direccion: event.direction,
          sortAt: eventAt.getTime(),
        });
      });
    }
    return rows;
  })
    .sort((a, b) => a.unidad.localeCompare(b.unidad) || a.sortAt - b.sortAt)
    .map(({ sortAt, ...row }) => row);
}

function inactivityRows(filters) {
  const start = new Date(filters.desde);
  const end = new Date(filters.hasta);
  const minimumMinutes = Number(filters.minutos);
  if (
    Number.isNaN(start.getTime())
    || Number.isNaN(end.getTime())
    || start > end
    || !Number.isFinite(minimumMinutes)
    || minimumMinutes < 0
  ) return [];

  const selectedVehicles = vehicles.filter((vehicle) => (
    filters.modo === 'grupo'
      ? !filters.grupo || vehicle.tipo === filters.grupo
      : !filters.unidad || vehicle.placa === filters.unidad
  ));
  const stops = [
    { minute: 372, duration: 245 },
    { minute: 389, duration: 186 },
    { minute: 430, duration: 368 },
    { minute: 452, duration: 378 },
  ];
  const firstDay = new Date(start);
  firstDay.setHours(0, 0, 0, 0);
  const lastDay = new Date(end);
  lastDay.setHours(0, 0, 0, 0);

  return selectedVehicles.flatMap((vehicle, vehicleIndex) => {
    const pointOfInterest = geofences.find((fence) => fence.id === vehicle.geocerca_id)?.nombre || '—';
    const rows = [];
    for (let day = new Date(firstDay); day <= lastDay; day.setDate(day.getDate() + 1)) {
      stops.forEach((stop, stopIndex) => {
        const eventAt = new Date(day);
        eventAt.setMinutes(stop.minute + vehicleIndex * 3);
        const durationSeconds = stop.duration + (vehicleIndex % 3) * 17;
        if (eventAt < start || eventAt > end || durationSeconds < minimumMinutes * 60) return;

        rows.push({
          id: `${vehicle.id}-${day.toISOString().slice(0, 10)}-inactivity-${stopIndex}`,
          unidad: vehicle.placa,
          tipo: vehicle.tipo,
          fechaEvento: eventAt.toLocaleString('es-PE'),
          direccion: `${vehicle.ultima_ubicacion}, Pomalca, Chiclayo, Lambayeque, Perú`,
          puntoInteres: pointOfInterest,
          duracion: formatEventDuration(durationSeconds),
          duracionSegundos: durationSeconds,
          conductor: vehicle.conductor_nombre || 'Sin asignar',
          sortAt: eventAt.getTime(),
        });
      });
    }
    return rows;
  })
    .sort((a, b) => a.unidad.localeCompare(b.unidad) || a.sortAt - b.sortAt)
    .map(({ sortAt, ...row }) => row);
}

function vehicleRows() {
  return vehicles.map((vehicle, index) => {
    const motorHours = 7 + (index % 5) * 2;
    const idleHours = 0.5 + (index % 4) * 0.25;
    const distance = 24 + index * 17;
    return {
      id: vehicle.id,
      unidad: vehicle.placa,
      vehiculo: vehicle.modelo,
      conductor: vehicle.conductor_nombre,
      conductorId: vehicle.conductor_id,
      tipo: vehicle.tipo,
      estado: vehicle.estado,
      ubicacion: vehicle.ultima_ubicacion,
      velocidad: vehicle.velocidad_kmh,
      distancia: distance,
      motorHours,
      idleHours,
      fecha: DEMO_DATE,
      latitud: vehicle.lat,
      longitud: vehicle.lng,
      geocerca: vehicle.geocerca_id,
      odometro: vehicle.odometro_km,
      ignicion: vehicle.ignicion ? 'Sí' : 'No',
      travelTime: `${Math.max(1, motorHours - 2)} h 15 min`,
      idleTime: `${Math.floor(idleHours)} h ${Math.round((idleHours % 1) * 60)} min`,
      fuelLevel: vehicle.nivel_tanque_pct,
      maintenance: vehicle.mantenimiento_pendiente ? 'Pendiente' : 'Al día',
      grupo: vehicle.tipo,
    };
  });
}

function totalEngineHoursRows(selectedUnit) {
  return vehicleRows()
    .filter((vehicle) => !selectedUnit || vehicle.unidad === selectedUnit)
    .map((vehicle) => ({
      id: vehicle.id,
      unitId: vehicle.id.toUpperCase(),
      nombre: `${vehicle.unidad} - ${vehicle.vehiculo}`,
      horas: vehicle.motorHours.toLocaleString('es-PE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    }));
}

function engineUsageRows(filters) {
  const start = new Date(filters.desde);
  const end = new Date(filters.hasta);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [];

  const selectedVehicles = vehicles.filter((vehicle) => (
    filters.modo === 'grupo'
      ? !filters.grupo || vehicle.tipo === filters.grupo
      : !filters.unidad || vehicle.placa === filters.unidad
  ));
  const cycles = [
    { start: 372 * 60 + 58, duration: 14 * 60 + 52 },
    { start: 400 * 60 + 2, duration: 3 * 60 + 14 },
  ];
  const firstDay = new Date(start);
  firstDay.setHours(0, 0, 0, 0);
  const lastDay = new Date(end);
  lastDay.setHours(0, 0, 0, 0);

  return selectedVehicles.flatMap((vehicle, vehicleIndex) => {
    const rows = [];
    for (const day = new Date(firstDay); day <= lastDay; day.setDate(day.getDate() + 1)) {
      cycles.forEach((cycle, cycleIndex) => {
        const ignitionAt = new Date(day);
        ignitionAt.setSeconds(cycle.start + vehicleIndex * 180);
        const shutdownAt = new Date(ignitionAt.getTime() + (cycle.duration + vehicleIndex * 17) * 1000);
        if (ignitionAt < start || shutdownAt > end) return;
        const elapsedSeconds = Math.floor((shutdownAt.getTime() - ignitionAt.getTime()) / 1000);
        rows.push({
          id: `${vehicle.id}-${day.toISOString().slice(0, 10)}-engine-${cycleIndex}`,
          unidad: vehicle.placa,
          tipo: vehicle.tipo,
          encendido: ignitionAt.toLocaleString('es-PE'),
          direccionEncendido: `${vehicle.ultima_ubicacion}, Pomalca, Chiclayo, Lambayeque, Perú`,
          apagado: shutdownAt.toLocaleString('es-PE'),
          tiempo: `${String(Math.floor(elapsedSeconds / 3600)).padStart(2, '0')}h:${String(Math.floor((elapsedSeconds % 3600) / 60)).padStart(2, '0')}m:${String(elapsedSeconds % 60).padStart(2, '0')}s`,
          direccion: `${vehicle.ultima_ubicacion}, Pomalca, Chiclayo, Lambayeque, Perú`,
          totalSeconds: elapsedSeconds,
          sortAt: ignitionAt.getTime(),
        });
      });
    }
    return [];
  })
    .sort((a, b) => a.sortAt - b.sortAt)
    .map(({ sortAt, ...row }) => row);
}

function basicReportRows(filters) {
  const start = new Date(filters.desde);
  const end = new Date(filters.hasta);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [];

  const selectedVehicles = vehicles.filter((vehicle) => (
    filters.modo === 'grupo'
      ? !filters.grupo || vehicle.tipo === filters.grupo
      : !filters.unidad || vehicle.placa === filters.unidad
  ));
  const reportStart = start.getTime();
  const reportDuration = end.getTime() - reportStart;
  const rowsPerVehicle = 20;

  return selectedVehicles.flatMap((vehicle, vehicleIndex) => (
    Array.from({ length: rowsPerVehicle }, (_, index) => {
      const eventTime = new Date(
        reportStart + (rowsPerVehicle === 1 ? 0 : (reportDuration * index) / (rowsPerVehicle - 1)),
      );
      return {
        id: `${vehicle.id}-basic-${index}`,
        unidad: vehicle.placa,
        evento: index === 0 ? 'Inicio' : 'Estacionado',
        direccion: `${vehicle.ultima_ubicacion}, Pomalca, Chiclayo, Lambayeque, Perú`,
        distancia: '0,00',
        hora: eventTime.toLocaleString('es-PE'),
        velocidad: index === 0 ? vehicle.velocidad_kmh : 0,
        gpsFix: index === 0 ? 'ND' : 'S',
        gpsAge: 0,
        sortAt: eventTime.getTime(),
        vehicleIndex,
      };
    })
  )).sort((a, b) => a.sortAt - b.sortAt || a.vehicleIndex - b.vehicleIndex)
    .map(({ sortAt, vehicleIndex, ...row }) => row);
}

function driverLogRows(filters) {
  const start = new Date(filters.desde);
  const end = new Date(filters.hasta);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [];

  const selectedVehicles = vehicles
    .filter((vehicle) => (
      filters.modo === 'grupo'
        ? !filters.grupo || vehicle.tipo === filters.grupo
        : !filters.unidad || vehicle.placa === filters.unidad
    ))
    .filter((vehicle) => !filters.conductor || vehicle.conductor_id === filters.conductor);
  const eventTemplates = [
    { minutes: 231, evento: 'Travel Start', location: (vehicle) => `${vehicle.ultima_ubicacion}, Pomalca, Perú` },
    { minutes: 232, evento: 'Drive', location: () => 'Av. La Unión, Chiclayo, Lambayeque, Perú' },
    { minutes: 233, evento: 'Drive', location: () => 'Av. La Unión, Zaña, Chiclayo, Lambayeque, Perú' },
    { minutes: 234, evento: 'Geofence IN', location: (vehicle) => `Ingreso a ${vehicle.ultima_ubicacion}, Lambayeque, Perú` },
    { minutes: 235, evento: 'Geofence OUT', location: (vehicle) => `Salida de ${vehicle.ultima_ubicacion}, Lambayeque, Perú` },
    { minutes: 245, evento: 'Drive', location: () => 'Vía Pomalca, Chiclayo, Lambayeque, Perú' },
    { minutes: 246, evento: 'Travel Stop', location: (vehicle) => `${vehicle.ultima_ubicacion}, Pomalca, Perú` },
  ];

  const firstDay = new Date(start);
  firstDay.setHours(0, 0, 0, 0);
  const lastDay = new Date(end);
  lastDay.setHours(0, 0, 0, 0);

  return selectedVehicles.flatMap((vehicle, vehicleIndex) => {
    const dailyEvents = [];
    for (const day = new Date(firstDay); day <= lastDay; day.setDate(day.getDate() + 1)) {
      eventTemplates.forEach((template, eventIndex) => {
        const eventDate = new Date(day);
        eventDate.setMinutes(template.minutes + vehicleIndex * 2);
        if (eventDate < start || eventDate > end) return;
        if (!filters.mostrarTodosEventos && !['Travel Start', 'Drive', 'Travel Stop'].includes(template.evento)) return;
        dailyEvents.push({
          id: `${vehicle.id}-${day.toISOString().slice(0, 10)}-driver-event-${eventIndex}`,
          conductor: vehicle.conductor_nombre,
          conductorId: vehicle.conductor_id,
          unidad: vehicle.placa,
          tipo: vehicle.tipo,
          fecha: eventDate.toLocaleDateString('en-US'),
          hora: eventDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          evento: template.evento,
          ubicacion: template.location(vehicle),
          sortAt: eventDate.getTime(),
        });
      });
    }
    return dailyEvents;
  })
    .sort((a, b) => a.sortAt - b.sortAt)
    .map(({ sortAt, ...row }) => row);
}

function driverStatusRows(filters) {
  const start = new Date(filters.desde);
  const end = new Date(filters.hasta);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [];

  return vehicles
    .filter((vehicle) => !filters.conductor || vehicle.conductor_id === filters.conductor)
    .map((vehicle) => ({
      id: vehicle.id,
      conductor: vehicle.conductor_nombre || 'Sin asignar',
      estado: !vehicle.conductor_nombre
        ? 'Not Assigned'
        : vehicle.velocidad_kmh > 0
          ? 'Driving'
          : vehicle.ignicion
            ? 'Stopped'
            : 'Off Duty',
      tiempo: vehicle.ultima_actualizacion || '—',
    }));
}

function driverTimeCardRows(filters) {
  const start = new Date(filters.desde);
  const end = new Date(filters.hasta);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [];

  return vehicles
    .filter((vehicle) => !filters.conductor || vehicle.conductor_id === filters.conductor)
    .map((vehicle, index) => {
      const distance = 24 + index * 17;
      const breakMinutes = filters.calcularDescansos ? 8 + index * 7 : 0;
      const unpaidBreakMinutes = filters.reducirDescansos && breakMinutes > filters.descansoMinutos
        ? breakMinutes
        : 0;
      const lunchMinutes = filters.mostrarAlmuerzos ? 30 : 0;
      const paidMinutes = Math.max(
        0,
        (7 + (index % 5) * 2) * 60
          - unpaidBreakMinutes
          - (filters.almuerzoNoPagado ? lunchMinutes : 0),
      );
      return {
        id: vehicle.id,
        conductor: vehicle.conductor_nombre || 'Sin asignar',
        desde: start.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        unidad: vehicle.placa,
        estado: vehicle.velocidad_kmh > 0 ? 'Driving' : vehicle.ignicion ? 'Stopped' : 'Off Duty',
        landmark: vehicle.ultima_ubicacion,
        direccion: `${vehicle.ultima_ubicacion}, Pomalca, Lambayeque, Perú`,
        paidTime: `${Math.floor(paidMinutes / 60)}h ${String(paidMinutes % 60).padStart(2, '0')}m`,
        millas: (filters.todasLasDistancias ? distance * 1.15 : Math.min(distance, 40) * 1.15).toFixed(1),
      };
    });
}

function detailedActivityRows(filters) {
  const start = new Date(filters.desde);
  const end = new Date(filters.hasta);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [];

  const asDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    return `${hours}h:${String(minutes).padStart(2, '0')}m:${String(remainingSeconds).padStart(2, '0')}s`;
  };
  const asDateTime = (minutesAfterStart) => {
    const timestamp = Math.min(end.getTime(), start.getTime() + minutesAfterStart * 60_000);
    return new Date(timestamp);
  };

  return vehicles
    .filter((vehicle) => (
      filters.modo === 'grupo'
        ? !filters.grupo || vehicle.tipo === filters.grupo
        : !filters.unidad || vehicle.placa === filters.unidad
    ))
    .filter((vehicle) => !filters.conductor || vehicle.conductor_nombre === filters.conductor)
    .map((vehicle, index) => {
      const maxSpeed = Math.max(vehicle.velocidad_kmh, 18 + index * 5);
      const distance = 16.8 + index * 7.43;
      const travelMinutes = 31 + index * 13;
      const idleMinutes = 18 + index * 11;
      const stoppedMinutes = 12 + (index % 4) * 9;
      const engineSeconds = (travelMinutes + idleMinutes + stoppedMinutes) * 60;
      const location = `${vehicle.ultima_ubicacion}, Chiclayo, Lambayeque`;
      const details = [
        { offset: 0, status: 'Ignición encendida', distance: '0.00' },
        { offset: travelMinutes, status: 'En movimiento', distance: distance.toFixed(2) },
        { offset: travelMinutes + idleMinutes, status: 'Detenido / ralentí', distance: distance.toFixed(2) },
        { offset: travelMinutes + idleMinutes + stoppedMinutes, status: 'Ignición apagada', distance: distance.toFixed(2) },
      ].map((event) => {
        const eventTime = asDateTime(event.offset);
        return {
          fecha: eventTime.toLocaleDateString('es-PE'),
          hora: eventTime.toLocaleTimeString('es-PE'),
          status: event.status,
          distancia: event.distance,
          ubicacion: location,
          estado: 'Lambayeque',
          cp: '14000',
        };
      });

      return {
        id: `ACT-${String(index + 1).padStart(4, '0')}`,
        unidad: vehicle.placa,
        velocidad: maxSpeed,
        resumen: [
          ['Tiempo total', asDuration(engineSeconds)],
          ['Tiempo de viaje', asDuration(travelMinutes * 60)],
          ['Tiempo detenido', asDuration(stoppedMinutes * 60)],
          ['Tiempo de ralentí', asDuration(idleMinutes * 60)],
          ['Distancia total', `${distance.toFixed(2)} km`],
        ],
        detalles: details,
      };
    });
}

function activityRows(filters) {
  const start = new Date(filters.desde);
  const end = new Date(filters.hasta);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [];

  const vehiclesInReport = vehicles
    .filter((vehicle) => (
      filters.modo === 'grupo'
        ? !filters.grupo || vehicle.tipo === filters.grupo
        : !filters.unidad || vehicle.placa === filters.unidad
    ))
    .filter((vehicle) => !filters.conductor || vehicle.conductor_nombre === filters.conductor);
  const rangeMinutes = Math.max(0, Math.floor((end.getTime() - start.getTime()) / 60_000));
  const stopEvents = [
    { event: 'Detenido / ralentí', detention: 35, travel: 0, speed: 0 },
    { event: 'Ralentí', detention: 15, travel: 4, speed: 11 },
    { event: 'Ignición apagada', detention: 1, travel: 3, speed: 14 },
    { event: 'Detenido / ralentí', detention: 0, travel: 0, speed: 0 },
  ];

  return vehiclesInReport.flatMap((vehicle, vehicleIndex) => {
    const recordsPerVehicle = 2;
    return Array.from({ length: recordsPerVehicle }, (_, recordIndex) => {
      const sampleIndex = vehicleIndex * recordsPerVehicle + recordIndex;
      const startOffset = Math.min(rangeMinutes, Math.floor((sampleIndex / Math.max(1, vehiclesInReport.length * recordsPerVehicle)) * rangeMinutes));
      const tripStart = new Date(start.getTime() + startOffset * 60_000);
      const event = stopEvents[sampleIndex % stopEvents.length];
      const travelMinutes = event.travel || 12 + (sampleIndex % 4) * 7;
      const stopAt = new Date(tripStart.getTime() + travelMinutes * 60_000);
      const address = vehicle.ultima_ubicacion.includes('Lote')
        ? `${vehicle.ultima_ubicacion}, Pomalca, Chiclayo, Lambayeque, Perú`
        : `${vehicle.ultima_ubicacion}, Chiclayo, Lambayeque, Perú`;

      return {
        id: `EVT-${String(sampleIndex + 1).padStart(4, '0')}`,
        unidad: vehicle.placa,
        horaInicio: tripStart.toLocaleString('es-PE'),
        tiempoViajado: `${String(Math.floor(travelMinutes / 60)).padStart(2, '0')}:${String(travelMinutes % 60).padStart(2, '0')}:00`,
        distancia: (event.speed === 0 ? 0 : (1.2 + ((sampleIndex * 37) % 600) / 100)).toFixed(2),
        velocidadMaxima: event.speed ?? Math.max(0, Math.min(vehicle.velocidad_kmh || 0, 20 + (sampleIndex * 7) % 45)),
        horaParada: stopAt.toLocaleString('es-PE'),
        eventoParada: event.event,
        tiempoDetenido: `${String(Math.floor(event.detention / 60)).padStart(2, '0')}:${String(event.detention % 60).padStart(2, '0')}:00`,
        direccion: address,
        latitud: vehicle.lat.toFixed(8),
        longitud: vehicle.lng.toFixed(8),
      };
    });
  });
}

function latLonActivityRows(filters) {
  const start = new Date(filters.desde);
  const end = new Date(filters.hasta);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [];

  const selectedVehicles = vehicles
    .filter((vehicle) => (
      filters.modo === 'grupo'
        ? !filters.grupo || vehicle.tipo === filters.grupo
        : !filters.unidad || vehicle.placa === filters.unidad
    ))
    .filter((vehicle) => !filters.conductor || vehicle.conductor_nombre === filters.conductor);
  const rangeMs = end.getTime() - start.getTime();
  const eventTypes = ['Stop', 'Drive', 'Drive', 'Idle-Stop', 'Drive'];

  return selectedVehicles.flatMap((vehicle, vehicleIndex) => (
    eventTypes.map((event, eventIndex) => {
      const eventIndexGlobal = vehicleIndex * eventTypes.length + eventIndex;
      const timestamp = new Date(
        start.getTime() + Math.floor((eventIndexGlobal / Math.max(1, selectedVehicles.length * eventTypes.length)) * rangeMs),
      );
      const latitude = vehicle.lat + (eventIndex * 0.00037);
      const longitude = vehicle.lng - (eventIndex * 0.00029);
      const direction = vehicle.ultima_ubicacion.includes('Lote')
        ? `${vehicle.ultima_ubicacion}, Pomalca, Chiclayo, Lambayeque, Perú`
        : `${vehicle.ultima_ubicacion}, Chiclayo, Lambayeque, Perú`;

      return {
        id: `${vehicle.id}-gps-${eventIndex}`,
        evento: event,
        fechaHora: timestamp.toLocaleString('es-PE'),
        unidad: vehicle.placa,
        direccion: direction,
        latitud: latitude.toFixed(8),
        longitud: longitude.toFixed(8),
      };
    })
  ));
}

function getReportRows(report) {
  if (report.group === 'Alertas y eventos') {
    const rows = alerts.map((alert) => {
      const vehicle = vehicles.find((item) => item.id === alert.vehiculo_id);
      return {
        id: alert.id,
        unidad: vehicle?.placa || alert.vehiculo_id,
        conductor: vehicle?.conductor_nombre || 'Sin asignar',
        fecha: alert.fecha,
        tipo: alert.tipo,
        severidad: alert.severidad,
        origen: alert.origen,
        detalle: alert.mensaje,
        estado: alert.atendida ? 'Atendido' : 'Pendiente',
      };
    });
    if (report.id === 'alertas') return rows;
    if (report.id === 'eventos') return rows;
    const grouped = new Map();
    rows.forEach((row) => {
      const key = `${row.unidad}-${row.tipo}`;
      const previous = grouped.get(key);
      grouped.set(key, {
        unidad: row.unidad,
        conductor: row.conductor,
        tipo: row.tipo,
        cantidad: (previous?.cantidad || 0) + 1,
        ultimoEvento: row.fecha,
        severidad: row.severidad,
      });
    });
    return [...grouped.values()];
  }

  const rows = vehicleRows();
  switch (report.id) {
    case 'rendimiento':
      return rows.map((row) => ({
        ...row,
        rendimiento: row.distancia / Math.max(1, row.motorHours),
      }));
    case 'basico':
      return [];
    case 'uso-motor':
      return [];
    case 'horas-motor':
      return [];
    case 'actividades-sumarizado':
      return rows.map(({ id, unidad, velocidad, distancia, travelTime, idleTime, ignicion }) => ({
        id, unidad, velocidad, distancia, travelTime, idleTime, ignicion,
      }));
    case 'actividades':
      return rows.map(({ fecha, unidad, conductor, estado, ubicacion, velocidad }) => ({
        fecha, unidad, conductor, estado, ubicacion, velocidad,
      }));
    case 'actividades-latlon':
      return rows.map(({ fecha, unidad, conductor, latitud, longitud, velocidad }) => ({
        fecha, unidad, conductor, latitud, longitud, velocidad,
      }));
    case 'actividades-detalladas':
      return rows.map(({ id, fecha, unidad, conductor, tipo, ubicacion, velocidad, odometro }) => ({
        id, fecha, unidad, conductor, tipo, ubicacion, velocidad, odometro,
      }));
    case 'dot-horas':
      return [];
    case 'log-conductores':
    case 'conductores':
      return [];
    case 'estados-conductores':
      return rows.map(({ conductor, unidad, estado, velocidad, ubicacion }) => ({
        conductor, unidad, estado, velocidad, ubicacion,
      }));
    case 'tiempos-conductor':
      return [];
    case 'limite-velocidad':
      return rows.map((row) => ({
        unidad: row.unidad,
        conductor: row.conductor,
        geocerca: row.geocerca,
        velocidad: row.velocidad,
        limite: 40,
        estadoVelocidad: row.velocidad > 40 ? 'Exceso' : 'Dentro del límite',
      }));
    case 'rutas-historicas':
      return [];
    case 'ralenti-eventos':
      return [];
    case 'ralenti':
      return [];
    default:
      return [];
  }
}

function columnsForReport(report) {
  switch (report.id) {
    case 'basico':
      return [['unidad', 'Unidad'], ['evento', 'Evento'], ['direccion', 'Dirección'], ['distancia', 'Distancia (kms)'], ['hora', 'Hora'], ['velocidad', 'Velocidad'], ['gpsFix', 'GPS Fix'], ['gpsAge', 'GPS Age']];
    case 'uso-motor':
      return [['encendido', 'Encendido'], ['direccionEncendido', 'Dirección'], ['apagado', 'Apagado'], ['tiempo', 'Tiempo'], ['direccion', 'Dirección']];
    case 'horas-motor':
      return [['unitId', 'Unit ID'], ['nombre', 'Nombre'], ['horas', 'Horas']];
    case 'actividades-sumarizado':
      return [['id', 'ID'], ['unidad', 'Unidad'], ['velocidad', 'Vel. máx. (km/h)'], ['distancia', 'Distancia (km)'], ['travelTime', 'Tiempo de viaje'], ['idleTime', 'Tiempo en ralentí'], ['ignicion', 'Motor encendido']];
    case 'actividades':
      return [['fecha', 'Fecha demo'], ['unidad', 'Unidad'], ['conductor', 'Conductor'], ['estado', 'Estado'], ['ubicacion', 'Ubicación'], ['velocidad', 'Velocidad (km/h)']];
    case 'actividades-latlon':
      return [['fecha', 'Fecha demo'], ['unidad', 'Unidad'], ['conductor', 'Conductor'], ['latitud', 'Latitud'], ['longitud', 'Longitud'], ['velocidad', 'Velocidad (km/h)']];
    case 'actividades-detalladas':
      return [['id', 'ID vehículo'], ['fecha', 'Fecha demo'], ['unidad', 'Unidad'], ['conductor', 'Conductor'], ['tipo', 'Tipo'], ['ubicacion', 'Ubicación'], ['velocidad', 'Velocidad (km/h)'], ['odometro', 'Odómetro (km)']];
    case 'dot-horas':
      return [['hora', 'Hora'], ['duracion', 'Duración'], ['vehiculo', 'Vehículo'], ['millas', 'Millas'], ['estado', 'Estado'], ['direccion', 'Dirección']];
    case 'log-conductores':
      return [['conductor', 'Conductor'], ['unidad', 'Unidad'], ['entrada', 'Entrada'], ['direccionEntrada', 'Dirección / Landmark'], ['salida', 'Salida'], ['direccionSalida', 'Dirección / Landmark']];
    case 'conductores':
      return [['fecha', 'Date'], ['hora', 'Time'], ['conductor', 'Driver'], ['evento', 'Event'], ['ubicacion', 'Location']];
    case 'estados-conductores':
      return [['conductor', 'Driver'], ['estado', 'Status'], ['tiempo', 'Time']];
    case 'tiempos-conductor':
      return [['desde', 'From'], ['unidad', 'Unit'], ['estado', 'Status'], ['landmark', 'LandMark'], ['direccion', 'Address'], ['paidTime', 'Paid Time'], ['millas', 'Miles']];
    case 'geocercas-entradas':
      return [['unidad', 'Placa'], ['geocerca', 'Geocerca'], ['entradaFecha', 'Entrada'], ['entradaHora', 'Hora de entrada'], ['entradaTurno', 'Turno de entrada'], ['salidaFecha', 'Salida'], ['salidaHora', 'Hora de salida'], ['salidaTurno', 'Turno de salida'], ['duracion', 'Duración']];
    case 'limite-velocidad':
      return [['fechaHora', 'Fecha y hora'], ['geocerca', 'Geocerca'], ['conductor', 'Conductor'], ['velocidad', 'Velocidad (km/h)'], ['limite', 'Límite (km/h)'], ['exceso', 'Exceso (km/h)'], ['duracion', 'Duración'], ['ubicacion', 'Ubicación']];
    case 'rutas-historicas':
      return [['unidad', 'Unidad'], ['conductor', 'Conductor'], ['ruta', 'Ruta'], ['origen', 'Origen'], ['destino', 'Destino'], ['salida', 'Salida'], ['llegada', 'Llegada'], ['distancia', 'Distancia (km)'], ['duracion', 'Duración'], ['velocidadMaxima', 'Velocidad máxima (km/h)']];
    case 'ralenti-eventos':
      return [['unidad', 'Unidad'], ['evento', 'Evento'], ['fechaHora', 'Fecha y hora'], ['ubicacion', 'Ubicación'], ['duracion', 'Duración'], ['velocidad', 'Velocidad'], ['direccion', 'Dirección']];
    case 'ralenti':
      return [['fechaEvento', 'Fecha del evento'], ['direccion', 'Dirección'], ['puntoInteres', 'Punto de interés'], ['duracion', 'Duración'], ['conductor', 'Conductor']];
    case 'alertas':
      return [['id', 'ID alerta'], ['fecha', 'Fecha'], ['unidad', 'Unidad'], ['tipo', 'Alerta'], ['severidad', 'Prioridad'], ['origen', 'Origen'], ['estado', 'Atención'], ['detalle', 'Detalle']];
    case 'eventos':
      return [['evento', 'Evento'], ['fechaEvento', 'Fecha del Evento'], ['direccion', 'Dirección'], ['conductor', 'Conductor'], ['duracion', 'Duración'], ['velocidad', 'Vel'], ['sentido', 'Sent']];
    case 'eventos-resumidos':
      return [['fecha', 'Fecha'], ['totalStop', 'Total Stop'], ['stopPercent', '%'], ['totalIdle', 'Total Idle'], ['idlePercent', '%'], ['totalDrive', 'Total Drive'], ['drivePercent', '%'], ['total', 'Total']];
    default:
      return [['unidad', 'Unidad'], ['vehiculo', 'Vehículo'], ['conductor', 'Conductor'], ['velocidad', 'Vel. máx. (km/h)'], ['distancia', 'Distancia (km)'], ['motorHours', 'H. motor'], ['idleTime', 'H. ralentí']];
  }
}

function csvEscape(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

export default function ReportesPage({ selectedModuleId }) {
  const [selectedReportId, setSelectedReportId] = useState('actividades-sumarizado');
  const [unitFilter, setUnitFilter] = useState('');
  const [driverFilter, setDriverFilter] = useState('');
  const [detailedFilters, setDetailedFilters] = useState(() => ({
    ...currentDayRange(),
    modo: 'grupo',
    grupo: '',
    unidad: '',
    conductor: '',
  }));
  const [appliedDetailedFilters, setAppliedDetailedFilters] = useState(() => detailedFilters);
  const [basicFilters, setBasicFilters] = useState(() => ({
    ...currentDayRange(),
    modo: 'unidad',
    grupo: '',
    unidad: '',
    conductor: '',
  }));
  const [appliedBasicFilters, setAppliedBasicFilters] = useState(() => basicFilters);
  const [dotFilters, setDotFilters] = useState(() => ({
    fecha: currentDateValue(),
    conductor: vehicles[0]?.conductor_id || '',
  }));
  const [appliedDotFilters, setAppliedDotFilters] = useState(() => dotFilters);
  const [driverLogFilters, setDriverLogFilters] = useState(() => ({
    ...currentDayRange(),
    modo: 'unidad',
    grupo: '',
    unidad: '',
    conductor: '',
    reportePor: 'unidad',
    mostrarTodosEventos: true,
  }));
  const [appliedDriverLogFilters, setAppliedDriverLogFilters] = useState(() => driverLogFilters);
  const [driverStatusFilters, setDriverStatusFilters] = useState(() => ({
    ...currentDayRange(),
    conductor: '',
  }));
  const [appliedDriverStatusFilters, setAppliedDriverStatusFilters] = useState(() => driverStatusFilters);
  const [driverTimeCardFilters, setDriverTimeCardFilters] = useState(() => ({
    ...currentDayRange(),
    conductor: '',
    calcularDescansos: true,
    reducirDescansos: true,
    descansoMinutos: 10,
    mostrarAlmuerzos: true,
    almuerzoNoPagado: true,
    todasLasDistancias: false,
  }));
  const [appliedDriverTimeCardFilters, setAppliedDriverTimeCardFilters] = useState(() => driverTimeCardFilters);
  const [engineUsageFilters, setEngineUsageFilters] = useState(() => ({
    ...currentDayRange(),
    modo: 'unidad',
    grupo: '',
    unidad: '',
  }));
  const [appliedEngineUsageFilters, setAppliedEngineUsageFilters] = useState(() => engineUsageFilters);
  const [totalEngineHoursUnit, setTotalEngineHoursUnit] = useState('');
  const [appliedTotalEngineHoursUnit, setAppliedTotalEngineHoursUnit] = useState('');
  const [alertFilters, setAlertFilters] = useState(() => ({
    ...recentDateRange(),
    modo: 'unidad',
    grupo: '',
    unidad: '',
    conductor: '',
  }));
  const [appliedAlertFilters, setAppliedAlertFilters] = useState(() => alertFilters);
  const [eventFilters, setEventFilters] = useState(() => ({
    ...currentDayRange(),
    modo: 'unidad',
    grupo: '',
    unidad: '',
  }));
  const [appliedEventFilters, setAppliedEventFilters] = useState(() => eventFilters);
  const [eventSummaryFilters, setEventSummaryFilters] = useState(() => ({
    ...currentDayRange(),
    modo: 'unidad',
    grupo: '',
    unidad: '',
    vista: 'sumarizado',
  }));
  const [appliedEventSummaryFilters, setAppliedEventSummaryFilters] = useState(() => eventSummaryFilters);
  const [speedLimitFilters, setSpeedLimitFilters] = useState(() => ({
    ...currentDayRange(),
    modo: 'unidad',
    grupo: '',
    unidad: '',
    geocercas: [],
  }));
  const [appliedSpeedLimitFilters, setAppliedSpeedLimitFilters] = useState(() => speedLimitFilters);
  const [geofenceVisitFilters, setGeofenceVisitFilters] = useState(() => ({
    ...currentDayRange(),
    modo: 'grupo',
    grupo: '',
    unidad: '',
    geocercas: [],
    pruebaVisita: true,
  }));
  const [appliedGeofenceVisitFilters, setAppliedGeofenceVisitFilters] = useState(() => geofenceVisitFilters);
  const [historicalRouteFilters, setHistoricalRouteFilters] = useState(() => ({
    ...currentDayRange(),
    modo: 'unidad',
    grupo: '',
    unidad: '',
    ruta: '',
    conductor: '',
  }));
  const [appliedHistoricalRouteFilters, setAppliedHistoricalRouteFilters] = useState(() => historicalRouteFilters);
  const [idleEventFilters, setIdleEventFilters] = useState(() => ({
    ...currentDayRange(),
    modo: 'unidad',
    grupo: '',
    unidad: '',
  }));
  const [appliedIdleEventFilters, setAppliedIdleEventFilters] = useState(() => idleEventFilters);
  const [inactivityFilters, setInactivityFilters] = useState(() => ({
    ...currentDayRange(),
    modo: 'unidad',
    grupo: '',
    unidad: '',
    minutos: '2',
  }));
  const [appliedInactivityFilters, setAppliedInactivityFilters] = useState(() => inactivityFilters);
  const [reportError, setReportError] = useState('');
  const availableGroups = MODULE_REPORT_GROUPS[selectedModuleId] || [];
  const availableReports = useMemo(
    () => REPORTS.filter((item) => availableGroups.includes(item.group)),
    [availableGroups],
  );
  const selectedReport = availableReports.find((item) => item.id === selectedReportId);
  const report = selectedReport || availableReports[0];
  const groups = [...new Set(availableReports.map((item) => item.group))];
  const columns = report ? columnsForReport(report) : [];
  const rows = useMemo(
    () => {
      if (!report) return [];
      if (report.id === 'alertas') return alertReportRows(appliedAlertFilters);
      if (report.id === 'eventos') return eventReportRows(appliedEventFilters);
      if (report.id === 'eventos-resumidos') return eventSummaryRows(appliedEventSummaryFilters);
      if (report.id === 'limite-velocidad') return speedLimitRows(appliedSpeedLimitFilters);
      if (report.id === 'geocercas-entradas') return geofenceVisitRows(appliedGeofenceVisitFilters);
      if (report.id === 'rutas-historicas') return historicalRouteRows(appliedHistoricalRouteFilters);
      if (report.id === 'ralenti-eventos') return idleEventRows(appliedIdleEventFilters);
      if (report.id === 'ralenti') return inactivityRows(appliedInactivityFilters);
      if (report.id === 'basico') return basicReportRows(appliedBasicFilters);
      if (report.id === 'dot-horas') return dotServiceReport(appliedDotFilters);
      if (report.id === 'log-conductores' || report.id === 'conductores') return driverLogRows(appliedDriverLogFilters);
      if (report.id === 'estados-conductores') return driverStatusRows(appliedDriverStatusFilters);
      if (report.id === 'tiempos-conductor') return driverTimeCardRows(appliedDriverTimeCardFilters);
      if (report.id === 'uso-motor') return engineUsageRows(appliedEngineUsageFilters);
      if (report.id === 'horas-motor') return totalEngineHoursRows(appliedTotalEngineHoursUnit);
      if (report.id === 'actividades-detalladas') return detailedActivityRows(appliedDetailedFilters);
      if (report.id === 'actividades') return activityRows(appliedDetailedFilters);
      if (report.id === 'actividades-latlon') return latLonActivityRows(appliedDetailedFilters);
      return getReportRows(report);
    },
    [report, appliedDetailedFilters, appliedBasicFilters, appliedDotFilters, appliedDriverLogFilters, appliedDriverStatusFilters, appliedDriverTimeCardFilters, appliedEngineUsageFilters, appliedTotalEngineHoursUnit, appliedAlertFilters, appliedEventFilters, appliedEventSummaryFilters, appliedSpeedLimitFilters, appliedGeofenceVisitFilters, appliedHistoricalRouteFilters, appliedIdleEventFilters, appliedInactivityFilters],
  );
  const filteredRows = rows.filter((row) => (
    (!unitFilter || row.unidad === unitFilter)
    && (!driverFilter || row.conductor === driverFilter)
  ));

  useEffect(() => {
    if (availableReports.length && !availableReports.some((item) => item.id === selectedReportId)) {
      setSelectedReportId(availableReports[0].id);
    }
  }, [selectedModuleId, availableReports, selectedReportId]);

  useEffect(() => {
    setUnitFilter('');
    setDriverFilter('');
    setReportError('');
  }, [selectedModuleId]);

  const updateDetailedFilter = (key, value) => {
    setDetailedFilters((current) => ({ ...current, [key]: value }));
    setReportError('');
  };

  const updateDateRange = (setFilters, range) => {
    const now = new Date();
    const start = new Date(now);
    const end = new Date(now);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 0, 0);

    if (range === 'yesterday') {
      start.setDate(start.getDate() - 1);
      end.setDate(end.getDate() - 1);
    } else if (range === 'this-week') {
      const daysSinceMonday = (start.getDay() + 6) % 7;
      start.setDate(start.getDate() - daysSinceMonday);
    } else if (range === 'previous-week') {
      const daysSinceMonday = (start.getDay() + 6) % 7;
      start.setDate(start.getDate() - daysSinceMonday - 7);
      end.setTime(start.getTime());
      end.setDate(end.getDate() + 6);
      end.setHours(23, 59, 0, 0);
    }

    setFilters((current) => ({
      ...current,
      desde: toLocalDateTimeValue(start),
      hasta: toLocalDateTimeValue(end),
    }));
    setReportError('');
  };

  const executeDetailedReport = () => {
    const start = new Date(detailedFilters.desde);
    const end = new Date(detailedFilters.hasta);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
      setReportError('Ingresa un rango de fechas válido; la fecha inicial debe ser anterior a la fecha final.');
      return;
    }
    setAppliedDetailedFilters(detailedFilters);
    setReportError('');
  };

  const executeBasicReport = () => {
    const start = new Date(basicFilters.desde);
    const end = new Date(basicFilters.hasta);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
      setReportError('Ingresa un rango de fechas válido; la fecha inicial debe ser anterior a la fecha final.');
      return;
    }
    setAppliedBasicFilters(basicFilters);
    setReportError('');
  };

  const executeDotReport = () => {
    if (!dotFilters.fecha || Number.isNaN(new Date(`${dotFilters.fecha}T00:00:00`).getTime())) {
      setReportError('Selecciona una fecha válida para generar el reporte DOT.');
      return;
    }
    setAppliedDotFilters(dotFilters);
    setReportError('');
  };

  const executeDriverLogReport = () => {
    const start = new Date(driverLogFilters.desde);
    const end = new Date(driverLogFilters.hasta);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
      setReportError('Ingresa un rango de fechas válido; la fecha inicial debe ser anterior a la fecha final.');
      return;
    }
    setAppliedDriverLogFilters(driverLogFilters);
    setReportError('');
  };

  const executeDriverStatusReport = () => {
    const start = new Date(driverStatusFilters.desde);
    const end = new Date(driverStatusFilters.hasta);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
      setReportError('Ingresa un rango de fechas válido; la fecha inicial debe ser anterior a la fecha final.');
      return;
    }
    setAppliedDriverStatusFilters(driverStatusFilters);
    setReportError('');
  };

  const executeDriverTimeCardReport = () => {
    const start = new Date(driverTimeCardFilters.desde);
    const end = new Date(driverTimeCardFilters.hasta);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
      setReportError('Ingresa un rango de fechas válido; la fecha inicial debe ser anterior a la fecha final.');
      return;
    }
    if (driverTimeCardFilters.reducirDescansos && (
      Number.isNaN(Number(driverTimeCardFilters.descansoMinutos))
      || Number(driverTimeCardFilters.descansoMinutos) < 0
    )) {
      setReportError('Ingresa una cantidad válida de minutos para reducir los descansos.');
      return;
    }
    setAppliedDriverTimeCardFilters(driverTimeCardFilters);
    setReportError('');
  };

  const executeEngineUsageReport = () => {
    const start = new Date(engineUsageFilters.desde);
    const end = new Date(engineUsageFilters.hasta);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
      setReportError('Ingresa un rango de fechas válido; la fecha inicial debe ser anterior a la fecha final.');
      return;
    }
    setAppliedEngineUsageFilters(engineUsageFilters);
    setReportError('');
  };

  const executeTotalEngineHoursReport = () => {
    setAppliedTotalEngineHoursUnit(totalEngineHoursUnit);
    setReportError('');
  };

  const executeAlertReport = () => {
    const start = new Date(alertFilters.desde);
    const end = new Date(alertFilters.hasta);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
      setReportError('Ingresa un rango de fechas válido; la fecha inicial debe ser anterior a la fecha final.');
      return;
    }
    setAppliedAlertFilters(alertFilters);
    setReportError('');
  };

  const executeEventReport = () => {
    const start = new Date(eventFilters.desde);
    const end = new Date(eventFilters.hasta);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
      setReportError('Ingresa un rango de fechas válido; la fecha inicial debe ser anterior a la fecha final.');
      return;
    }
    setAppliedEventFilters(eventFilters);
    setReportError('');
  };

  const executeEventSummaryReport = () => {
    const start = new Date(eventSummaryFilters.desde);
    const end = new Date(eventSummaryFilters.hasta);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
      setReportError('Ingresa un rango de fechas válido; la fecha inicial debe ser anterior a la fecha final.');
      return;
    }
    setAppliedEventSummaryFilters(eventSummaryFilters);
    setReportError('');
  };

  const executeSpeedLimitReport = () => {
    const start = new Date(speedLimitFilters.desde);
    const end = new Date(speedLimitFilters.hasta);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
      setReportError('Ingresa un rango de fechas válido; la fecha inicial debe ser anterior a la fecha final.');
      return;
    }
    setAppliedSpeedLimitFilters(speedLimitFilters);
    setReportError('');
  };

  const executeGeofenceVisitReport = () => {
    const start = new Date(geofenceVisitFilters.desde);
    const end = new Date(geofenceVisitFilters.hasta);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
      setReportError('Ingresa un rango de fechas válido; la fecha inicial debe ser anterior a la fecha final.');
      return;
    }
    setAppliedGeofenceVisitFilters(geofenceVisitFilters);
    setReportError('');
  };

  const executeHistoricalRouteReport = () => {
    const start = new Date(historicalRouteFilters.desde);
    const end = new Date(historicalRouteFilters.hasta);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
      setReportError('Ingresa un rango de fechas válido; la fecha inicial debe ser anterior a la fecha final.');
      return;
    }
    setAppliedHistoricalRouteFilters(historicalRouteFilters);
    setReportError('');
  };

  const executeIdleEventReport = () => {
    const start = new Date(idleEventFilters.desde);
    const end = new Date(idleEventFilters.hasta);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
      setReportError('Ingresa un rango de fechas válido; la fecha inicial debe ser anterior a la fecha final.');
      return;
    }
    setAppliedIdleEventFilters(idleEventFilters);
    setReportError('');
  };

  const executeInactivityReport = () => {
    const start = new Date(inactivityFilters.desde);
    const end = new Date(inactivityFilters.hasta);
    const minimumMinutes = Number(inactivityFilters.minutos);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
      setReportError('Ingresa un rango de fechas válido; la fecha inicial debe ser anterior a la fecha final.');
      return;
    }
    if (!Number.isFinite(minimumMinutes) || minimumMinutes < 0) {
      setReportError('Ingresa una cantidad válida de minutos para filtrar el tiempo de inactividad.');
      return;
    }
    setAppliedInactivityFilters(inactivityFilters);
    setReportError('');
  };

  const updateReportFilter = (key, value) => {
    if (report?.id === 'ralenti') {
      setInactivityFilters((current) => ({ ...current, [key]: value }));
      setReportError('');
      return;
    }
    if (report?.id === 'ralenti-eventos') {
      setIdleEventFilters((current) => ({ ...current, [key]: value }));
      setReportError('');
      return;
    }
    if (report?.id === 'rutas-historicas') {
      setHistoricalRouteFilters((current) => ({ ...current, [key]: value }));
      setReportError('');
      return;
    }
    if (report?.id === 'geocercas-entradas') {
      setGeofenceVisitFilters((current) => ({ ...current, [key]: value }));
      setReportError('');
      return;
    }
    if (report?.id === 'limite-velocidad') {
      setSpeedLimitFilters((current) => ({ ...current, [key]: value }));
      setReportError('');
      return;
    }
    if (report?.id === 'eventos-resumidos') {
      setEventSummaryFilters((current) => ({ ...current, [key]: value }));
      setReportError('');
      return;
    }
    if (report?.id === 'alertas') {
      setAlertFilters((current) => ({ ...current, [key]: value }));
      setReportError('');
      return;
    }
    if (report?.id === 'eventos') {
      setEventFilters((current) => ({ ...current, [key]: value }));
      setReportError('');
      return;
    }
    if (report?.id === 'basico') {
      setBasicFilters((current) => ({ ...current, [key]: value }));
      setReportError('');
      return;
    }
    if (report?.id === 'dot-horas') {
      setDotFilters((current) => ({ ...current, [key]: value }));
      setReportError('');
      return;
    }
    if (report?.id === 'log-conductores' || report?.id === 'conductores') {
      setDriverLogFilters((current) => ({ ...current, [key]: value }));
      setReportError('');
      return;
    }
    if (report?.id === 'estados-conductores') {
      setDriverStatusFilters((current) => ({ ...current, [key]: value }));
      setReportError('');
      return;
    }
    if (report?.id === 'tiempos-conductor') {
      setDriverTimeCardFilters((current) => ({ ...current, [key]: value }));
      setReportError('');
      return;
    }
    if (report?.id === 'uso-motor') {
      setEngineUsageFilters((current) => ({ ...current, [key]: value }));
      setReportError('');
      return;
    }
    if (report?.id === 'horas-motor') {
      setTotalEngineHoursUnit(value);
      setReportError('');
      return;
    }
    updateDetailedFilter(key, value);
  };

  const setReportQuickDateRange = (range) => {
    if (report?.id === 'ralenti') {
      updateDateRange(setInactivityFilters, range);
      return;
    }
    if (report?.id === 'ralenti-eventos') {
      updateDateRange(setIdleEventFilters, range);
      return;
    }
    if (report?.id === 'rutas-historicas') {
      updateDateRange(setHistoricalRouteFilters, range);
      return;
    }
    if (report?.id === 'geocercas-entradas') {
      updateDateRange(setGeofenceVisitFilters, range);
      return;
    }
    if (report?.id === 'limite-velocidad') {
      updateDateRange(setSpeedLimitFilters, range);
      return;
    }
    if (report?.id === 'eventos-resumidos') {
      updateDateRange(setEventSummaryFilters, range);
      return;
    }
    if (report?.id === 'eventos') {
      updateDateRange(setEventFilters, range);
      return;
    }
    if (report?.id === 'alertas') {
      updateDateRange(setAlertFilters, range);
      return;
    }
    if (report?.id === 'basico') {
      updateDateRange(setBasicFilters, range);
      return;
    }
    if (report?.id === 'log-conductores' || report?.id === 'conductores') {
      updateDateRange(setDriverLogFilters, range);
      return;
    }
    if (report?.id === 'estados-conductores') {
      updateDateRange(setDriverStatusFilters, range);
      return;
    }
    if (report?.id === 'tiempos-conductor') {
      updateDateRange(setDriverTimeCardFilters, range);
      return;
    }
    if (report?.id === 'uso-motor') {
      updateDateRange(setEngineUsageFilters, range);
      return;
    }
    updateDateRange(setDetailedFilters, range);
  };

  const executeReport = () => {
    if (report?.id === 'ralenti') {
      executeInactivityReport();
      return;
    }
    if (report?.id === 'ralenti-eventos') {
      executeIdleEventReport();
      return;
    }
    if (report?.id === 'rutas-historicas') {
      executeHistoricalRouteReport();
      return;
    }
    if (report?.id === 'geocercas-entradas') {
      executeGeofenceVisitReport();
      return;
    }
    if (report?.id === 'limite-velocidad') {
      executeSpeedLimitReport();
      return;
    }
    if (report?.id === 'eventos-resumidos') {
      executeEventSummaryReport();
      return;
    }
    if (report?.id === 'eventos') {
      executeEventReport();
      return;
    }
    if (report?.id === 'alertas') {
      executeAlertReport();
      return;
    }
    if (report?.id === 'basico') {
      executeBasicReport();
      return;
    }
    if (report?.id === 'dot-horas') {
      executeDotReport();
      return;
    }
    if (report?.id === 'log-conductores' || report?.id === 'conductores') {
      executeDriverLogReport();
      return;
    }
    if (report?.id === 'estados-conductores') {
      executeDriverStatusReport();
      return;
    }
    if (report?.id === 'tiempos-conductor') {
      executeDriverTimeCardReport();
      return;
    }
    if (report?.id === 'uso-motor') {
      executeEngineUsageReport();
      return;
    }
    if (report?.id === 'horas-motor') {
      executeTotalEngineHoursReport();
      return;
    }
    executeDetailedReport();
  };

  const exportCsv = () => {
    const exportColumns = isAlertReport
      ? alertCsvColumns
      : isSpeedLimitReport
        ? [['unidad', 'Unidad'], ...columns]
      : isEventSummaryReport
        ? [['unidad', 'Unidad'], ...columns]
      : isEventReport
        ? [['unidad', 'Unidad'], ...columns]
      : isDriverLogReport
        ? driverLogCsvColumns
      : isDriverStatusReport
        ? columns
      : isDriverTimeCardReport
        ? [['conductor', 'Driver'], ...columns]
      : isEngineUsageReport
        ? columns
      : isTotalEngineHoursReport
        ? columns
      : isDotReport
        ? dotCsvColumns
      : isLatLonActivityReport
      ? latLonActivityColumns
      : isActivityReport
        ? activityColumns
        : isDetailedActivities
          ? detailedCsvColumns
          : columns;
    const exportRows = isAlertReport
      ? alertRows
      : isSpeedLimitReport
        ? speedLimitReportRows
      : isEventSummaryReport
        ? eventSummaryExportRows
      : isEventReport
        ? eventReportData
      : isDriverLogReport
        ? driverLogRowsData
      : isDriverStatusReport
        ? driverStatusReportRows
      : isDriverTimeCardReport
        ? driverTimeCardReportRows
      : isEngineUsageReport
        ? engineUsageReportRows
      : isTotalEngineHoursReport
        ? totalEngineHoursReportRows
      : isDotReport
        ? dotEvents
      : isLatLonActivityReport
      ? latLonActivityReportRows
      : isActivityReport
        ? activityReportRows
        : isDetailedActivities
          ? detailedEventRows
          : filteredRows;
    if (exportRows.length === 0) return;
    const content = [
      exportColumns.map(([, label]) => csvEscape(label)).join(','),
      ...exportRows.map((row) => exportColumns.map(([key]) => csvEscape(row[key])).join(',')),
    ].join('\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF', content], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `reporte-${report.id}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const isDetailedActivities = report?.id === 'actividades-detalladas';
  const isActivityReport = report?.id === 'actividades';
  const isLatLonActivityReport = report?.id === 'actividades-latlon';
  const isAlertReport = report?.id === 'alertas';
  const isEventReport = report?.id === 'eventos';
  const isEventSummaryReport = report?.id === 'eventos-resumidos';
  const isSpeedLimitReport = report?.id === 'limite-velocidad';
  const isGeofenceVisitReport = report?.id === 'geocercas-entradas';
  const isHistoricalRouteReport = report?.id === 'rutas-historicas';
  const isIdleEventReport = report?.id === 'ralenti-eventos';
  const isInactivityReport = report?.id === 'ralenti';
  const isBasicReport = report?.id === 'basico';
  const isDotReport = report?.id === 'dot-horas';
  const isDriverLogReport = report?.id === 'log-conductores' || report?.id === 'conductores';
  const isDriverStatusReport = report?.id === 'estados-conductores';
  const isDriverTimeCardReport = report?.id === 'tiempos-conductor';
  const isEngineUsageReport = report?.id === 'uso-motor';
  const isTotalEngineHoursReport = report?.id === 'horas-motor';
  const usesTripFilters = isDetailedActivities || isActivityReport || isLatLonActivityReport;
  const usesDateFilters = usesTripFilters || isAlertReport || isEventReport || isEventSummaryReport || isSpeedLimitReport || isGeofenceVisitReport || isHistoricalRouteReport || isIdleEventReport || isInactivityReport || isBasicReport || isDriverLogReport;
  const activeFilters = isAlertReport ? alertFilters : isEventReport ? eventFilters : isEventSummaryReport ? eventSummaryFilters : isSpeedLimitReport ? speedLimitFilters : isGeofenceVisitReport ? geofenceVisitFilters : isHistoricalRouteReport ? historicalRouteFilters : isIdleEventReport ? idleEventFilters : isInactivityReport ? inactivityFilters : isBasicReport ? basicFilters : isDriverLogReport ? driverLogFilters : detailedFilters;
  const activeAppliedFilters = isAlertReport ? appliedAlertFilters : isEventReport ? appliedEventFilters : isEventSummaryReport ? appliedEventSummaryFilters : isSpeedLimitReport ? appliedSpeedLimitFilters : isGeofenceVisitReport ? appliedGeofenceVisitFilters : isHistoricalRouteReport ? appliedHistoricalRouteFilters : isIdleEventReport ? appliedIdleEventFilters : isInactivityReport ? appliedInactivityFilters : isBasicReport ? appliedBasicFilters : isDriverLogReport ? appliedDriverLogFilters : appliedDetailedFilters;
  const activityColumns = [
    ['horaInicio', 'Hora de inicio'],
    ['tiempoViajado', 'Tiempo viajado'],
    ['distancia', 'Distancia conducida (km)'],
    ['velocidadMaxima', 'Vel. máxima (km/h)'],
    ['horaParada', 'Hora de parada'],
    ['eventoParada', 'Evento de parada'],
    ['tiempoDetenido', 'Tiempo detenido'],
    ['direccion', 'Dirección'],
    ['latitud', 'Latitud'],
    ['longitud', 'Longitud'],
  ];
  const latLonActivityColumns = [
    ['evento', 'Evento'],
    ['fechaHora', 'Fecha y hora'],
    ['unidad', 'Unidad'],
    ['direccion', 'Dirección'],
    ['latitud', 'Latitud'],
    ['longitud', 'Longitud'],
  ];
  const detailedEventColumns = [
    ['fecha', 'Fecha'],
    ['hora', 'Hora'],
    ['status', 'Status'],
    ['distancia', 'Distancia'],
    ['ubicacion', 'Ubicación'],
    ['estado', 'Estado'],
    ['cp', 'CP'],
  ];
  const detailedCsvColumns = [['unidad', 'Unidad'], ...detailedEventColumns];
  const dotCsvColumns = [['conductor', 'Conductor'], ['unidad', 'Unidad'], ...columns];
  const driverLogCsvColumns = [
    ['unidad', 'Unidad'],
    ['fecha', 'Date'],
    ['hora', 'Time'],
    ['conductor', 'Driver'],
    ['evento', 'Event'],
    ['ubicacion', 'Location'],
  ];
  const driverLogTableColumns = driverLogCsvColumns.filter(([key]) => key !== 'unidad');
  const alertCsvColumns = [
    ['unidad', 'Unidad'],
    ['categoria', 'Tipo de alerta'],
    ['fechaEvento', 'Fecha evento'],
    ['ubicacion', 'Ubicación alerta'],
    ['conductor', 'Conductor'],
    ['detalle', 'Detalle'],
  ];
  const detailedRows = isDetailedActivities ? rows : [];
  const detailedEventRows = detailedRows.flatMap((vehicleReport) => (
    vehicleReport.detalles.map((detail) => ({ unidad: vehicleReport.unidad, ...detail }))
  ));
  const activityReportRows = isActivityReport ? rows : [];
  const latLonActivityReportRows = isLatLonActivityReport ? rows : [];
  const alertRows = isAlertReport ? rows : [];
  const speedLimitReportRows = isSpeedLimitReport ? rows : [];
  const geofenceVisitReportRows = isGeofenceVisitReport ? rows : [];
  const eventReportData = isEventReport ? rows : [];
  const eventSummaryData = isEventSummaryReport ? rows : [];
  const eventReportGroups = [...new Set(eventReportData.map((row) => row.unidad))]
    .map((unidad) => ({
      unidad,
      tipo: eventReportData.find((row) => row.unidad === unidad)?.tipo,
      rows: eventReportData.filter((row) => row.unidad === unidad),
    }));
  const speedLimitGroups = [...new Set(speedLimitReportRows.map((row) => row.unidad))]
    .map((unidad) => ({
      unidad,
      tipo: speedLimitReportRows.find((row) => row.unidad === unidad)?.tipo,
      rows: speedLimitReportRows.filter((row) => row.unidad === unidad),
    }));
  const geofenceVisitGroups = [...new Set(geofenceVisitReportRows.map((row) => row.unidad))]
    .map((unidad) => ({
      unidad,
      tipo: geofenceVisitReportRows.find((row) => row.unidad === unidad)?.tipo,
      rows: geofenceVisitReportRows.filter((row) => row.unidad === unidad),
    }));
  const idleEventGroups = [...new Set(filteredRows.map((row) => row.unidad))]
    .map((unidad) => ({
      unidad,
      tipo: filteredRows.find((row) => row.unidad === unidad)?.tipo,
      rows: filteredRows.filter((row) => row.unidad === unidad),
    }));
  const inactivityGroups = isInactivityReport
    ? [...new Set(filteredRows.map((row) => row.unidad))].map((unidad) => {
      const groupRows = filteredRows.filter((row) => row.unidad === unidad);
      const durations = groupRows.map((row) => row.duracionSegundos);
      const totalSeconds = durations.reduce((total, seconds) => total + seconds, 0);
      return {
        unidad,
        tipo: groupRows[0]?.tipo,
        rows: groupRows,
        stops: groupRows.length,
        maximum: formatEventDuration(Math.max(...durations)),
        minimum: formatEventDuration(Math.min(...durations)),
        total: formatEventDuration(totalSeconds),
      };
    })
    : [];
  const eventSummaryGroups = [...new Set(eventSummaryData.map((row) => row.unidad))]
    .map((unidad) => {
      const sourceRows = eventSummaryData.filter((row) => row.unidad === unidad);
      const rows = appliedEventSummaryFilters.vista === 'diario'
        ? sourceRows.map((row) => ({
          ...row,
          totalStop: formatEventDuration(row.totalStopSeconds),
          totalIdle: formatEventDuration(row.totalIdleSeconds),
          totalDrive: formatEventDuration(row.totalDriveSeconds),
          total: formatEventDuration(row.totalSeconds),
          stopPercent: `${row.stopPercent.toFixed(1)}%`,
          idlePercent: `${row.idlePercent.toFixed(1)}%`,
          drivePercent: `${row.drivePercent.toFixed(1)}%`,
        }))
        : (() => {
          const totals = sourceRows.reduce((summary, row) => ({
            stop: summary.stop + row.totalStopSeconds,
            idle: summary.idle + row.totalIdleSeconds,
            drive: summary.drive + row.totalDriveSeconds,
            total: summary.total + row.totalSeconds,
          }), { stop: 0, idle: 0, drive: 0, total: 0 });
          return [{
            id: `${unidad}-summary`,
            fecha: 'Total',
            totalStop: formatEventDuration(totals.stop),
            totalIdle: formatEventDuration(totals.idle),
            totalDrive: formatEventDuration(totals.drive),
            total: formatEventDuration(totals.total),
            stopPercent: totals.total ? `${(totals.stop / totals.total * 100).toFixed(1)}%` : '0.0%',
            idlePercent: totals.total ? `${(totals.idle / totals.total * 100).toFixed(1)}%` : '0.0%',
            drivePercent: totals.total ? `${(totals.drive / totals.total * 100).toFixed(1)}%` : '0.0%',
          }];
        })();
      return {
        unidad,
        tipo: sourceRows[0]?.tipo,
        rows,
      };
    });
  const eventSummaryExportRows = eventSummaryGroups.flatMap((group) => group.rows.map((row) => ({
    ...row,
    unidad: group.unidad,
  })));
  const dotRows = isDotReport ? rows : [];
  const dotEvents = dotRows.flatMap((driverReport) => (
    driverReport.entries.map((entry) => ({
      conductor: driverReport.conductor,
      unidad: driverReport.unidad,
      ...entry,
    }))
  ));
  const driverLogRowsData = isDriverLogReport ? rows : [];
  const driverStatusReportRows = isDriverStatusReport ? rows : [];
  const driverTimeCardReportRows = isDriverTimeCardReport ? rows : [];
  const engineUsageReportRows = isEngineUsageReport ? rows : [];
  const totalEngineHoursReportRows = isTotalEngineHoursReport ? rows : [];
  const driverTimeCardGroups = [...new Set(driverTimeCardReportRows.map((row) => row.conductor))]
    .map((conductor) => ({
      conductor,
      rows: driverTimeCardReportRows.filter((row) => row.conductor === conductor),
    }));
  const engineUsageGroups = [...new Set(engineUsageReportRows.map((row) => row.unidad))]
    .map((unidad) => {
      const groupRows = engineUsageReportRows.filter((row) => row.unidad === unidad);
      const totalSeconds = groupRows.reduce((total, row) => total + row.totalSeconds, 0);
      return {
        unidad,
        tipo: groupRows[0]?.tipo,
        rows: groupRows,
        total: `${String(Math.floor(totalSeconds / 3600)).padStart(2, '0')}h:${String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0')}m:${String(totalSeconds % 60).padStart(2, '0')}s`,
      };
    });
  const driverLogGroups = [...new Set(driverLogRowsData.map((row) => (
    appliedDriverLogFilters.reportePor === 'conductor' ? row.conductor : row.unidad
  )))].map((groupLabel) => ({
    label: groupLabel,
    rows: driverLogRowsData.filter((row) => (
      (appliedDriverLogFilters.reportePor === 'conductor' ? row.conductor : row.unidad) === groupLabel
    )),
  }));
  const alertGroups = [...new Set(alertRows.map((row) => row.unidad))].map((unidad) => ({
    unidad,
    categories: [...new Set(alertRows.filter((row) => row.unidad === unidad).map((row) => row.categoria))]
      .map((categoria) => ({
        categoria,
        rows: alertRows.filter((row) => row.unidad === unidad && row.categoria === categoria),
      })),
  }));
  const uniqueVehicleGroups = [...new Set(vehicles.map((vehicle) => vehicle.tipo))];
  const displayColumns = isLatLonActivityReport
    ? latLonActivityColumns
    : isActivityReport
      ? activityColumns
      : isDetailedActivities
        ? detailedEventColumns
        : columns;
  const displayRows = isLatLonActivityReport
    ? latLonActivityReportRows
    : isActivityReport
      ? activityReportRows
      : isDetailedActivities
        ? detailedEventRows
        : filteredRows;

  return (
    <section className="space-y-4" aria-labelledby="fleet-reports-heading">
      <header className="bg-white rounded-2xl border border-slate-200/80 shadow-subtle px-4 py-3 flex flex-wrap items-center gap-3">
        <Library size={20} className="text-emerald-600" />
        <h2 id="fleet-reports-heading" className="text-lg font-bold text-slate-900">Reportes de flota</h2>
        <p className="text-sm text-slate-500">Reportes del módulo seleccionado: {selectedModuleId === 'flota' ? 'rendimientos, actividades y conductores' : selectedModuleId === 'geocercas' ? 'geocercas, rutas y ralentí' : selectedModuleId === 'alertas' ? 'alertas y eventos' : 'sin reportes disponibles'}.</p>
        <span className="ml-auto px-2 py-1 text-[9px] font-bold uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200 rounded-md">Datos demo</span>
      </header>

      <div className="fleet-reports-layout">
        <nav className="bg-white rounded-2xl border border-slate-200/80 shadow-subtle p-3" aria-label="Reportes disponibles">
          <h3 className="px-2 py-2 text-xs font-bold uppercase tracking-wider text-slate-500">Reportes disponibles</h3>
          <div className="space-y-3 max-h-[620px] overflow-y-auto pr-1">
            {groups.map((group) => (
              <div key={group}>
                <h4 className="px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">{group}</h4>
                <div className="space-y-0.5">
                  {availableReports.filter((item) => item.group === group).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedReportId(item.id)}
                      aria-current={selectedReportId === item.id ? 'page' : undefined}
                      className={`w-full text-left px-2.5 py-2 rounded-lg text-xs transition-colors ${
                        selectedReportId === item.id ? 'bg-forest text-white font-semibold' : 'text-slate-600 hover:bg-emerald-50 hover:text-forest'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </nav>

        {report ? (
          <div className="min-w-0 space-y-4">
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-subtle">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{report.group}</p>
                  <h3 className="text-base font-bold text-slate-900">{report.label}</h3>
                </div>
                {!usesTripFilters ? (
                  <button type="button" onClick={exportCsv} disabled={isDriverStatusReport ? !driverStatusReportRows.length : isDriverTimeCardReport ? !driverTimeCardReportRows.length : isEngineUsageReport ? !engineUsageReportRows.length : isTotalEngineHoursReport ? !totalEngineHoursReportRows.length : isSpeedLimitReport ? !speedLimitReportRows.length : !filteredRows.length} className="inline-flex items-center gap-2 rounded-lg bg-forest px-3 py-2 text-xs font-semibold text-white hover:bg-forest-dark disabled:cursor-not-allowed disabled:opacity-50">
                    <Download size={14} /> Exportar CSV
                  </button>
                ) : null}
              </div>
              {isDotReport ? (
                <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-3">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Conductor
                    <select
                      value={dotFilters.conductor}
                      onChange={(event) => updateReportFilter('conductor', event.target.value)}
                      className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-700"
                    >
                      <option value="">Todos los conductores</option>
                      {vehicles.map((vehicle) => <option key={vehicle.conductor_id} value={vehicle.conductor_id}>{vehicle.conductor_nombre}</option>)}
                    </select>
                  </label>
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Día
                    <input type="date" value={dotFilters.fecha} onChange={(event) => updateReportFilter('fecha', event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-700" />
                  </label>
                  <button type="button" onClick={executeReport} className="rounded-lg bg-forest px-4 py-2 text-xs font-semibold text-white hover:bg-forest-dark">Ejecutar reporte</button>
                  {reportError ? <p className="text-xs text-red-600 sm:col-span-3" role="alert">{reportError}</p> : null}
                </div>
              ) : isInactivityReport ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-600">
                    <span className="font-semibold">Mostrar:</span>
                    {[
                      { value: 'grupo', label: 'Grupos' },
                      { value: 'unidad', label: 'Unidades' },
                    ].map((option) => (
                      <label key={option.value} className="inline-flex items-center gap-1.5">
                        <input
                          type="radio"
                          name="inactivity-mode"
                          checked={inactivityFilters.modo === option.value}
                          onChange={() => updateReportFilter('modo', option.value)}
                          className="accent-forest"
                        />
                        {option.label}
                      </label>
                    ))}
                    {inactivityFilters.modo === 'grupo' ? (
                      <select aria-label="Grupo de vehículos" value={inactivityFilters.grupo} onChange={(event) => updateReportFilter('grupo', event.target.value)} className="min-w-48 rounded-lg border border-slate-200 px-3 py-1.5">
                        <option value="">Todos los grupos</option>
                        {uniqueVehicleGroups.map((group) => <option key={group} value={group}>{group}</option>)}
                      </select>
                    ) : (
                      <select aria-label="Unidad" value={inactivityFilters.unidad} onChange={(event) => updateReportFilter('unidad', event.target.value)} className="min-w-48 rounded-lg border border-slate-200 px-3 py-1.5">
                        <option value="">Todas las unidades</option>
                        {vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.placa}>{vehicle.placa} - {vehicle.modelo}</option>)}
                      </select>
                    )}
                  </div>
                  <div className="grid items-end gap-3 xl:grid-cols-[minmax(0,1fr)_auto]">
                    <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                      <label className="min-w-0 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        Desde
                        <input type="datetime-local" value={inactivityFilters.desde} onChange={(event) => updateReportFilter('desde', event.target.value)} className="mt-1 block min-w-0 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-normal normal-case tracking-normal text-slate-700" />
                      </label>
                      <label className="min-w-0 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        Hasta
                        <input type="datetime-local" value={inactivityFilters.hasta} onChange={(event) => updateReportFilter('hasta', event.target.value)} className="mt-1 block min-w-0 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-normal normal-case tracking-normal text-slate-700" />
                      </label>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button type="button" onClick={() => setReportQuickDateRange('today')} className="rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">Hoy</button>
                      <button type="button" onClick={() => setReportQuickDateRange('yesterday')} className="rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">Ayer</button>
                      <button type="button" onClick={() => setReportQuickDateRange('this-week')} className="rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">Esta semana</button>
                      <button type="button" onClick={() => setReportQuickDateRange('previous-week')} className="rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">Semana anterior</button>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <label className="block w-40 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      Minutos mínimos
                      <input type="number" min="0" step="1" value={inactivityFilters.minutos} onChange={(event) => updateReportFilter('minutos', event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-normal normal-case tracking-normal text-slate-700" />
                    </label>
                    <button type="button" onClick={executeReport} className="rounded-lg bg-forest px-4 py-2 text-xs font-semibold text-white hover:bg-forest-dark">Ejecutar reporte</button>
                  </div>
                  {reportError ? <p className="text-xs text-red-600" role="alert">{reportError}</p> : null}
                </div>
              ) : isIdleEventReport ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-600">
                    <span className="font-semibold">Mostrar:</span>
                    {[
                      { value: 'grupo', label: 'Grupos' },
                      { value: 'unidad', label: 'Unidades' },
                    ].map((option) => (
                      <label key={option.value} className="inline-flex items-center gap-1.5">
                        <input
                          type="radio"
                          name="idle-events-mode"
                          checked={idleEventFilters.modo === option.value}
                          onChange={() => updateReportFilter('modo', option.value)}
                          className="accent-forest"
                        />
                        {option.label}
                      </label>
                    ))}
                    {idleEventFilters.modo === 'grupo' ? (
                      <select aria-label="Grupo de vehículos" value={idleEventFilters.grupo} onChange={(event) => updateReportFilter('grupo', event.target.value)} className="min-w-48 rounded-lg border border-slate-200 px-3 py-1.5">
                        <option value="">Todos los grupos</option>
                        {uniqueVehicleGroups.map((group) => <option key={group} value={group}>{group}</option>)}
                      </select>
                    ) : (
                      <select aria-label="Unidad" value={idleEventFilters.unidad} onChange={(event) => updateReportFilter('unidad', event.target.value)} className="min-w-48 rounded-lg border border-slate-200 px-3 py-1.5">
                        <option value="">Todas las unidades</option>
                        {vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.placa}>{vehicle.placa} - {vehicle.modelo}</option>)}
                      </select>
                    )}
                  </div>
                  <div className="grid items-end gap-3 xl:grid-cols-[minmax(0,1fr)_auto]">
                    <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                      <label className="min-w-0 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        Desde
                        <input type="datetime-local" value={idleEventFilters.desde} onChange={(event) => updateReportFilter('desde', event.target.value)} className="mt-1 block min-w-0 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-normal normal-case tracking-normal text-slate-700" />
                      </label>
                      <label className="min-w-0 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        Hasta
                        <input type="datetime-local" value={idleEventFilters.hasta} onChange={(event) => updateReportFilter('hasta', event.target.value)} className="mt-1 block min-w-0 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-normal normal-case tracking-normal text-slate-700" />
                      </label>
                    </div>
                    <button type="button" onClick={executeReport} className="rounded-lg bg-forest px-4 py-2 text-xs font-semibold text-white hover:bg-forest-dark">Ejecutar reporte</button>
                  </div>
                  {reportError ? <p className="text-xs text-red-600" role="alert">{reportError}</p> : null}
                </div>
              ) : isHistoricalRouteReport ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-600">
                    <span className="font-semibold">Mostrar:</span>
                    {[
                      { value: 'grupo', label: 'Grupos' },
                      { value: 'unidad', label: 'Unidades' },
                    ].map((option) => (
                      <label key={option.value} className="inline-flex items-center gap-1.5">
                        <input
                          type="radio"
                          name="historical-route-mode"
                          checked={historicalRouteFilters.modo === option.value}
                          onChange={() => updateReportFilter('modo', option.value)}
                          className="accent-forest"
                        />
                        {option.label}
                      </label>
                    ))}
                    {historicalRouteFilters.modo === 'grupo' ? (
                      <select aria-label="Grupo de vehículos" value={historicalRouteFilters.grupo} onChange={(event) => updateReportFilter('grupo', event.target.value)} className="min-w-48 rounded-lg border border-slate-200 px-3 py-1.5">
                        <option value="">Todos los grupos</option>
                        {uniqueVehicleGroups.map((group) => <option key={group} value={group}>{group}</option>)}
                      </select>
                    ) : (
                      <select aria-label="Unidad" value={historicalRouteFilters.unidad} onChange={(event) => updateReportFilter('unidad', event.target.value)} className="min-w-48 rounded-lg border border-slate-200 px-3 py-1.5">
                        <option value="">Todas las unidades</option>
                        {vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.placa}>{vehicle.placa} - {vehicle.modelo}</option>)}
                      </select>
                    )}
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      Ruta
                      <select value={historicalRouteFilters.ruta} onChange={(event) => updateReportFilter('ruta', event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-normal normal-case tracking-normal text-slate-700">
                        <option value="">Todas las rutas</option>
                        {HISTORICAL_ROUTE_OPTIONS.map((route) => <option key={route.id} value={route.id}>{route.nombre}</option>)}
                      </select>
                    </label>
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      Conductor
                      <select value={historicalRouteFilters.conductor} onChange={(event) => updateReportFilter('conductor', event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-normal normal-case tracking-normal text-slate-700">
                        <option value="">Todos los conductores</option>
                        {vehicles.map((vehicle) => <option key={vehicle.conductor_id} value={vehicle.conductor_id}>{vehicle.conductor_nombre}</option>)}
                      </select>
                    </label>
                  </div>
                  <div className="grid items-end gap-3 xl:grid-cols-[minmax(0,1fr)_auto]">
                    <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                      <label className="min-w-0 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        Desde
                        <input type="datetime-local" value={historicalRouteFilters.desde} onChange={(event) => updateReportFilter('desde', event.target.value)} className="mt-1 block min-w-0 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-normal normal-case tracking-normal text-slate-700" />
                      </label>
                      <label className="min-w-0 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        Hasta
                        <input type="datetime-local" value={historicalRouteFilters.hasta} onChange={(event) => updateReportFilter('hasta', event.target.value)} className="mt-1 block min-w-0 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-normal normal-case tracking-normal text-slate-700" />
                      </label>
                    </div>
                    <button type="button" onClick={executeReport} className="rounded-lg bg-forest px-4 py-2 text-xs font-semibold text-white hover:bg-forest-dark">Ejecutar reporte</button>
                  </div>
                  {reportError ? <p className="text-xs text-red-600" role="alert">{reportError}</p> : null}
                </div>
              ) : isGeofenceVisitReport ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-600">
                    <span className="font-semibold">Mostrar:</span>
                    {[
                      { value: 'grupo', label: 'Grupos' },
                      { value: 'unidad', label: 'Unidades' },
                    ].map((option) => (
                      <label key={option.value} className="inline-flex items-center gap-1.5">
                        <input
                          type="radio"
                          name="geofence-visits-mode"
                          checked={geofenceVisitFilters.modo === option.value}
                          onChange={() => updateReportFilter('modo', option.value)}
                          className="accent-forest"
                        />
                        {option.label}
                      </label>
                    ))}
                    {geofenceVisitFilters.modo === 'grupo' ? (
                      <select aria-label="Grupo de vehículos" value={geofenceVisitFilters.grupo} onChange={(event) => updateReportFilter('grupo', event.target.value)} className="min-w-40 rounded-lg border border-slate-200 px-3 py-1.5">
                        <option value="">Todos los grupos</option>
                        {uniqueVehicleGroups.map((group) => <option key={group} value={group}>{group}</option>)}
                      </select>
                    ) : (
                      <select aria-label="Unidad" value={geofenceVisitFilters.unidad} onChange={(event) => updateReportFilter('unidad', event.target.value)} className="min-w-48 rounded-lg border border-slate-200 px-3 py-1.5">
                        <option value="">Todas las unidades</option>
                        {vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.placa}>{vehicle.placa} - {vehicle.modelo}</option>)}
                      </select>
                    )}
                  </div>
                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(220px,0.8fr)]">
                    <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                      <label className="min-w-0 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        Desde
                        <input type="datetime-local" value={geofenceVisitFilters.desde} onChange={(event) => updateReportFilter('desde', event.target.value)} className="mt-1 block min-w-0 w-full rounded-lg border border-slate-200 px-2 py-2 text-xs font-normal normal-case tracking-normal text-slate-700" />
                      </label>
                      <label className="min-w-0 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        Hasta
                        <input type="datetime-local" value={geofenceVisitFilters.hasta} onChange={(event) => updateReportFilter('hasta', event.target.value)} className="mt-1 block min-w-0 w-full rounded-lg border border-slate-200 px-2 py-2 text-xs font-normal normal-case tracking-normal text-slate-700" />
                      </label>
                    </div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      Geocercas
                      <select
                        multiple
                        aria-label="Filtrar por geocercas"
                        value={geofenceVisitFilters.geocercas}
                        onChange={(event) => updateReportFilter('geocercas', [...event.target.selectedOptions].map((option) => option.value))}
                        className="mt-1 block h-[74px] w-full rounded-lg border border-slate-200 px-2 py-1 text-xs font-normal normal-case tracking-normal text-slate-700"
                      >
                        {geofences.filter((fence) => fence.activa).map((fence) => (
                          <option key={fence.id} value={fence.id}>{fence.nombre}</option>
                        ))}
                      </select>
                      <span className="mt-1 block font-normal normal-case tracking-normal text-slate-500">Sin selección: incluir todas las geocercas. Selecciona varias con Ctrl o Cmd.</span>
                    </label>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <label className="inline-flex items-center gap-2 text-xs text-slate-600">
                      <input type="checkbox" checked={geofenceVisitFilters.pruebaVisita} onChange={(event) => updateReportFilter('pruebaVisita', event.target.checked)} className="accent-forest" />
                      Prueba de Visita
                    </label>
                    <div className="flex flex-wrap items-center gap-2">
                      <button type="button" onClick={() => setReportQuickDateRange('today')} className="rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">Hoy</button>
                      <button type="button" onClick={() => setReportQuickDateRange('yesterday')} className="rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">Ayer</button>
                      <button type="button" onClick={() => setReportQuickDateRange('this-week')} className="rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">Esta semana</button>
                      <button type="button" onClick={() => setReportQuickDateRange('previous-week')} className="rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">Semana anterior</button>
                      <button type="button" onClick={executeReport} className="rounded-lg bg-forest px-4 py-2 text-xs font-semibold text-white hover:bg-forest-dark">Ejecutar reporte</button>
                    </div>
                  </div>
                  {reportError ? <p className="text-xs text-red-600" role="alert">{reportError}</p> : null}
                </div>
              ) : isSpeedLimitReport ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-600">
                    <span className="font-semibold">Mostrar:</span>
                    {[
                      { value: 'grupo', label: 'Grupos' },
                      { value: 'unidad', label: 'Unidades' },
                    ].map((option) => (
                      <label key={option.value} className="inline-flex items-center gap-1.5">
                        <input
                          type="radio"
                          name="speed-limit-mode"
                          checked={speedLimitFilters.modo === option.value}
                          onChange={() => updateReportFilter('modo', option.value)}
                          className="accent-forest"
                        />
                        {option.label}
                      </label>
                    ))}
                    {speedLimitFilters.modo === 'grupo' ? (
                      <select aria-label="Grupo de vehículos" value={speedLimitFilters.grupo} onChange={(event) => updateReportFilter('grupo', event.target.value)} className="min-w-40 rounded-lg border border-slate-200 px-3 py-1.5">
                        <option value="">Todos los grupos</option>
                        {uniqueVehicleGroups.map((group) => <option key={group} value={group}>{group}</option>)}
                      </select>
                    ) : (
                      <select aria-label="Unidad" value={speedLimitFilters.unidad} onChange={(event) => updateReportFilter('unidad', event.target.value)} className="min-w-48 rounded-lg border border-slate-200 px-3 py-1.5">
                        <option value="">Todas las unidades</option>
                        {vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.placa}>{vehicle.placa} - {vehicle.modelo}</option>)}
                      </select>
                    )}
                  </div>
                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(220px,0.8fr)]">
                    <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                      <label className="min-w-0 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        Desde
                        <input type="datetime-local" value={speedLimitFilters.desde} onChange={(event) => updateReportFilter('desde', event.target.value)} className="mt-1 block min-w-0 w-full rounded-lg border border-slate-200 px-2 py-2 text-xs font-normal normal-case tracking-normal text-slate-700" />
                      </label>
                      <label className="min-w-0 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        Hasta
                        <input type="datetime-local" value={speedLimitFilters.hasta} onChange={(event) => updateReportFilter('hasta', event.target.value)} className="mt-1 block min-w-0 w-full rounded-lg border border-slate-200 px-2 py-2 text-xs font-normal normal-case tracking-normal text-slate-700" />
                      </label>
                    </div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      Geocercas
                      <select
                        multiple
                        aria-label="Filtrar por geocercas"
                        value={speedLimitFilters.geocercas}
                        onChange={(event) => updateReportFilter('geocercas', [...event.target.selectedOptions].map((option) => option.value))}
                        className="mt-1 block h-[74px] w-full rounded-lg border border-slate-200 px-2 py-1 text-xs font-normal normal-case tracking-normal text-slate-700"
                      >
                        {geofences.filter((fence) => fence.activa).map((fence) => (
                          <option key={fence.id} value={fence.id}>{fence.nombre}</option>
                        ))}
                      </select>
                      <span className="mt-1 block font-normal normal-case tracking-normal text-slate-500">Sin selección: incluir todas las geocercas. Selecciona varias con Ctrl o Cmd.</span>
                    </label>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <button type="button" onClick={() => setReportQuickDateRange('today')} className="rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">Hoy</button>
                    <button type="button" onClick={() => setReportQuickDateRange('yesterday')} className="rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">Ayer</button>
                    <button type="button" onClick={() => setReportQuickDateRange('this-week')} className="rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">Esta semana</button>
                    <button type="button" onClick={() => setReportQuickDateRange('previous-week')} className="rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">Semana anterior</button>
                    <button type="button" onClick={executeReport} className="rounded-lg bg-forest px-4 py-2 text-xs font-semibold text-white hover:bg-forest-dark">Ejecutar reporte</button>
                  </div>
                  {reportError ? <p className="text-xs text-red-600" role="alert">{reportError}</p> : null}
                </div>
              ) : isEventSummaryReport ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-600">
                    <span className="font-semibold">Mostrar:</span>
                    {[
                      { value: 'grupo', label: 'Grupos' },
                      { value: 'unidad', label: 'Unidades' },
                    ].map((option) => (
                      <label key={option.value} className="inline-flex items-center gap-1.5">
                        <input type="radio" name="event-summary-mode" checked={eventSummaryFilters.modo === option.value} onChange={() => updateReportFilter('modo', option.value)} className="accent-forest" />
                        {option.label}
                      </label>
                    ))}
                    {eventSummaryFilters.modo === 'grupo' ? (
                      <select aria-label="Grupo de vehículos" value={eventSummaryFilters.grupo} onChange={(event) => updateReportFilter('grupo', event.target.value)} className="min-w-40 rounded-lg border border-slate-200 px-3 py-1.5">
                        <option value="">Todos los grupos</option>
                        {uniqueVehicleGroups.map((group) => <option key={group} value={group}>{group}</option>)}
                      </select>
                    ) : (
                      <select aria-label="Unidad" value={eventSummaryFilters.unidad} onChange={(event) => updateReportFilter('unidad', event.target.value)} className="min-w-48 rounded-lg border border-slate-200 px-3 py-1.5">
                        <option value="">Todas las unidades</option>
                        {vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.placa}>{vehicle.placa} - {vehicle.modelo}</option>)}
                      </select>
                    )}
                    <span className="ml-2 font-semibold">Vista:</span>
                    {[
                      { value: 'diario', label: 'Diario' },
                      { value: 'sumarizado', label: 'Sumarizado' },
                    ].map((option) => (
                      <label key={option.value} className="inline-flex items-center gap-1.5">
                        <input type="radio" name="event-summary-view" checked={eventSummaryFilters.vista === option.value} onChange={() => updateReportFilter('vista', option.value)} className="accent-forest" />
                        {option.label}
                      </label>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 items-end gap-3 xl:grid-cols-[minmax(0,1fr)_auto]">
                    <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                      <label className="min-w-0 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        Desde
                        <input type="datetime-local" value={eventSummaryFilters.desde} onChange={(event) => updateReportFilter('desde', event.target.value)} className="mt-1 block min-w-0 w-full rounded-lg border border-slate-200 px-2 py-2 text-xs font-normal normal-case tracking-normal text-slate-700" />
                      </label>
                      <label className="min-w-0 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        Hasta
                        <input type="datetime-local" value={eventSummaryFilters.hasta} onChange={(event) => updateReportFilter('hasta', event.target.value)} className="mt-1 block min-w-0 w-full rounded-lg border border-slate-200 px-2 py-2 text-xs font-normal normal-case tracking-normal text-slate-700" />
                      </label>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button type="button" onClick={() => setReportQuickDateRange('today')} className="rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">Hoy</button>
                      <button type="button" onClick={() => setReportQuickDateRange('yesterday')} className="rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">Ayer</button>
                      <button type="button" onClick={() => setReportQuickDateRange('this-week')} className="rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">Esta semana</button>
                      <button type="button" onClick={() => setReportQuickDateRange('previous-week')} className="rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">Semana anterior</button>
                      <button type="button" onClick={executeReport} className="rounded-lg bg-forest px-4 py-2 text-xs font-semibold text-white hover:bg-forest-dark">Ejecutar reporte</button>
                    </div>
                  </div>
                  {reportError ? <p className="text-xs text-red-600" role="alert">{reportError}</p> : null}
                </div>
              ) : isEventReport ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-600">
                    <span className="font-semibold">Mostrar:</span>
                    {[
                      { value: 'grupo', label: 'Grupos' },
                      { value: 'unidad', label: 'Unidades' },
                    ].map((option) => (
                      <label key={option.value} className="inline-flex items-center gap-1.5">
                        <input
                          type="radio"
                          name="event-report-mode"
                          checked={eventFilters.modo === option.value}
                          onChange={() => updateReportFilter('modo', option.value)}
                          className="accent-forest"
                        />
                        {option.label}
                      </label>
                    ))}
                    {eventFilters.modo === 'grupo' ? (
                      <select aria-label="Grupo de vehículos" value={eventFilters.grupo} onChange={(event) => updateReportFilter('grupo', event.target.value)} className="min-w-40 rounded-lg border border-slate-200 px-3 py-1.5">
                        <option value="">Todos los grupos</option>
                        {uniqueVehicleGroups.map((group) => <option key={group} value={group}>{group}</option>)}
                      </select>
                    ) : (
                      <select aria-label="Unidad" value={eventFilters.unidad} onChange={(event) => updateReportFilter('unidad', event.target.value)} className="min-w-48 rounded-lg border border-slate-200 px-3 py-1.5">
                        <option value="">Todas las unidades</option>
                        {vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.placa}>{vehicle.placa} - {vehicle.modelo}</option>)}
                      </select>
                    )}
                  </div>
                  <div className="grid grid-cols-1 items-end gap-3 xl:grid-cols-[minmax(0,1fr)_auto]">
                    <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                      <label className="min-w-0 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        Desde
                        <input type="datetime-local" value={eventFilters.desde} onChange={(event) => updateReportFilter('desde', event.target.value)} className="mt-1 block min-w-0 w-full rounded-lg border border-slate-200 px-2 py-2 text-xs font-normal normal-case tracking-normal text-slate-700" />
                      </label>
                      <label className="min-w-0 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        Hasta
                        <input type="datetime-local" value={eventFilters.hasta} onChange={(event) => updateReportFilter('hasta', event.target.value)} className="mt-1 block min-w-0 w-full rounded-lg border border-slate-200 px-2 py-2 text-xs font-normal normal-case tracking-normal text-slate-700" />
                      </label>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button type="button" onClick={() => setReportQuickDateRange('today')} className="rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">Hoy</button>
                      <button type="button" onClick={() => setReportQuickDateRange('yesterday')} className="rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">Ayer</button>
                      <button type="button" onClick={() => setReportQuickDateRange('this-week')} className="rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">Esta semana</button>
                      <button type="button" onClick={() => setReportQuickDateRange('previous-week')} className="rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">Semana anterior</button>
                      <button type="button" onClick={executeReport} className="rounded-lg bg-forest px-4 py-2 text-xs font-semibold text-white hover:bg-forest-dark">Ejecutar reporte</button>
                    </div>
                  </div>
                  {reportError ? <p className="text-xs text-red-600" role="alert">{reportError}</p> : null}
                </div>
              ) : isTotalEngineHoursReport ? (
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <label className="block w-full max-w-sm text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Unidad
                    <select
                      value={totalEngineHoursUnit}
                      onChange={(event) => updateReportFilter('unidad', event.target.value)}
                      className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-700"
                    >
                      <option value="">Todas las unidades</option>
                      {vehicles.map((vehicle) => (
                        <option key={vehicle.id} value={vehicle.placa}>{vehicle.placa} - {vehicle.modelo}</option>
                      ))}
                    </select>
                  </label>
                  <button type="button" onClick={executeReport} className="rounded-lg bg-forest px-4 py-2 text-xs font-semibold text-white hover:bg-forest-dark">
                    Ejecutar reporte
                  </button>
                  {reportError ? <p className="w-full text-xs text-red-600" role="alert">{reportError}</p> : null}
                </div>
              ) : isEngineUsageReport ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-600">
                    <span className="font-semibold">Mostrar:</span>
                    {[
                      { value: 'grupo', label: 'Grupos' },
                      { value: 'unidad', label: 'Unidades' },
                    ].map((option) => (
                      <label key={option.value} className="inline-flex items-center gap-1.5">
                        <input type="radio" name="engine-usage-mode" checked={engineUsageFilters.modo === option.value} onChange={() => updateReportFilter('modo', option.value)} className="accent-forest" />
                        {option.label}
                      </label>
                    ))}
                    {engineUsageFilters.modo === 'grupo' ? (
                      <select aria-label="Grupo de vehículos" value={engineUsageFilters.grupo} onChange={(event) => updateReportFilter('grupo', event.target.value)} className="min-w-40 rounded-lg border border-slate-200 px-3 py-1.5">
                        <option value="">Todos los grupos</option>
                        {uniqueVehicleGroups.map((group) => <option key={group} value={group}>{group}</option>)}
                      </select>
                    ) : (
                      <select aria-label="Unidad" value={engineUsageFilters.unidad} onChange={(event) => updateReportFilter('unidad', event.target.value)} className="min-w-48 rounded-lg border border-slate-200 px-3 py-1.5">
                        <option value="">Todas las unidades</option>
                        {vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.placa}>{vehicle.placa} - {vehicle.modelo}</option>)}
                      </select>
                    )}
                  </div>
                  <div className="grid grid-cols-1 items-end gap-3 xl:grid-cols-[minmax(0,1fr)_auto]">
                    <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                      <label className="min-w-0 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        Desde
                        <input type="datetime-local" value={engineUsageFilters.desde} onChange={(event) => updateReportFilter('desde', event.target.value)} className="mt-1 block min-w-0 w-full rounded-lg border border-slate-200 px-2 py-2 text-xs font-normal normal-case tracking-normal text-slate-700" />
                      </label>
                      <label className="min-w-0 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        Hasta
                        <input type="datetime-local" value={engineUsageFilters.hasta} onChange={(event) => updateReportFilter('hasta', event.target.value)} className="mt-1 block min-w-0 w-full rounded-lg border border-slate-200 px-2 py-2 text-xs font-normal normal-case tracking-normal text-slate-700" />
                      </label>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button type="button" onClick={() => setReportQuickDateRange('today')} className="rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">Hoy</button>
                      <button type="button" onClick={() => setReportQuickDateRange('yesterday')} className="rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">Ayer</button>
                      <button type="button" onClick={() => setReportQuickDateRange('this-week')} className="rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">Esta semana</button>
                      <button type="button" onClick={() => setReportQuickDateRange('previous-week')} className="rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">Semana anterior</button>
                      <button type="button" onClick={executeReport} className="rounded-lg bg-forest px-4 py-2 text-xs font-semibold text-white hover:bg-forest-dark">Ejecutar reporte</button>
                    </div>
                  </div>
                  {reportError ? <p className="text-xs text-red-600" role="alert">{reportError}</p> : null}
                </div>
              ) : isDriverStatusReport ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 items-end gap-3 xl:grid-cols-[minmax(180px,0.8fr)_minmax(0,1.2fr)]">
                    <label className="min-w-0 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      Conductores
                      <select
                        value={driverStatusFilters.conductor}
                        onChange={(event) => updateReportFilter('conductor', event.target.value)}
                        className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-700"
                      >
                        <option value="">Todos los conductores</option>
                        {vehicles.map((vehicle) => (
                          <option key={vehicle.conductor_id} value={vehicle.conductor_id}>{vehicle.conductor_nombre || 'Sin asignar'}</option>
                        ))}
                      </select>
                    </label>
                    <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                      <label className="min-w-0 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        Desde
                        <input
                          type="datetime-local"
                          value={driverStatusFilters.desde}
                          onChange={(event) => updateReportFilter('desde', event.target.value)}
                          className="mt-1 block min-w-0 w-full rounded-lg border border-slate-200 px-2 py-2 text-xs font-normal normal-case tracking-normal text-slate-700"
                        />
                      </label>
                      <label className="min-w-0 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        Hasta
                        <input
                          type="datetime-local"
                          value={driverStatusFilters.hasta}
                          onChange={(event) => updateReportFilter('hasta', event.target.value)}
                          className="mt-1 block min-w-0 w-full rounded-lg border border-slate-200 px-2 py-2 text-xs font-normal normal-case tracking-normal text-slate-700"
                        />
                      </label>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 xl:col-span-2 xl:justify-end">
                      <button type="button" onClick={() => setReportQuickDateRange('today')} className="rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">Hoy</button>
                      <button type="button" onClick={() => setReportQuickDateRange('yesterday')} className="rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">Ayer</button>
                      <button type="button" onClick={() => setReportQuickDateRange('this-week')} className="rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">Esta semana</button>
                      <button type="button" onClick={() => setReportQuickDateRange('previous-week')} className="rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">Semana anterior</button>
                      <button type="button" onClick={executeReport} className="rounded-lg bg-forest px-4 py-2 text-xs font-semibold text-white hover:bg-forest-dark">Ejecutar reporte</button>
                    </div>
                  </div>
                  {reportError ? <p className="text-xs text-red-600" role="alert">{reportError}</p> : null}
                </div>
              ) : isDriverTimeCardReport ? (
                <div className="space-y-4">
                  <label className="block max-w-sm text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Conductores
                    <select
                      value={driverTimeCardFilters.conductor}
                      onChange={(event) => updateReportFilter('conductor', event.target.value)}
                      className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-700"
                    >
                      <option value="">Todos los conductores</option>
                      {vehicles.map((vehicle) => (
                        <option key={vehicle.conductor_id} value={vehicle.conductor_id}>{vehicle.conductor_nombre || 'Sin asignar'}</option>
                      ))}
                    </select>
                  </label>

                  <div className="grid gap-3 lg:grid-cols-2">
                    <div className="space-y-2 text-xs text-slate-600">
                      <label className="flex items-center gap-2">
                        <input type="checkbox" checked={driverTimeCardFilters.calcularDescansos} onChange={(event) => updateReportFilter('calcularDescansos', event.target.checked)} className="accent-forest" />
                        Calcular información de descansos
                      </label>
                      <label className="flex flex-wrap items-center gap-2">
                        <input type="checkbox" checked={driverTimeCardFilters.reducirDescansos} onChange={(event) => updateReportFilter('reducirDescansos', event.target.checked)} className="accent-forest" />
                        Reducir los descansos mayores a
                        <input
                          type="number"
                          min="0"
                          value={driverTimeCardFilters.descansoMinutos}
                          onChange={(event) => updateReportFilter('descansoMinutos', event.target.value)}
                          disabled={!driverTimeCardFilters.reducirDescansos}
                          aria-label="Minutos para reducir los descansos"
                          className="w-16 rounded-lg border border-slate-200 px-2 py-1 disabled:bg-slate-100"
                        />
                        minutos
                      </label>
                      <label className="flex items-center gap-2">
                        <input type="checkbox" checked={driverTimeCardFilters.mostrarAlmuerzos} onChange={(event) => updateReportFilter('mostrarAlmuerzos', event.target.checked)} className="accent-forest" />
                        Mostrar almuerzos
                      </label>
                      <label className="flex items-center gap-2 pl-6">
                        <input type="checkbox" checked={driverTimeCardFilters.almuerzoNoPagado} onChange={(event) => updateReportFilter('almuerzoNoPagado', event.target.checked)} disabled={!driverTimeCardFilters.mostrarAlmuerzos} className="accent-forest" />
                        Los almuerzos no son pagados
                      </label>
                    </div>
                    <fieldset className="space-y-2 text-xs text-slate-600">
                      <legend className="mb-2 font-semibold">Distancia</legend>
                      <label className="flex items-center gap-2">
                        <input type="radio" name="driver-time-card-distance" checked={!driverTimeCardFilters.todasLasDistancias} onChange={() => updateReportFilter('todasLasDistancias', false)} className="accent-forest" />
                        Calcular solo la distancia mientras está en servicio
                      </label>
                      <label className="flex items-center gap-2">
                        <input type="radio" name="driver-time-card-distance" checked={driverTimeCardFilters.todasLasDistancias} onChange={() => updateReportFilter('todasLasDistancias', true)} className="accent-forest" />
                        Calcular todas las distancias
                      </label>
                    </fieldset>
                  </div>

                  <div className="grid grid-cols-1 items-end gap-3 xl:grid-cols-[minmax(0,1fr)_auto]">
                    <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                      <label className="min-w-0 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        Desde
                        <input type="datetime-local" value={driverTimeCardFilters.desde} onChange={(event) => updateReportFilter('desde', event.target.value)} className="mt-1 block min-w-0 w-full rounded-lg border border-slate-200 px-2 py-2 text-xs font-normal normal-case tracking-normal text-slate-700" />
                      </label>
                      <label className="min-w-0 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        Hasta
                        <input type="datetime-local" value={driverTimeCardFilters.hasta} onChange={(event) => updateReportFilter('hasta', event.target.value)} className="mt-1 block min-w-0 w-full rounded-lg border border-slate-200 px-2 py-2 text-xs font-normal normal-case tracking-normal text-slate-700" />
                      </label>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button type="button" onClick={() => setReportQuickDateRange('today')} className="rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">Hoy</button>
                      <button type="button" onClick={() => setReportQuickDateRange('yesterday')} className="rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">Ayer</button>
                      <button type="button" onClick={() => setReportQuickDateRange('this-week')} className="rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">Esta semana</button>
                      <button type="button" onClick={() => setReportQuickDateRange('previous-week')} className="rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">Semana anterior</button>
                      <button type="button" onClick={executeReport} className="rounded-lg bg-forest px-4 py-2 text-xs font-semibold text-white hover:bg-forest-dark">Ejecutar reporte</button>
                    </div>
                  </div>
                  {reportError ? <p className="text-xs text-red-600" role="alert">{reportError}</p> : null}
                </div>
              ) : isDriverLogReport ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-600">
                    <span className="font-semibold">Mostrar:</span>
                    {[
                      { value: 'grupo', label: 'Grupos' },
                      { value: 'unidad', label: 'Unidades' },
                    ].map((option) => (
                      <label key={option.value} className="inline-flex items-center gap-1.5">
                        <input
                          type="radio"
                          name="driver-log-display-mode"
                          value={option.value}
                          checked={driverLogFilters.modo === option.value}
                          onChange={(event) => updateReportFilter('modo', event.target.value)}
                          className="accent-forest"
                        />
                        {option.label}
                      </label>
                    ))}
                    {driverLogFilters.modo === 'grupo' ? (
                      <select
                        aria-label="Grupo de vehículos"
                        value={driverLogFilters.grupo}
                        onChange={(event) => updateReportFilter('grupo', event.target.value)}
                        className="min-w-40 rounded-lg border border-slate-200 px-3 py-1.5"
                      >
                        <option value="">Todos los grupos</option>
                        {uniqueVehicleGroups.map((group) => <option key={group} value={group}>{group}</option>)}
                      </select>
                    ) : (
                      <select
                        aria-label="Unidad"
                        value={driverLogFilters.unidad}
                        onChange={(event) => updateReportFilter('unidad', event.target.value)}
                        className="min-w-48 rounded-lg border border-slate-200 px-3 py-1.5"
                      >
                        <option value="">Todas las unidades</option>
                        {vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.placa}>{vehicle.placa} - {vehicle.modelo}</option>)}
                      </select>
                    )}
                    <label className="inline-flex items-center gap-1.5">
                      Conductor
                      <select
                        aria-label="Conductor"
                        value={driverLogFilters.conductor}
                        onChange={(event) => updateReportFilter('conductor', event.target.value)}
                        className="min-w-40 rounded-lg border border-slate-200 px-3 py-1.5"
                      >
                        <option value="">Todos los conductores</option>
                        {vehicles.map((vehicle) => <option key={vehicle.conductor_id} value={vehicle.conductor_id}>{vehicle.conductor_nombre}</option>)}
                      </select>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        Desde
                        <input
                          type="datetime-local"
                          value={driverLogFilters.desde}
                          onChange={(event) => updateReportFilter('desde', event.target.value)}
                          className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-normal normal-case tracking-normal text-slate-700"
                        />
                      </label>
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        Hasta
                        <input
                          type="datetime-local"
                          value={driverLogFilters.hasta}
                          onChange={(event) => updateReportFilter('hasta', event.target.value)}
                          className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-normal normal-case tracking-normal text-slate-700"
                        />
                      </label>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button type="button" onClick={() => setReportQuickDateRange('today')} className="rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">Hoy</button>
                      <button type="button" onClick={() => setReportQuickDateRange('yesterday')} className="rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">Ayer</button>
                      <button type="button" onClick={() => setReportQuickDateRange('this-week')} className="rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">Esta semana</button>
                      <button type="button" onClick={() => setReportQuickDateRange('previous-week')} className="rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">Semana anterior</button>
                      <button type="button" onClick={executeReport} className="rounded-lg bg-forest px-4 py-2 text-xs font-semibold text-white hover:bg-forest-dark">Ejecutar reporte</button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-600">
                      <span className="font-semibold">Mostrar reporte por:</span>
                      {[
                        { value: 'conductor', label: 'Conductores' },
                        { value: 'unidad', label: 'Units' },
                      ].map((option) => (
                        <label key={option.value} className="inline-flex items-center gap-1.5">
                          <input
                            type="radio"
                            name="driver-log-report-by"
                            value={option.value}
                            checked={driverLogFilters.reportePor === option.value}
                            onChange={(event) => updateReportFilter('reportePor', event.target.value)}
                            className="accent-forest"
                          />
                          {option.label}
                        </label>
                      ))}
                    </div>
                    <label className="inline-flex items-center gap-2 text-xs text-slate-600">
                      <input
                        type="checkbox"
                        checked={driverLogFilters.mostrarTodosEventos}
                        onChange={(event) => updateReportFilter('mostrarTodosEventos', event.target.checked)}
                        className="accent-forest"
                      />
                      Mostrar todos los eventos
                    </label>
                  </div>
                  {reportError ? <p className="text-xs text-red-600" role="alert">{reportError}</p> : null}
                </div>
              ) : usesDateFilters ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-600">
                    <span className="font-semibold">Mostrar:</span>
                    {[
                      { value: 'grupo', label: 'Grupos' },
                      { value: 'unidad', label: 'Unidades' },
                    ].map((option) => (
                      <label key={option.value} className="inline-flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="report-display-mode"
                          value={option.value}
                          checked={activeFilters.modo === option.value}
                          onChange={() => updateReportFilter('modo', option.value)}
                          className="accent-forest"
                        />
                        {option.label}
                      </label>
                    ))}
                    {activeFilters.modo === 'grupo' ? (
                      <select
                        aria-label="Grupo de vehículos"
                        value={activeFilters.grupo}
                        onChange={(event) => updateReportFilter('grupo', event.target.value)}
                        className="min-w-48 rounded-lg border border-slate-200 px-3 py-1.5"
                      >
                        <option value="">Todos los grupos</option>
                        {uniqueVehicleGroups.map((group) => <option key={group} value={group}>{group}</option>)}
                      </select>
                    ) : (
                      <select
                        aria-label="Unidad"
                        value={activeFilters.unidad}
                        onChange={(event) => updateReportFilter('unidad', event.target.value)}
                        className="min-w-48 rounded-lg border border-slate-200 px-3 py-1.5"
                      >
                        <option value="">Todas las unidades</option>
                        {vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.placa}>{vehicle.placa} - {vehicle.modelo}</option>)}
                      </select>
                    )}
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_auto] gap-4 items-end">
                    <div className={`grid grid-cols-1 ${isBasicReport ? 'sm:grid-cols-2' : 'sm:grid-cols-3'} gap-3`}>
                      {!isBasicReport ? (
                        <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                          Conductor
                          <select
                            value={activeFilters.conductor}
                            onChange={(event) => updateReportFilter('conductor', event.target.value)}
                            className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-700"
                          >
                            <option value="">Todos los conductores</option>
                            {vehicles.map((vehicle) => (
                              <option
                                key={vehicle.conductor_id}
                                value={isDriverLogReport ? vehicle.conductor_id : vehicle.conductor_nombre}
                              >
                                {vehicle.conductor_nombre}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : null}
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        Desde
                        <input
                          type="datetime-local"
                          value={activeFilters.desde}
                          onChange={(event) => updateReportFilter('desde', event.target.value)}
                          className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-normal normal-case tracking-normal text-slate-700"
                        />
                      </label>
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        Hasta
                        <input
                          type="datetime-local"
                          value={activeFilters.hasta}
                          onChange={(event) => updateReportFilter('hasta', event.target.value)}
                          className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-normal normal-case tracking-normal text-slate-700"
                        />
                      </label>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button type="button" onClick={() => setReportQuickDateRange('today')} className="rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">Hoy</button>
                      <button type="button" onClick={() => setReportQuickDateRange('yesterday')} className="rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">Ayer</button>
                      <button type="button" onClick={() => setReportQuickDateRange('this-week')} className="rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">Esta semana</button>
                      <button type="button" onClick={() => setReportQuickDateRange('previous-week')} className="rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">Semana anterior</button>
                      <button type="button" onClick={executeReport} className="rounded-lg bg-forest px-4 py-2 text-xs font-semibold text-white hover:bg-forest-dark">Ejecutar reporte</button>
                    </div>
                  </div>
                  {reportError ? <p className="text-xs text-red-600" role="alert">{reportError}</p> : null}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Unidad
                    <select value={unitFilter} onChange={(event) => setUnitFilter(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-700">
                      <option value="">Todas las unidades</option>
                      {vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.placa}>{vehicle.placa} - {vehicle.modelo}</option>)}
                    </select>
                  </label>
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Conductor
                    <select value={driverFilter} onChange={(event) => setDriverFilter(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-700">
                      <option value="">Todos los conductores</option>
                      {vehicles.map((vehicle) => <option key={vehicle.conductor_id} value={vehicle.conductor_nombre}>{vehicle.conductor_nombre}</option>)}
                    </select>
                  </label>
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-subtle">
              {isInactivityReport ? (
                <div className="space-y-4">
                  <div className="overflow-hidden border border-slate-300">
                    <h4 className="bg-red-800 px-3 py-1.5 text-center text-sm font-bold text-white">Reporte de Inactividad</h4>
                    <p className="bg-red-800 px-3 pb-1.5 text-center text-xs font-semibold text-white">
                      Desde: {new Date(appliedInactivityFilters.desde).toLocaleString('es-PE')} Hasta: {new Date(appliedInactivityFilters.hasta).toLocaleString('es-PE')}
                    </p>
                  </div>
                  <div className="grid gap-3 text-xs text-slate-700 sm:grid-cols-[auto_1fr]">
                    <div><span className="font-semibold">Fecha de ejecución:</span> {new Date().toLocaleString('es-PE')}</div>
                    <p><span className="font-semibold">Descripción:</span> Este reporte muestra el tiempo de inactividad de los vehículos en el periodo seleccionado. Solo se incluyen paradas que cumplen el mínimo de {appliedInactivityFilters.minutos} minutos.</p>
                  </div>
                  <p className="text-[10px] text-amber-700">Registros de demostración; no son lecturas reales de GPS.</p>
                  {!inactivityGroups.length ? (
                    <p className="py-8 text-center text-sm text-slate-400">No se encontraron periodos de inactividad para las unidades y fechas seleccionadas.</p>
                  ) : inactivityGroups.map((group) => (
                    <section key={group.unidad} className="space-y-1">
                      <h5 className="text-xs font-bold text-slate-800">Unidad: {group.unidad}{group.tipo ? `; ${group.tipo}` : ''}</h5>
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[780px] border-collapse text-xs">
                          <thead>
                            <tr className="border-b-2 border-indigo-900 text-indigo-950">
                              {columns.map(([key, label]) => (
                                <th key={key} className="px-2 py-1.5 text-left font-semibold">{label}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {group.rows.map((row) => (
                              <tr key={row.id} className="border-b border-slate-200 text-slate-700 hover:bg-slate-50">
                                {columns.map(([key]) => (
                                  <td key={key} className={`px-2 py-1.5 ${key === 'duracion' ? 'text-right tabular-nums' : ''}`}>{row[key] || '—'}</td>
                                ))}
                              </tr>
                            ))}
                            <tr className="border-b border-slate-200">
                              <td colSpan={columns.length} className="px-2 py-2 text-right text-[10px] font-semibold text-slate-600">
                                Fin del reporte de la unidad.
                                <span className="ml-2 text-red-700">
                                  Paradas: {group.stops} · Máx.: {group.maximum} · Mín.: {group.minimum} · Total: {group.total}
                                </span>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </section>
                  ))}
                </div>
              ) : isIdleEventReport ? (
                <div className="space-y-4">
                  <div className="overflow-hidden border border-slate-300">
                    <h4 className="bg-red-800 px-3 py-1.5 text-center text-sm font-bold text-white">Reporte de Ralentís, Entradas y Salidas</h4>
                    <p className="bg-red-800 px-3 pb-1.5 text-center text-xs font-semibold text-white">
                      Desde: {new Date(appliedIdleEventFilters.desde).toLocaleString('es-PE')} Hasta: {new Date(appliedIdleEventFilters.hasta).toLocaleString('es-PE')}
                    </p>
                  </div>
                  <div className="grid gap-3 text-xs text-slate-700 sm:grid-cols-[auto_1fr]">
                    <div><span className="font-semibold">Fecha de ejecución:</span> {new Date().toLocaleString('es-PE')}</div>
                    <p><span className="font-semibold">Descripción:</span> Este reporte muestra los eventos de ralentí de las unidades en el rango de fechas seleccionado.</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[10px]">
                    <span className="font-bold text-slate-700">Leyenda de velocidad:</span>
                    <span className="rounded border border-amber-300 bg-amber-100 px-3 py-1 font-semibold text-amber-900">&gt; 55 km/h</span>
                    <span className="rounded border border-red-300 bg-red-100 px-3 py-1 font-semibold text-red-900">&gt; 65 km/h</span>
                    <span className="ml-auto text-amber-700">Eventos de demostración; no son telemetría real.</span>
                  </div>
                  {!idleEventGroups.length ? (
                    <p className="py-8 text-center text-sm text-slate-400">No hay eventos de ralentí para las unidades y fechas seleccionadas.</p>
                  ) : idleEventGroups.map((group) => (
                    <section key={group.unidad} className="space-y-1">
                      <h5 className="text-xs font-bold text-slate-800">Unidad: {group.unidad}{group.tipo ? `; ${group.tipo}` : ''}</h5>
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[820px] border-collapse text-xs">
                          <thead>
                            <tr className="border-b-2 border-indigo-900 text-indigo-950">
                              {columns.map(([key, label]) => (
                                <th key={key} className="px-2 py-1.5 text-left font-semibold">{label}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {group.rows.map((row) => {
                              const speedTone = row.velocidad > 65
                                ? 'bg-red-100 text-red-900'
                                : row.velocidad > 55
                                  ? 'bg-amber-100 text-amber-900'
                                  : '';
                              return (
                                <tr key={row.id} className="border-b border-slate-200 text-slate-700 hover:bg-slate-50">
                                  {columns.map(([key]) => (
                                    <td key={key} className={`px-2 py-1.5 ${key === 'velocidad' ? `text-right ${speedTone}` : ''}`}>
                                      {key === 'velocidad' ? `${row[key]} km/h` : row[key] || '—'}
                                    </td>
                                  ))}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  ))}
                </div>
              ) : isHistoricalRouteReport ? (
                <div className="space-y-4">
                  <div className="overflow-hidden border border-slate-300">
                    <h4 className="bg-red-600 px-3 py-1.5 text-center text-sm font-bold text-white">Reporte Historial de Rutas</h4>
                    <div className="flex flex-wrap justify-center gap-x-6 gap-y-1 bg-slate-200 px-3 py-2 text-xs text-slate-700">
                      <span>Desde: {new Date(appliedHistoricalRouteFilters.desde).toLocaleString('es-PE')}</span>
                      <span>Hasta: {new Date(appliedHistoricalRouteFilters.hasta).toLocaleString('es-PE')}</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-amber-700">Recorridos de demostración; no son trayectos registrados por GPS.</p>
                  {!filteredRows.length ? (
                    <p className="py-8 text-center text-sm text-slate-400">No se encontraron rutas para las unidades, conductores y fechas seleccionadas.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[1050px] border-collapse text-xs">
                        <thead>
                          <tr className="bg-red-50 text-red-800">
                            {columns.map(([, label]) => (
                              <th key={label} className="border-b-2 border-red-800 px-2 py-2 text-left font-semibold">{label}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {filteredRows.map((row) => (
                            <tr key={row.id} className="border-b border-slate-200 text-slate-700 hover:bg-red-50/50">
                              {columns.map(([key]) => (
                                <td key={key} className="px-2 py-2">{key === 'distancia' ? `${row[key]} km` : key === 'velocidadMaxima' ? `${row[key]} km/h` : row[key] || '—'}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : isGeofenceVisitReport ? (
                <div className="space-y-4">
                  <div className="overflow-hidden border border-slate-300">
                    <h4 className="bg-red-600 px-3 py-1.5 text-center text-sm font-bold text-white">Geocercas</h4>
                    <div className="flex flex-wrap justify-center gap-x-6 gap-y-1 bg-slate-200 px-3 py-2 text-xs text-slate-700">
                      <span>Desde: {new Date(appliedGeofenceVisitFilters.desde).toLocaleString('es-PE')}</span>
                      <span>Hasta: {new Date(appliedGeofenceVisitFilters.hasta).toLocaleString('es-PE')}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                    <p className="text-slate-700">Entradas, salidas y duración de visitas por geocerca.</p>
                    <p className="text-amber-700">Datos de demostración; no son telemetría real.</p>
                  </div>
                  {!geofenceVisitGroups.length ? (
                    <p className="py-8 text-center text-sm text-slate-400">No se encontraron visitas para los filtros seleccionados.</p>
                  ) : geofenceVisitGroups.map((group) => (
                    <section key={group.unidad} className="space-y-1">
                      <h5 className="text-xs font-bold text-slate-800">Placa: {group.unidad}{group.tipo ? `/${group.tipo}` : ''}</h5>
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[880px] border-collapse text-xs">
                          <thead>
                            <tr className="bg-red-50 text-red-800">
                              <th className="border-b-2 border-red-800 px-2 py-1.5 text-left font-semibold">Placa</th>
                              <th className="border-b-2 border-red-800 px-2 py-1.5 text-left font-semibold">Geocerca</th>
                              <th className="border-b-2 border-red-800 px-2 py-1.5 text-left font-semibold">Entrada</th>
                              <th className="border-b-2 border-red-800 px-2 py-1.5 text-left font-semibold">Hora</th>
                              <th className="border-b-2 border-red-800 px-2 py-1.5 text-left font-semibold">Turno</th>
                              <th className="border-b-2 border-red-800 px-2 py-1.5 text-left font-semibold">Salida</th>
                              <th className="border-b-2 border-red-800 px-2 py-1.5 text-left font-semibold">Hora</th>
                              <th className="border-b-2 border-red-800 px-2 py-1.5 text-left font-semibold">Turno</th>
                              <th className="border-b-2 border-red-800 px-2 py-1.5 text-right font-semibold">Duración</th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.rows.map((row) => (
                              <tr key={row.id} className="border-b border-slate-200 text-slate-700 hover:bg-red-50/50">
                                <td className="px-2 py-1.5">{row.unidad}</td>
                                <td className="px-2 py-1.5">{row.geocerca}</td>
                                <td className="px-2 py-1.5">{row.entradaFecha}</td>
                                <td className="px-2 py-1.5">{row.entradaHora}</td>
                                <td className="px-2 py-1.5">{row.entradaTurno}</td>
                                <td className="px-2 py-1.5">{row.salidaFecha}</td>
                                <td className="px-2 py-1.5">{row.salidaHora}</td>
                                <td className="px-2 py-1.5">{row.salidaTurno}</td>
                                <td className="px-2 py-1.5 text-right">{row.duracion}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  ))}
                </div>
              ) : isSpeedLimitReport ? (
                <div className="space-y-4">
                  <div className="overflow-hidden border border-slate-300">
                    <h4 className="bg-red-600 px-3 py-1.5 text-center text-sm font-bold text-white">Reporte de Límite de Velocidad en Geocercas</h4>
                    <div className="flex flex-wrap justify-center gap-x-6 gap-y-1 bg-slate-200 px-3 py-2 text-xs text-slate-700">
                      <span>Desde: {new Date(appliedSpeedLimitFilters.desde).toLocaleString('es-PE')}</span>
                      <span>Hasta: {new Date(appliedSpeedLimitFilters.hasta).toLocaleString('es-PE')}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                    <p className="text-slate-700">Excesos de velocidad registrados dentro de las geocercas seleccionadas.</p>
                    <p className="text-amber-700">Eventos de demostración; no son telemetría real.</p>
                  </div>
                  {!speedLimitGroups.length ? (
                    <p className="py-8 text-center text-sm text-slate-400">No se encontraron excesos de velocidad para los filtros seleccionados.</p>
                  ) : speedLimitGroups.map((group) => (
                    <section key={group.unidad} className="space-y-1">
                      <h5 className="text-xs font-bold text-slate-800">Placa: {group.unidad}{group.tipo ? `/${group.tipo}` : ''}</h5>
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[880px] border-collapse text-xs">
                          <thead>
                            <tr className="bg-red-50 text-red-800">
                              <th className="border-b-2 border-red-800 px-2 py-1.5 text-left font-semibold">Fecha</th>
                              <th className="border-b-2 border-red-800 px-2 py-1.5 text-left font-semibold">Geocerca</th>
                              <th className="border-b-2 border-red-800 px-2 py-1.5 text-left font-semibold">Conductor</th>
                              <th className="border-b-2 border-red-800 px-2 py-1.5 text-right font-semibold">Velocidad</th>
                              <th className="border-b-2 border-red-800 px-2 py-1.5 text-right font-semibold">Límite</th>
                              <th className="border-b-2 border-red-800 px-2 py-1.5 text-right font-semibold">Exceso</th>
                              <th className="border-b-2 border-red-800 px-2 py-1.5 text-right font-semibold">Duración</th>
                              <th className="border-b-2 border-red-800 px-2 py-1.5 text-left font-semibold">Ubicación</th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.rows.map((row) => (
                              <tr key={row.id} className="border-b border-slate-200 text-slate-700 hover:bg-red-50/50">
                                <td className="px-2 py-1.5">{row.fechaHora}</td>
                                <td className="px-2 py-1.5">{row.geocerca}</td>
                                <td className="px-2 py-1.5">{row.conductor}</td>
                                <td className="bg-red-100 px-2 py-1.5 text-right font-semibold text-red-900">{row.velocidad} km/h</td>
                                <td className="px-2 py-1.5 text-right">{row.limite} km/h</td>
                                <td className="px-2 py-1.5 text-right font-semibold text-red-800">+{row.exceso} km/h</td>
                                <td className="px-2 py-1.5 text-right">{row.duracion}</td>
                                <td className="px-2 py-1.5">{row.ubicacion}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  ))}
                </div>
              ) : isTotalEngineHoursReport ? (
                <div className="space-y-4">
                  <div className="overflow-hidden border border-slate-300">
                    <h4 className="bg-red-600 px-3 py-2 text-center text-sm font-bold text-white">Reporte de Total de horas de uso del motor</h4>
                  </div>
                  <p className="text-xs text-slate-700">Este reporte muestra el total de horas que el motor ha estado encendido.</p>
                  <p className="text-[10px] text-amber-700">Horas de motor de demostración; no son lecturas reales de telemetría.</p>
                  {!totalEngineHoursReportRows.length ? (
                    <p className="py-8 text-center text-sm text-slate-400">No hay unidades para mostrar.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="mx-auto w-full max-w-2xl border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-100 text-slate-700">
                            {columns.map(([, label]) => (
                              <th key={label} className="border border-slate-300 px-3 py-2 text-left font-semibold">{label}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {totalEngineHoursReportRows.map((row) => (
                            <tr key={row.id} className="text-slate-700 hover:bg-slate-50">
                              {columns.map(([key]) => (
                                <td key={key} className="border border-slate-300 px-3 py-1.5">{row[key] || '—'}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : isEventSummaryReport ? (
                <div className="space-y-4">
                  <div className="overflow-hidden border border-slate-300">
                    <h4 className="bg-red-800 px-3 py-1.5 text-center text-sm font-bold text-white">Events Summary Report</h4>
                    <p className="bg-red-800 px-3 pb-1.5 text-center text-xs font-semibold text-white">
                      From: {new Date(appliedEventSummaryFilters.desde).toLocaleString('en-US')} To: {new Date(appliedEventSummaryFilters.hasta).toLocaleString('en-US')}
                    </p>
                  </div>
                  <p className="text-[10px] text-amber-700">Resumen de tiempos de demostración por unidad; no son registros reales de telemetría.</p>
                  {!eventSummaryGroups.length ? (
                    <p className="py-8 text-center text-sm text-slate-400">No hay eventos para las unidades y fechas seleccionadas.</p>
                  ) : eventSummaryGroups.map((group) => (
                    <section key={group.unidad} className="space-y-2 border-t border-slate-200 pt-3 first:border-t-0 first:pt-0">
                      <h5 className="text-xs font-bold text-slate-800">
                        {appliedEventSummaryFilters.modo === 'grupo' ? `Group: ${group.tipo || '—'}` : 'Group:'}
                      </h5>
                      <div className="grid gap-x-4 gap-y-2 text-xs text-slate-700 sm:grid-cols-[minmax(120px,1.3fr)_repeat(4,minmax(90px,1fr))]">
                        <div className="font-semibold">Unit: {group.unidad}</div>
                        {[
                          ['totalStop', 'Total Stop'],
                          ['totalIdle', 'Total Idle'],
                          ['totalDrive', 'Total Drive'],
                          ['total', 'Total'],
                        ].map(([key, label]) => (
                          <div key={key} className="font-semibold">{label}</div>
                        ))}
                        {group.rows.map((row) => (
                          <React.Fragment key={row.id}>
                            <div className="text-slate-500">{appliedEventSummaryFilters.vista === 'diario' ? row.fecha : 'Total'}</div>
                            {[
                              ['totalStop', row.totalStop, row.stopPercent],
                              ['totalIdle', row.totalIdle, row.idlePercent],
                              ['totalDrive', row.totalDrive, row.drivePercent],
                              ['total', row.total, null],
                            ].map(([key, value, percentage]) => (
                              <div key={`${row.id}-${key}`} className="tabular-nums">
                                {value}{percentage ? <span className="ml-1 text-slate-500">{percentage}</span> : null}
                              </div>
                            ))}
                          </React.Fragment>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              ) : isEventReport ? (
                <div className="space-y-4">
                  <div className="overflow-hidden border border-slate-300">
                    <h4 className="bg-red-800 px-3 py-1.5 text-center text-sm font-bold text-white">Reporte de Eventos</h4>
                    <p className="bg-red-800 px-3 pb-1.5 text-center text-xs font-semibold text-white">
                      Desde: {new Date(appliedEventFilters.desde).toLocaleString('es-PE')} Hasta: {new Date(appliedEventFilters.hasta).toLocaleString('es-PE')}
                    </p>
                  </div>
                  <div className="grid gap-3 text-xs text-slate-700 sm:grid-cols-[auto_1fr]">
                    <div><span className="font-semibold">Fecha de Ejecución:</span> {new Date().toLocaleString('es-PE')}</div>
                    <p><span className="font-semibold">Descripción:</span> Este reporte muestra los eventos detallados de un vehículo por un periodo de tiempo. Los eventos mostrados son: Paradas, Idle y movimiento.</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[10px]">
                    <span className="font-bold text-slate-700">Velocidad:</span>
                    <span className="rounded border border-amber-300 bg-amber-100 px-3 py-1 font-semibold text-amber-900">&gt; 55</span>
                    <span className="rounded border border-red-300 bg-red-100 px-3 py-1 font-semibold text-red-900">&gt; 65</span>
                    <span className="ml-auto text-amber-700">Eventos de demostración; no son telemetría real.</span>
                  </div>
                  {!eventReportGroups.length ? (
                    <p className="py-8 text-center text-sm text-slate-400">No hay eventos para las unidades y fechas seleccionadas.</p>
                  ) : eventReportGroups.map((group) => (
                    <section key={group.unidad} className="space-y-1">
                      <h5 className="text-xs font-bold text-slate-800">Unidad: {group.unidad}{group.tipo ? `/${group.tipo}` : ''}</h5>
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[820px] border-collapse text-xs">
                          <thead>
                            <tr className="border-b-2 border-indigo-900 text-indigo-950">
                              {[['evento', 'Evento'], ['fechaEvento', 'Fecha del Evento'], ['direccion', 'Dirección'], ['conductor', 'Conductor'], ['duracion', 'Duración'], ['velocidad', 'Vel'], ['sentido', 'Sent']].map(([key, label]) => (
                                <th key={key} className="px-2 py-1.5 text-left font-semibold">{label}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {group.rows.map((row) => {
                              const speedTone = row.velocidad > 65
                                ? 'bg-red-100 text-red-900'
                                : row.velocidad > 55
                                  ? 'bg-amber-100 text-amber-900'
                                  : '';
                              return (
                                <tr key={row.id} className="border-b border-slate-200 text-slate-700 hover:bg-slate-50">
                                  <td className="px-2 py-1.5 font-medium">{row.evento}</td>
                                  <td className="px-2 py-1.5">{row.fechaEvento}</td>
                                  <td className="px-2 py-1.5">{row.direccion}</td>
                                  <td className="px-2 py-1.5">{row.conductor}</td>
                                  <td className="px-2 py-1.5 text-right">{row.duracion || '—'}</td>
                                  <td className={`px-2 py-1.5 text-right ${speedTone}`}>{row.velocidad}</td>
                                  <td className="px-2 py-1.5 text-center">{row.sentido}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  ))}
                </div>
              ) : isEngineUsageReport ? (
                <div className="space-y-4">
                  <div className="overflow-hidden border border-slate-300">
                    <h4 className="bg-red-600 px-3 py-2 text-center text-sm font-bold text-white">Reporte de Tiempo de uso de Motor</h4>
                  </div>
                  <p className="text-xs text-slate-700">Este reporte muestra el tiempo que el motor ha estado encendido. La dirección mostrada indica dónde se generó el apagado del vehículo.</p>
                  <p className="text-[10px] text-amber-700">Ciclos de encendido y apagado de demostración; no son registros reales de telemetría.</p>
                  {!engineUsageGroups.length ? (
                    <p className="py-8 text-center text-sm text-slate-400">No hay ciclos de motor para las unidades y fechas seleccionadas.</p>
                  ) : engineUsageGroups.map((group) => (
                    <section key={group.unidad} className="space-y-1">
                      <h5 className="text-xs font-bold text-slate-800">Unidad: {group.unidad}{group.tipo ? `/${group.tipo}` : ''}</h5>
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[780px] border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-100 text-slate-700">
                              {columns.map(([, label]) => (
                                <th key={label} className="border border-slate-300 px-2 py-2 text-left font-semibold">{label}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {group.rows.map((row) => (
                              <tr key={row.id} className="text-slate-700 hover:bg-slate-50">
                                {columns.map(([key]) => (
                                  <td key={key} className="border border-slate-300 px-2 py-2">{row[key] || '—'}</td>
                                ))}
                              </tr>
                            ))}
                            <tr className="bg-slate-50 font-semibold text-slate-700">
                              <td colSpan={3} className="border border-slate-300 px-2 py-2 text-right">Total</td>
                              <td className="border border-slate-300 px-2 py-2">{group.total}</td>
                              <td className="border border-slate-300 px-2 py-2" />
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </section>
                  ))}
                </div>
              ) : isDriverTimeCardReport ? (
                <div className="space-y-4">
                  <div className="overflow-hidden border border-slate-300">
                    <h4 className="bg-red-600 px-3 py-2 text-center text-sm font-bold text-white">Drivers Time Card Report</h4>
                    <div className="flex flex-wrap justify-center gap-x-8 gap-y-1 bg-slate-100 px-3 py-2 text-xs text-slate-700">
                      <span>From: {new Date(appliedDriverTimeCardFilters.desde).toLocaleString('en-US')}</span>
                      <span>To: {new Date(appliedDriverTimeCardFilters.hasta).toLocaleString('en-US')}</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-amber-700">Tiempos y distancias de demostración; no son cálculos de asistencia ni telemetría real.</p>
                  {!driverTimeCardGroups.length ? (
                    <p className="py-8 text-center text-sm text-slate-400">No hay conductores para los filtros seleccionados.</p>
                  ) : driverTimeCardGroups.map((group) => (
                    <section key={group.conductor} className="overflow-x-auto">
                      <h5 className="bg-slate-200 px-2 py-2 text-xs font-bold text-slate-800">Driver: {group.conductor}</h5>
                      <table className="w-full min-w-[780px] border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-100 text-slate-700">
                            {columns.map(([, label]) => (
                              <th key={label} className="border border-slate-300 px-2 py-2 text-left font-semibold">{label}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {group.rows.map((row) => (
                            <tr key={row.id} className="text-slate-700 hover:bg-slate-50">
                              {columns.map(([key]) => (
                                <td key={key} className="border border-slate-300 px-2 py-2">{row[key] || '—'}</td>
                              ))}
                            </tr>
                          ))}
                          <tr className="bg-slate-50 font-semibold text-slate-700">
                            <td colSpan={columns.length - 2} className="border border-slate-300 px-2 py-2 text-right">Paid Time</td>
                            <td className="border border-slate-300 px-2 py-2">{group.rows[0]?.paidTime || '—'}</td>
                            <td className="border border-slate-300 px-2 py-2">{group.rows[0]?.millas || '—'}</td>
                          </tr>
                        </tbody>
                      </table>
                    </section>
                  ))}
                </div>
              ) : isDriverStatusReport ? (
                <div className="space-y-4">
                  <div className="overflow-hidden border border-slate-300">
                    <h4 className="bg-red-600 px-3 py-2 text-center text-sm font-bold text-white">Drivers Status Report</h4>
                    <div className="flex flex-wrap justify-center gap-x-8 gap-y-1 bg-slate-100 px-3 py-2 text-xs text-slate-700">
                      <span>From: {new Date(appliedDriverStatusFilters.desde).toLocaleString('en-US')}</span>
                      <span>To: {new Date(appliedDriverStatusFilters.hasta).toLocaleString('en-US')}</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-amber-700">Estados de demostración basados en los datos mock; no representan historial real de telemetría.</p>
                  <section className="overflow-x-auto">
                    <h5 className="bg-blue-500 px-3 py-2 text-center text-sm font-bold text-white">Summary</h5>
                    {!driverStatusReportRows.length ? (
                      <p className="py-8 text-center text-sm text-slate-400">No hay conductores para los filtros seleccionados.</p>
                    ) : (
                      <table className="w-full min-w-[420px] border-collapse text-xs">
                        <thead>
                          <tr className="bg-sky-100 text-slate-800">
                            {columns.map(([, label]) => (
                              <th key={label} className="border border-slate-300 px-2 py-2 text-left font-semibold">{label}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {driverStatusReportRows.map((row) => (
                            <tr key={row.id} className="text-slate-700 hover:bg-slate-50">
                              {columns.map(([key]) => (
                                <td key={key} className="border border-slate-300 px-2 py-2">{row[key] || '—'}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </section>
                </div>
              ) : isDriverLogReport ? (
                <div className="space-y-4">
                  <div className="overflow-hidden border border-slate-300">
                    <h4 className="bg-red-600 px-3 py-2 text-center text-sm font-bold text-white">Units - Drivers Report</h4>
                    <div className="flex flex-wrap justify-center gap-x-8 gap-y-1 bg-slate-100 px-3 py-2 text-xs text-slate-700">
                      <span>From: {new Date(appliedDriverLogFilters.desde).toLocaleString('en-US')}</span>
                      <span>To: {new Date(appliedDriverLogFilters.hasta).toLocaleString('en-US')}</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-amber-700">Eventos de ejemplo; no provienen de telemetría real.</p>
                  {!driverLogGroups.length ? (
                    <p className="py-8 text-center text-sm text-slate-400">No hay eventos para los filtros seleccionados.</p>
                  ) : driverLogGroups.map((group) => (
                    <section key={group.label} className="space-y-1">
                      <h5 className="text-sm font-bold text-slate-800">
                        {appliedDriverLogFilters.reportePor === 'conductor'
                          ? `${group.label} · ${group.rows[0]?.unidad}`
                          : `${group.label}/${group.rows[0]?.tipo || ''}`}
                      </h5>
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[700px] border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-100 text-slate-700">
                              {driverLogTableColumns.map(([, label]) => (
                                <th key={label} className="border border-slate-300 px-2 py-2 text-left font-semibold">{label}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {group.rows.map((row) => (
                              <tr key={row.id} className="text-slate-700 hover:bg-slate-50">
                                {driverLogTableColumns.map(([key]) => (
                                  <td key={key} className="border border-slate-300 px-2 py-2">{row[key] || '—'}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  ))}
                </div>
              ) : isDotReport ? (
                <div className="space-y-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-slate-500">
                      Día del reporte: {new Date(`${appliedDotFilters.fecha}T00:00:00`).toLocaleDateString('es-PE')}
                      <span className="ml-2 text-[10px] text-amber-700">Datos simulados; no corresponden a un registro DOT real.</span>
                    </p>
                    <button type="button" onClick={exportCsv} disabled={!dotEvents.length} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                      <Download size={12} /> Exportar
                    </button>
                  </div>
                  {!dotRows.length ? (
                    <p className="py-8 text-center text-sm text-slate-400">No hay conductores disponibles para el reporte.</p>
                  ) : dotRows.map((driverReport) => (
                    <section key={`${driverReport.unidad}-${driverReport.conductor}`} className="space-y-4 border-t border-slate-200 pt-4 first:border-t-0 first:pt-0">
                      <div className="flex flex-wrap justify-between gap-4 border-b border-slate-200 pb-3 text-xs text-slate-700">
                        <div className="space-y-1">
                          <p><span className="font-semibold">Conductor:</span> {driverReport.conductor}</p>
                          <p><span className="font-semibold">Vehículo:</span> {driverReport.unidad}</p>
                          <p><span className="font-semibold">Dirección:</span> {vehicles.find((vehicle) => vehicle.placa === driverReport.unidad)?.ultima_ubicacion}</p>
                        </div>
                        <dl className="grid grid-cols-2 gap-x-5 gap-y-1 text-right sm:grid-cols-4">
                          <div><dt className="text-slate-500">Fuera de servicio</dt><dd className="font-semibold">{driverReport.totals.fueraDeServicio}</dd></div>
                          <div><dt className="text-slate-500">Descansando</dt><dd className="font-semibold">{driverReport.totals.descansando}</dd></div>
                          <div><dt className="text-slate-500">Conduciendo</dt><dd className="font-semibold">{driverReport.totals.conduciendo}</dd></div>
                          <div><dt className="text-slate-500">Servicio sin conducir</dt><dd className="font-semibold">{driverReport.totals.servicioNoConduciendo}</dd></div>
                        </dl>
                      </div>

                      <div className="overflow-x-auto">
                        <div className="min-w-[700px] py-2">
                          <div className="mb-1 flex">
                            <span className="w-12 shrink-0" />
                            <div className="grid flex-1 text-[10px] text-slate-600" style={{ gridTemplateColumns: 'repeat(24, minmax(0, 1fr))' }}>
                              {Array.from({ length: 24 }, (_, hour) => (
                                <span key={hour} className="text-center">{hour === 0 || hour === 23 ? 'M' : hour === 12 ? 'N' : hour % 12 || 12}</span>
                              ))}
                            </div>
                            <span className="w-16 shrink-0 pl-2 text-[10px] font-semibold">Totales</span>
                          </div>
                          {[
                            { code: 'OFF', label: 'OFF', total: driverReport.totals.fueraDeServicio, tone: 'bg-slate-400' },
                            { code: 'SB', label: 'SB', total: driverReport.totals.descansando, tone: 'bg-sky-400' },
                            { code: 'D', label: 'D', total: driverReport.totals.conduciendo, tone: 'bg-amber-400' },
                            { code: 'ON', label: 'ON', total: driverReport.totals.servicioNoConduciendo, tone: 'bg-emerald-500' },
                          ].map((lane) => (
                            <div key={lane.code} className="flex h-9 items-stretch">
                              <span className="w-12 shrink-0 pr-2 text-right text-[10px] leading-9 text-slate-600">{lane.label}</span>
                              <div className="relative grid flex-1 border-y border-slate-200 bg-white" style={{ gridTemplateColumns: 'repeat(24, minmax(0, 1fr))' }}>
                                {Array.from({ length: 24 }, (_, hour) => <span key={hour} className="border-r border-slate-100" />)}
                                {driverReport.schedule.filter((segment) => segment.status === lane.code).map((segment, index) => (
                                  <span
                                    key={`${lane.code}-${index}`}
                                    className={`absolute top-1.5 h-6 rounded-sm ${lane.tone}`}
                                    style={{ left: `${(segment.start / 24) * 100}%`, width: `${((segment.end - segment.start) / 24) * 100}%` }}
                                    title={`${lane.label}: ${segment.start}:00–${segment.end}:00`}
                                  />
                                ))}
                              </div>
                              <span className="w-16 shrink-0 pl-2 text-[10px] leading-9 text-slate-700">{lane.total}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[760px] border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-100 text-slate-700">
                              {['Hora', 'Duración', 'Vehículo', 'Millas', 'Estado', 'Dirección', 'Editar', 'Eliminar'].map((label) => (
                                <th key={label} className="border border-slate-200 px-2 py-2 text-left font-semibold">{label}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {driverReport.entries.map((entry) => (
                              <tr key={entry.id} className="text-slate-700 hover:bg-slate-50">
                                {[entry.hora, entry.duracion, entry.vehiculo, entry.millas, entry.estado, entry.direccion, '—', '—'].map((value, index) => (
                                  <td key={`${entry.id}-${index}`} className="border border-slate-200 px-2 py-2">{value}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  ))}
                </div>
              ) : isAlertReport ? (
                <div className="space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-slate-500">
                      {alertRows.length} {alertRows.length === 1 ? 'alerta' : 'alertas'}
                      <span className="ml-2 text-[10px] text-amber-700">Datos simulados; no son telemetría en tiempo real.</span>
                    </p>
                  </div>
                  <div className="overflow-hidden border border-slate-300">
                    <h4 className="bg-red-600 px-3 py-2 text-center text-sm font-bold text-white">Reporte de Alertas</h4>
                    <p className="bg-white px-3 py-3 text-xs leading-relaxed text-slate-700">
                      Este informe muestra las alertas recibidas de las unidades seleccionadas en el intervalo de tiempo definido. Las alertas se ordenan por fecha y muestran la ubicación y los detalles correspondientes.
                    </p>
                  </div>
                  {!alertGroups.length ? (
                    <p className="py-8 text-center text-sm text-slate-400">No hay alertas para los filtros seleccionados.</p>
                  ) : alertGroups.map((unitGroup) => (
                    <section key={unitGroup.unidad} className="space-y-3 border-t border-slate-200 pt-4">
                      <h5 className="text-sm font-bold text-slate-800">Unidad: {unitGroup.unidad}</h5>
                      {unitGroup.categories.map((category) => (
                        <div key={`${unitGroup.unidad}-${category.categoria}`} className="space-y-1">
                          <h6 className="text-sm font-bold text-slate-700">{category.categoria}</h6>
                          <div className="overflow-x-auto">
                            <table className="w-full min-w-[680px] border-collapse text-xs">
                              <thead>
                                <tr className="bg-slate-50 text-slate-800">
                                  <th className="border border-slate-400 px-2 py-1.5 text-left font-semibold">Fecha Evento</th>
                                  <th className="border border-slate-400 px-2 py-1.5 text-left font-semibold">Ubicación Alerta</th>
                                  <th className="border border-slate-400 px-2 py-1.5 text-left font-semibold">Conductor</th>
                                  <th className="border border-slate-400 px-2 py-1.5 text-left font-semibold">Detalle</th>
                                </tr>
                              </thead>
                              <tbody>
                                {category.rows.map((row) => (
                                  <tr key={row.id} className="text-slate-700">
                                    <td className="border border-slate-400 px-2 py-1.5">{row.fechaEvento}</td>
                                    <td className="border border-slate-400 px-2 py-1.5">{row.ubicacion}</td>
                                    <td className="border border-slate-400 px-2 py-1.5">{row.conductor}</td>
                                    <td className="border border-slate-400 px-2 py-1.5">{row.detalle}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}
                    </section>
                  ))}
                </div>
              ) : isDetailedActivities ? (
                <div className="space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-slate-500">
                      {detailedRows.length} {detailedRows.length === 1 ? 'unidad' : 'unidades'} · {detailedEventRows.length} eventos
                      <span className="ml-2 text-[10px] text-amber-700">Datos simulados; no son telemetría en tiempo real.</span>
                    </p>
                    <button type="button" onClick={exportCsv} disabled={!detailedEventRows.length} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                      <Download size={12} /> CSV
                    </button>
                  </div>
                  <div className="overflow-hidden border border-slate-300">
                    <h4 className="bg-red-600 px-3 py-2 text-center text-sm font-bold text-white">Reporte de Actividades Detalladas</h4>
                    <div className="flex flex-wrap justify-center gap-x-6 gap-y-1 bg-slate-200 px-3 py-2 text-xs text-slate-700">
                      <span>Desde: {new Date(appliedDetailedFilters.desde).toLocaleString('es-PE')}</span>
                      <span>Hasta: {new Date(appliedDetailedFilters.hasta).toLocaleString('es-PE')}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2 text-[10px]">
                    <span className="self-center font-bold text-slate-700">Velocidad</span>
                    <span className="rounded border border-slate-300 bg-white px-3 py-1 font-semibold text-slate-700">Menos de 55</span>
                    <span className="rounded border border-amber-300 bg-amber-100 px-3 py-1 font-semibold text-amber-900">55 a 65</span>
                    <span className="rounded border border-red-300 bg-red-100 px-3 py-1 font-semibold text-red-900">Más de 65</span>
                    <span className="ml-2 self-center font-bold text-slate-700">Detención</span>
                    <span className="rounded border border-emerald-300 bg-emerald-100 px-3 py-1 font-semibold text-emerald-900">Bajo 15 min</span>
                    <span className="rounded border border-amber-300 bg-amber-100 px-3 py-1 font-semibold text-amber-900">15 a 60 min</span>
                    <span className="rounded border border-rose-300 bg-rose-100 px-3 py-1 font-semibold text-rose-900">Sobre 60 min</span>
                  </div>
                  {!detailedRows.length ? (
                    <p className="py-8 text-center text-sm text-slate-400">No hay resultados para los filtros seleccionados.</p>
                  ) : detailedRows.map((vehicleReport) => (
                    <section key={vehicleReport.id} className="space-y-2 border-t border-slate-200 pt-4">
                      <h5 className="text-sm font-bold text-slate-800">{vehicleReport.unidad}</h5>
                      <div className="max-w-xl overflow-x-auto">
                        <table className="w-full border-collapse text-xs">
                          <tbody>
                            <tr><th colSpan="2" className="border border-slate-400 bg-slate-200 px-2 py-1 text-left font-semibold text-slate-700">Resumen</th></tr>
                            {vehicleReport.resumen.map(([label, value]) => (
                              <tr key={label}>
                                <th className="w-1/2 border border-slate-400 bg-slate-50 px-2 py-1 text-left font-semibold text-slate-700">{label}</th>
                                <td className="border border-slate-400 px-2 py-1 text-right text-slate-700">{value}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <h6 className="inline-block bg-slate-200 px-2 py-1 text-xs font-semibold text-slate-700">Detalles</h6>
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[700px] border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-50 text-slate-700">
                              {detailedEventColumns.map(([, label]) => <th key={label} className="border border-slate-300 px-2 py-1.5 text-left font-semibold">{label}</th>)}
                            </tr>
                          </thead>
                          <tbody>
                            {vehicleReport.detalles.map((detail, index) => (
                              <tr key={`${vehicleReport.id}-${index}`} className={detail.status.includes('Ignición') ? 'bg-rose-100 text-rose-900' : 'bg-white text-slate-700'}>
                                {detailedEventColumns.map(([key]) => <td key={key} className="border border-slate-300 px-2 py-1.5">{detail[key]}</td>)}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  ))}
                </div>
              ) : (
                <>
              <p className="text-xs text-slate-500 mb-3">
                <span className="font-semibold text-slate-700">{displayRows.length}</span> {displayRows.length === 1 ? 'resultado' : 'resultados'}
                {usesDateFilters ? (
                  <span className="ml-2 text-[10px] text-slate-500">
                    Desde {new Date(activeAppliedFilters.desde).toLocaleString('es-PE')} hasta {new Date(activeAppliedFilters.hasta).toLocaleString('es-PE')}
                  </span>
                ) : null}
                <span className="ml-2 text-[10px] text-amber-700">Datos simulados; no son telemetría en tiempo real.</span>
                {usesTripFilters ? (
                  <button type="button" onClick={exportCsv} disabled={!displayRows.length} className="ml-3 inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                    <Download size={12} /> CSV
                  </button>
                ) : null}
              </p>
              {isActivityReport || isLatLonActivityReport ? (
                <div className="mb-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 sm:p-4">
                  <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_auto] gap-3 items-center">
                    <p className="text-xs leading-relaxed text-slate-600">
                      <span className="font-bold text-slate-800">Descripción:</span>{' '}
                      {isLatLonActivityReport
                        ? 'Este reporte muestra los eventos registrados durante los recorridos de cada unidad, junto con la fecha y hora, dirección y coordenadas de latitud y longitud. Los registros son ejemplos de interfaz y no representan telemetría real.'
                        : 'Este reporte muestra los viajes entre eventos de inicio y parada. Cada fila resume el inicio del trayecto, el tiempo viajado, la distancia recorrida y el evento de parada asociado. Los registros son ejemplos de interfaz y no representan telemetría real.'}
                    </p>
                    {isActivityReport ? <div className="space-y-1.5 text-[10px]">
                      <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5">
                        <span className="font-semibold text-slate-600">Leyenda de velocidad</span>
                        <span className="flex items-center gap-1">
                          <span className="rounded bg-emerald-600 px-2 py-1 font-bold text-white">Baja &lt; 55</span>
                          <span className="rounded bg-amber-400 px-2 py-1 font-bold text-slate-900">55 a 65</span>
                          <span className="rounded bg-red-600 px-2 py-1 font-bold text-white">Sobre 65</span>
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5">
                        <span className="font-semibold text-slate-600">Leyenda de paradas</span>
                        <span className="flex items-center gap-1">
                          <span className="rounded bg-emerald-600 px-2 py-1 font-bold text-white">Menos de 15 min</span>
                          <span className="rounded bg-amber-400 px-2 py-1 font-bold text-slate-900">15 a 60 min</span>
                          <span className="rounded bg-red-600 px-2 py-1 font-bold text-white">Sobre 60 min</span>
                        </span>
                      </div>
                    </div> : null}
                  </div>
                </div>
              ) : null}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse">
                  <thead><tr className="border-b border-slate-200">{displayColumns.map(([, label]) => <th key={label} className="px-3 py-2 text-left text-[11px] font-semibold text-slate-600">{label}</th>)}</tr></thead>
                  <tbody>
                    {!displayRows.length ? (
                      <tr><td colSpan={displayColumns.length} className="py-8 text-center text-sm text-slate-400">No hay resultados para los filtros seleccionados.</td></tr>
                    ) : displayRows.map((row, index) => (
                      <tr key={`${report.id}-${row.unidad || row.id}-${index}`} className="border-b border-slate-100 hover:bg-slate-50">
                        {displayColumns.map(([key, label]) => {
                          const isSpeed = isActivityReport && key === 'velocidadMaxima';
                          const isStopDuration = isActivityReport && key === 'tiempoDetenido';
                          const speed = Number(row[key]);
                          const stopMinutes = isStopDuration
                            ? Number(String(row[key]).split(':')[0]) * 60 + Number(String(row[key]).split(':')[1])
                            : 0;
                          const tone = isSpeed
                            ? speed < 55 ? 'bg-emerald-50 text-emerald-800' : speed <= 65 ? 'bg-amber-50 text-amber-800' : 'bg-red-50 text-red-800'
                            : isStopDuration
                              ? stopMinutes < 15 ? 'bg-emerald-50 text-emerald-800' : stopMinutes <= 60 ? 'bg-amber-50 text-amber-800' : 'bg-red-50 text-red-800'
                              : '';
                          return <td key={label} className={`px-3 py-2.5 text-xs text-slate-700 ${tone}`}>{row[key] ?? '—'}</td>;
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="min-w-0 rounded-2xl border border-slate-200/80 bg-white p-6 text-sm text-slate-500 shadow-subtle">
            Este módulo no tiene reportes disponibles.
          </div>
        )}
      </div>
    </section>
  );
}
