// Redirect to unified weather endpoint
export default async function handler(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const lat = url.searchParams.get('lat') || '';
  const lon = url.searchParams.get('lon') || '';
  res.redirect(301, `/api/weather?lat=${lat}&lon=${lon}&senamhi=true`);
}
