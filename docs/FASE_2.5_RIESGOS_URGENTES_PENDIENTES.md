# AGRILUX — FASE 2.5: RIESGOS URGENTES PENDIENTES (ONBOARDING EMPRESARIAL)

Este documento registra los riesgos de seguridad y consistencia detectados durante las auditorías 2.5.5, 2.5.6, 2.5.7 y 2.5.8, así como durante la implementación de la Fase 2.5.9.

**Estado general:** Los riesgos críticos de seguridad (RLS permisiva, bypass de funciones, suplantación de identidad) deben mitigarse antes de habilitar el onboarding empresarial en producción.

---

## Tabla de riesgos

| # | Área | Problema | Evidencia | Severidad | Componente afectado | Consecuencia | Acción correctiva | Estado | Prioridad |
|---|------|----------|-----------|-----------|---------------------|--------------|-----------------|--------|-----------|
| 1 | RLS | Todas las tablas tienen políticas `USING (true)` | `supabase-schema.sql:288-299`; `supabase-empresas.sql:212-239` | Crítica | Todas las tablas existentes | Cualquier usuario autenticado puede leer/escribir datos de cualquier empresa | Reemplazar gradualmente por políticas restrictivas basadas en `empresa_miembros` | Pendiente | Crítica |
| 2 | RLS | `usuarios` permite `UPDATE` directo de `status` y `rol` | `supabase-schema.sql:288` | Alta | `usuarios` | Un usuario podría escalar sus propios privilegios | Revocar `UPDATE` directo en `usuarios`; usar funciones controladas | Pendiente | Crítica |
| 3 | RLS | `empresa_miembros` permite `UPDATE` directo de `rol` y `activo` | `supabase-empresas.sql:215` | Alta | `empresa_miembros` | Un administrador podría desactivar al último admin sin pasar por función protegida | Revocar `UPDATE` directo; solo función `modificar_miembro_empresa` | Pendiente | Crítica |
| 4 | Identidad | Funciones RPC podrían aceptar `p_usuario_id` como parámetro confiable | Diseño Fase 2.5.7 | Alta | Funciones RPC | Suplantación de identidad: un usuario podría crear membresía en nombre de otro | Usar `auth.uid()` internamente en todas las funciones RPC; nunca aceptar `user_id` como parámetro de cliente | Pendiente | Crítica |
| 5 | Invitaciones | `SELECT FOR UPDATE` no protege contra llamadas concurrentes a `auth.signUp` | Fase 2.5.6 | Alta | `codigos_invitacion` | Dos procesos podrían crear usuarios con la misma invitación | Usar `UPDATE ... WHERE estado_reserva = 'disponible'` como reserva atómica; `reserva_id` como identificador de propiedad | Pendiente | Alta |
| 6 | Transacciones | `auth.users` y tablas públicas no comparten transacción | Arquitectura Supabase | Alta | Creación de empresa | Usuario creado en Auth pero sin perfil en `usuarios` (huérfano) | Orquestación con compensación: eliminar usuario de Auth si falla paso posterior | Pendiente | Alta |
| 7 | Datos | Posibles duplicados en `empresa_miembros` antes de `UNIQUE(empresa_id, user_id) WHERE activo = true` | No auditado aún | Alta | `empresa_miembros` | La restricción única fallará si hay duplicados existentes | Auditar datos antes de aplicar restricción; limpiar duplicados | Pendiente | Alta |
| 8 | Esquema | Diferencia entre scripts `.sql` locales y Supabase desplegado | No verificado | Media | Todo el esquema | Las migraciones podrían fallar si el esquema remoto difiere | Auditar esquema remoto en Supabase Dashboard antes de aplicar migraciones | Pendiente | Media |
| 9 | Confirmación de correo | `usuarios.status = 'aprobado'` se establece inmediatamente en registro, sin esperar confirmación de correo | `AuthContext.jsx:93-129` | Media | `AuthContext.jsx` | Usuario sin correo verificado tiene acceso total | Separar confirmación de correo (Supabase Auth) de `usuarios.status`; definir política clara | Pendiente | Media |
| 10 | Compensación | `auth.admin.createUser` no tiene transacción con PostgreSQL | Arquitectura Edge Functions | Media | Creación de empresa | Usuario huérfano en Auth si falla inserción en `usuarios` | Orquestación con eliminación del usuario de Auth como compensación best-effort | Pendiente | Media |
| 11 | Límites | Vercel Hobby permite solo 12 serverless functions `/api/` | Conocida | Media | Arquitectura | No se pueden crear endpoints adicionales sin exceder límite | Usar `empresaApi.js` (Supabase directo) para operaciones empresariales | Pendiente | Media |
| 12 | Invitaciones multiuso | Solo una reserva simultánea por invitación | Diseño Fase 2.5.7 | Baja | `codigos_invitacion` | No se pueden aprovechar varios usos en paralelo | Documentar como limitación arquitectónica aceptada | Pendiente | Baja |

---

## Riesgos críticos que deben mitigarse antes de producción

1. **RLS permisiva (`USING true`)**: Todas las tablas existentes permiten acceso total a cualquier usuario autenticado. Esto debe reemplazarse gradualmente por políticas basadas en membresía de empresa.

2. **Bypass de funciones protegidas**: Si `empresa_miembros` permite `UPDATE` directo, un administrador malintencionado podría desactivar al último administrador o cambiar su propio rol sin pasar por la función protegida `modificar_miembro_empresa`.

3. **Suplantación de identidad**: Si las funciones RPC aceptan `user_id` como parámetro del cliente, un usuario podría crear membresías en nombre de otros usuarios.

4. **Reservas de invitaciones concurrentes**: Sin bloqueo atómico adecuado, dos procesos podrían consumir la misma invitación.

---

## Estado de mitigación

| Riesgo | Estado | Nota |
|--------|--------|------|
| RLS permisiva | Pendiente | Migración 11 crea políticas restrictivas, pero no elimina las antiguas automáticamente |
| Bypass de funciones | Pendiente | Migración 11 revoca `UPDATE` directo en tablas sensibles |
| Suplantación de identidad | Pendiente | Funciones RPC usan `auth.uid()` internamente |
| Concurrencia invitaciones | Pendiente | Migración 04 y función `confirmar_canje_invitacion` implementan reserva atómica |
| Usuarios huérfanos | Pendiente | Backend debe implementar compensación con `auth.admin.deleteUser` |
