export function limpiarNumeroWhatsApp(valor) {
  const numero = String(valor || '').replace(/\D/g, '');
  if (!numero) return '';
  if (numero.startsWith('51')) return numero;
  if (numero.startsWith('0')) return `51${numero.slice(1)}`;
  return `51${numero}`;
}

export function construirMensajeNota({ estudiante, curso = 'curso', mensaje, docente = 'Agrilux' }) {
  const nombre = (estudiante || 'Estudiante').toString().trim() || 'Estudiante';
  const texto = (mensaje || '').trim();
  const cuerpo = texto
    ? `${texto}\n\n` 
    : 'Hola, te enviamos tu nota del curso.\n\n';

  return `Hola ${nombre},\n\n${cuerpo}Curso: ${curso}\nDocente: ${docente}\n\nGracias por tu atención.`;
}

export async function enviarNotaWhatsApp({ telefono, estudiante, curso, mensaje, docente = 'Agrilux' }) {
  const numero = limpiarNumeroWhatsApp(telefono);
  if (!numero) {
    throw new Error('No hay número de WhatsApp para este estudiante.');
  }

  const texto = encodeURIComponent(construirMensajeNota({ estudiante, curso, mensaje, docente }));

  if (typeof window !== 'undefined') {
    const url = `https://wa.me/${numero}?text=${texto}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    return { ok: true, url, modo: 'directo' };
  }

  const response = await fetch('/api/notas-whatsapp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: numero,
      message: construirMensajeNota({ estudiante, curso, mensaje, docente }),
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || 'No se pudo enviar la nota por WhatsApp.');
  }

  return { ok: true, ...data, modo: 'api' };
}
