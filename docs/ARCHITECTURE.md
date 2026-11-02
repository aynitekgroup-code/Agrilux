# Arquitectura de Agrilux

Agrilux se organiza por **módulos funcionales**. Cada módulo representa una capacidad del producto y contiene sus páginas relacionadas. La infraestructura transversal permanece en `src/lib` y `src/components` para evitar duplicar autenticación, Supabase, APIs externas y componentes reutilizables.

El mapa técnico se consulta desde la pestaña **Docs** del panel administrador.
No se publica como HTML independiente para evitar que la arquitectura interna
quede accesible sin autorización.

## Estructura

```text
src/
├── modules/
│   ├── diagnostico/
│   │   ├── DiagnosticoPage.jsx
│   │   ├── diagnosticoService.js
│   │   ├── diagnosticoPrompts.js
│   │   └── components/
│   │       └── index.js
│   ├── ciclo/
│   │   ├── CicloPage.jsx
│   │   ├── cicloService.js
│   │   └── components/
│   │       └── TimelineEtapa.jsx
│   ├── parcela/
│   │   ├── ParcelaPage.jsx
│   │   ├── parcelaService.js
│   │   ├── PrediccionPlagas.jsx
│   │   ├── ParcelaEmpresas.jsx
│   │   └── components/
│   │       ├── index.js
│   │       ├── MapaParcela.jsx
│   │       ├── VistaMapaParcela.jsx
│   │       ├── NdviParcela.jsx
│   │       ├── GraficosCultivo.jsx
│   │       ├── TimelineRiesgo.jsx
│   │       └── componentes empresariales
│   ├── gestion/
│   │   ├── GestionPage.jsx
│   │   ├── SaludFinancieraPage.jsx
│   │   └── components/
│   │       ├── index.js
│   │       ├── GestionHeader.jsx
│   │       ├── FiltrosFundo.jsx
│   │       ├── PanelGestion.jsx
│   │       ├── MetricasFundo.jsx
│   │       ├── AlertaGestion.jsx
│   │       └── AccesosGestion.jsx
│   └── mercado/
│       ├── MercadoPage.jsx
│       ├── mercadoService.js
│       ├── components/
│       │   ├── index.js
│       │   └── RegistroTienda.jsx
│       ├── OfertasPage.jsx
│       └── VozPage.jsx
├── components/       # Componentes compartidos
├── lib/              # Infraestructura y servicios compartidos
├── pages/             # Páginas públicas o secundarias
│   └── admin/          # Panel administrativo y su documentación privada
│       ├── Admin.jsx
│       └── AdminDocs.jsx
└── App.jsx            # Composición de rutas
```

## Mapa de responsabilidades

| Módulo | Entrada principal | Integraciones principales |
|---|---|---|
| Diagnóstico | `modules/diagnostico/DiagnosticoPage.jsx` | Enfermedades, clima, suelo, NDVI y voz |
| Ciclo | `modules/ciclo/CicloPage.jsx` | Etapas, clima, recomendaciones e insumos |
| Parcela | `modules/parcela/ParcelaPage.jsx` | Parcelas, mapas, NDVI y monitoreo |
| Gestión | `modules/gestion/GestionPage.jsx` | Operaciones, métricas y salud financiera |
| Mercado | `modules/mercado/MercadoPage.jsx` | Ofertas, tiendas, agentes y voz |

## Reglas para cambios nuevos

1. Una funcionalidad nueva debe entrar en el módulo funcional correspondiente.
2. Los componentes usados por un solo módulo deben permanecer junto a ese módulo.
3. Un componente usado por dos o más módulos debe permanecer en `src/components`.
   Los módulos pueden exponer esos componentes mediante un `components/index.js` local
   sin duplicar el código.
4. Las llamadas a proveedores externos deben reutilizar `src/lib/externalApis.js` o un servicio específico del módulo; las páginas no deben duplicar fetches.
5. La autenticación, Supabase, almacenamiento offline y contexto global pertenecen a `src/lib`.
6. Las rutas públicas sin dominio agrícola, como Registro, Administración y Privacidad, permanecen en `src/pages`.
7. Al crear un módulo, actualizar esta matriz y agregar su ruta en `src/App.jsx`.

El panel administrativo se mantiene agrupado en `src/pages/admin`. Sus consultas
usan `src/lib/supabase.js` y sus APIs usan `api/`; estos archivos no se duplican
dentro de `admin` porque también pueden ser compartidos o deben ejecutarse en el
servidor.

## Flujo para migrar código existente

1. Identificar la página de entrada y sus dependencias.
2. Mover la página a `src/modules/<modulo>/`.
3. Ajustar imports relativos y conservar las rutas públicas.
4. Verificar que los componentes compartidos no se dupliquen.
5. Ejecutar `npm run build`.
