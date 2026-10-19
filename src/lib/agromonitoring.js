async function fetchJson(url) {
  const res = await fetch(url);
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text}`);
  return JSON.parse(text);
}

export async function geocodeUbicacion(q) {
  // URL relativa para que el shim nativo de main.jsx la redirija al backend
  const url = `/api/agromonitoring?action=geocode&q=${encodeURIComponent(q)}`;
  return await fetchJson(url);
}

export async function getWeather({ lat, lon, units = 'metric' }) {
  // URL relativa para que el shim nativo de main.jsx la redirija al backend
  const url = `/api/agromonitoring?action=weather&lat=${lat}&lon=${lon}&units=${units}`;
  return await fetchJson(url.toString());
}

