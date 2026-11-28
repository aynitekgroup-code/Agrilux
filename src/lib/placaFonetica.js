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

// Alias acotado para la transcripción observada; no modifica nombres ni placas.
export function aliasVozUnidad(consulta) {
  const texto = String(consulta ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  return /^(jej|ge ge|je je)$/.test(texto) ? 'gg' : '';
}

export function unidadesAliasVoz(unidades, consulta) {
  const alias = aliasVozUnidad(consulta);
  if (!alias) return [];
  const patron = /(^|[^a-z0-9])gg([^a-z0-9]|$)/i;
  return unidades.filter((u) => [u.placa, u.descripcion, u.modelo].some((campo) => patron.test(String(campo || ''))));
}
