// B y V son homófonas en español. Se aplica solo a placas completas, nunca a
// nombres o áreas, y no decide entre dos placas realmente existentes.
export function clavePlacaFonetica(valor) {
  const texto = String(valor ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return /^[a-z]{2,4}\d{2,4}$/.test(texto) ? texto.replace(/[bv]/g, 'b') : '';
}

export function placasFoneticas(unidades, consulta) {
  const clave = clavePlacaFonetica(consulta);
  return clave ? unidades.filter((u) => clavePlacaFonetica(u.placa) === clave) : [];
}
