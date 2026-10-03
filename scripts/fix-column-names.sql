-- ============================================
-- FIX: Renombrar columnas de snake_case a camelCase
-- para coincidir con el código JavaScript
-- ============================================

-- 1. USUARIOS
ALTER TABLE usuarios RENAME COLUMN email_sintetico TO "emailSintetico";
ALTER TABLE usuarios RENAME COLUMN password_default TO "passwordDefault";
ALTER TABLE usuarios RENAME COLUMN creado_por TO "creadoPor";
ALTER TABLE usuarios RENAME COLUMN created_at TO "createdAt";
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ;

-- 2. DIAGNOSTICOS
ALTER TABLE diagnosticos RENAME COLUMN user_id TO "userId";
ALTER TABLE diagnosticos RENAME COLUMN user_name TO "userName";
ALTER TABLE diagnosticos RENAME COLUMN user_email TO "userEmail";
ALTER TABLE diagnosticos RENAME COLUMN cultivo_nombre TO "cultivoNombre";
ALTER TABLE diagnosticos RENAME COLUMN con_foto TO "conFoto";
ALTER TABLE diagnosticos RENAME COLUMN consulta_texto TO "consultaTexto";
ALTER TABLE diagnosticos RENAME COLUMN clima_contexto TO "climaContexto";
ALTER TABLE diagnosticos RENAME COLUMN confirmado_por_usuario TO "confirmadoPorUsuario";
ALTER TABLE diagnosticos RENAME COLUMN created_at TO "createdAt";

-- 3. PARCELAS
ALTER TABLE parcelas RENAME COLUMN user_id TO "userId";
ALTER TABLE parcelas RENAME COLUMN user_name TO "userName";
ALTER TABLE parcelas RENAME COLUMN cultivo_nombre TO "cultivoNombre";
ALTER TABLE parcelas RENAME COLUMN cultivo_emoji TO "cultivoEmoji";
ALTER TABLE parcelas RENAME COLUMN fecha_siembra TO "fechaSiembra";
ALTER TABLE parcelas RENAME COLUMN created_at TO "createdAt";

-- 4. REGISTROS PARCELA
ALTER TABLE registros_parcela RENAME COLUMN parcela_id TO "parcelaId";
ALTER TABLE registros_parcela RENAME COLUMN user_id TO "userId";
ALTER TABLE registros_parcela RENAME COLUMN dias_desde_siembra TO "diasDesdeSiembra";
ALTER TABLE registros_parcela RENAME COLUMN created_at TO "createdAt";

-- 5. HISTORIAL CLINICO
ALTER TABLE historial_clinico RENAME COLUMN user_id TO "userId";
ALTER TABLE historial_clinico RENAME COLUMN parcela_id TO "parcelaId";
ALTER TABLE historial_clinico RENAME COLUMN parcela_nombre TO "parcelaNombre";
ALTER TABLE historial_clinico RENAME COLUMN tiene_problema TO "tieneProblema";
ALTER TABLE historial_clinico RENAME COLUMN problema_cientifico TO "problemaCientifico";
ALTER TABLE historial_clinico RENAME COLUMN producto_aplicado TO "productoAplicado";
ALTER TABLE historial_clinico RENAME COLUMN fecha_aplicacion TO "fechaAplicacion";
ALTER TABLE historial_clinico RENAME COLUMN fecha_resultado TO "fechaResultado";
ALTER TABLE historial_clinico RENAME COLUMN observaciones_resultado TO "observacionesResultado";
ALTER TABLE historial_clinico RENAME COLUMN foto_url TO "fotoUrl";
ALTER TABLE historial_clinico RENAME COLUMN comentario_feedback TO "comentarioFeedback";
ALTER TABLE historial_clinico RENAME COLUMN created_at TO "createdAt";
ALTER TABLE historial_clinico RENAME COLUMN updated_at TO "updatedAt";

-- 6. TIENDAS COMUNIDAD
ALTER TABLE tiendas_comunidad RENAME COLUMN whatsapp_formateado TO "whatsappFormateado";
ALTER TABLE tiendas_comunidad RENAME COLUMN propietario_id TO "propietarioId";
ALTER TABLE tiendas_comunidad RENAME COLUMN propietario_nombre TO "propietarioNombre";
ALTER TABLE tiendas_comunidad RENAME COLUMN propietario_email TO "propietarioEmail";
ALTER TABLE tiendas_comunidad RENAME COLUMN precios_actuales TO "preciosActuales";
ALTER TABLE tiendas_comunidad RENAME COLUMN ultima_actualizacion TO "ultimaActualizacion";
ALTER TABLE tiendas_comunidad RENAME COLUMN ultima_consulta TO "ultimaConsulta";
ALTER TABLE tiendas_comunidad RENAME COLUMN created_at TO "createdAt";
ALTER TABLE tiendas_comunidad RENAME COLUMN updated_at TO "updatedAt";
ALTER TABLE tiendas_comunidad RENAME COLUMN eliminada_at TO "eliminadaAt";
ALTER TABLE tiendas_comunidad RENAME COLUMN eliminada_por TO "eliminadaPor";

-- 7. PRECIOS HISTORICOS
ALTER TABLE precios_historicos RENAME COLUMN tienda_id TO "tiendaId";
ALTER TABLE precios_historicos RENAME COLUMN tienda_nombre TO "tiendaNombre";
ALTER TABLE precios_historicos RENAME COLUMN producto_nombre TO "productoNombre";
ALTER TABLE precios_historicos RENAME COLUMN created_at TO "createdAt";

-- 8. TIENDAS (Admin)
ALTER TABLE tiendas RENAME COLUMN creado_por TO "creadoPor";
ALTER TABLE tiendas RENAME COLUMN created_at TO "createdAt";
ALTER TABLE tiendas RENAME COLUMN actualizado_en TO "actualizadoEn";

-- 9. ALIADOS
ALTER TABLE aliados RENAME COLUMN created_at TO "createdAt";
ALTER TABLE aliados RENAME COLUMN updated_at TO "updatedAt";

-- 10. COMUNIDAD
ALTER TABLE comunidad RENAME COLUMN autor_id TO "autorId";
ALTER TABLE comunidad RENAME COLUMN created_at TO "createdAt";

-- 11. CONTACTOS MARKETING
ALTER TABLE contactos_marketing RENAME COLUMN created_at TO "createdAt";

-- 12. CONVERSACIONES VOZ
ALTER TABLE conversaciones_voz RENAME COLUMN user_id TO "userId";
ALTER TABLE conversaciones_voz RENAME COLUMN created_at TO "createdAt";
