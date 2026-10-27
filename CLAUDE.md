# Taller Pulgas Locas S.A.S. — guía para Claude

**Pulgas Locas S.A.S.** es un taller con varias **sedes**:
- Una de **mantenimiento**, que hace la revisión general.
- **Especializadas**: frenos y suspensión; motor, eléctrico y transmisión.

Es una pieza de un ecosistema de **agentes** que se hablan por MCP:
- El **concesionario** es dueño de la relación cliente–vehículo (`id_relacion`), de la API del VIN y de la garantía. Agenda las citas y valida la garantía.
- **Facturación** cotiza los repuestos con las tiendas, le escribe al cliente por Telegram y cobra con PSE.
- Las **tiendas** venden las partes. El taller **no tiene inventario**: solo dice qué parte hace falta (código universal y cantidad) y registra lo que usó.

Lo central es el **MCP**. La web es solo la **parte manual del mecánico**:
- Tomar la orden.
- Diagnosticar con causa, dictamen de garantía y evidencias.
- Decir qué partes comprar.
- Reparar.

El administrador además gestiona usuarios.

Sigue las convenciones de `../espiga-pro`:
- Todo en español.
- Una carpeta por funcionalidad.
- `config.ts` con `requerida()`.
- `base-datos/` con migraciones y semilla.
- Claves con scrypt.
- JWT con audiencias `web` y `mcp`.
- MCP de un servidor por petición.
- La carpeta `pruebas/` con CLIs `.mjs`.

El contrato con los otros agentes, con ejemplos JSON reales, está en
[`docs/integracion/`](docs/integracion/README.md).

## Stack y puertos

| Parte | Tecnología | Puerto |
|---|---|---|
| `api/` | Next.js 16 (App Router, solo rutas API) + TypeORM 1 + PostgreSQL 18 + zod 4 + jose | 3001 |
| `web/` | React 19 + Vite 8 + Tailwind CSS 4 + React Router 8 | 5173 (reenvía `/api` y `/mcp` a 3001) |
| MCP | `@modelcontextprotocol/server` 2 (Streamable HTTP en `/mcp`) | 3001 |
| Prediagnóstico | Modelo local compatible con OpenAI (`LOCAL_URL`, Ollama), con reglas de respaldo | — |
| Pruebas | Vitest 5 en los dos proyectos; Testing Library + jsdom en `web` | — |

- **Variables:** viven en `SENA-IA/.env`, compartido con los otros proyectos (ver la sección Taller de `SENA-IA/.env.ejemplo`).
- **Valores de desarrollo:** se pueden poner en `api/.env.local`, que no se sube al repositorio y tiene prioridad.
- **PostgreSQL:** es el contenedor `postgres` de `SENA-IA/docker-compose.yml`, con la base `taller`.

## Comandos

```bash
# Una sola vez: base de datos
cd ..            # carpeta SENA-IA
docker compose up -d postgres
docker compose exec postgres createdb -U <DB_USUARIO> taller

# API (desde taller/api)
npm install
npm run migracion:correr      # aplica las migraciones
npm run semilla               # roles, sedes, catálogo de SKU, códigos de repuesto y el administrador
npm run dev                   # http://localhost:3001
npm run pruebas               # pruebas unitarias (sin base de datos)
npm run tipos                 # tsc --noEmit
npm run simular -- todos      # los 11 casos por MCP, como un orquestador (npm run simular -- casos los lista)
npm run flujo                 # el lado manual por REST, con los permisos
npm run mcp                   # lista las herramientas MCP (después de node pruebas/entrar.mjs <usuario> <clave>)
npm run migracion:generar -- src/base-datos/migraciones/<Nombre>   # después de cambiar una entidad

# Web (desde taller/web)
npm install
npm run dev                   # http://localhost:5173
npm run pruebas               # pruebas unitarias de componentes y páginas
npm run build                 # tsc + vite build
```

## Mapa de carpetas

```
api/
  app/api/**/route.ts     Rutas delgadas: validan con zod (dto.ts) y llaman al service. Solo las que usa la
                          web: auth, usuarios, talleres, servicios, codigos-repuesto, ordenes (tomar, remitir,
                          evidencias, diagnostico, reparacion), evidencias/:id.
  app/mcp/route.ts        Puerta MCP: exige el token de audiencia 'mcp'.
  prompts/                prediagnostico.txt (instrucciones del agente de prediagnóstico)
  src/config.ts           RAIZ, requerida(), NOMBRE_TALLER. Carga api/.env.local y SENA-IA/.env.
  src/comun/              errores.ts (ErrorHttp), http.ts (validar, leerCuerpo, leerCuerpoOpcional, entero),
                          guardia.ts (ruta(roles, fn), publica(fn)), limite.ts, columnas.ts, pruebas.ts
  src/base-datos/         entidades.ts (lista a mano), opciones.ts, conexion.ts (bd()),
                          fuente.ts (CLI de migraciones), semilla.ts, migraciones/
  src/usuarios/           Rol y Usuario (con sede), claves (scrypt), tokens (jose), actor, service, dto
  src/talleres/           Taller (sede); reglas.ts (franjas libres, zona horaria -05:00)
  src/servicios/          Servicio (SKU con precio fijo) y CodigoRepuesto (código universal, sin precio)
  src/relaciones/         RelacionVehiculo: copia local de lo que el concesionario dice del id_relacion
  src/prediagnostico/     agente.ts (modelo local → JSON) y reglas.ts (palabras clave, ruta, sede)
  src/ordenes/            Orden, Asignacion; reglas.ts (estados, PASOS, quién ve qué); service (citas, cola,
                          tomar, salida, siguiente_paso)
  src/diagnosticos/       Diagnostico, Tarea (servicio con causa y garantía), Repuesto (código + cantidad),
                          Evidencia; reglas.ts (archivos, listo para finalizar); service (guardar, remitir,
                          finalizar), evidencias.service (almacen/evidencias/)
  src/garantias/          reglas.ts (causas, dictamen sugerido, pagador, cobertura, regla del concesionario
                          simulado); service (solicitar validación, aplicar resultado)
  src/cotizaciones/       Compra (orden de compra de facturación); reglas.ts (armar la cotización y el
                          mensaje de garantía); service (cotización, respuesta del cliente, pago)
  src/reparaciones/       Reparacion, RegistroHoras, ParteUsada; reglas.ts (horas, eficiencia)
  src/integraciones/      Bandeja de salida (evento.entity, bandeja, despachador), conector MCP, contrato.ts,
                          idempotencia.ts (unaVez + mensajes_recibidos), concesionario/ (proveedor simulado o MCP)
  src/mcp/                herramientas.ts (servidor por petición; herramientasDe(rol)), flujo.ts (recursos)
  pruebas/                simular.mjs (casos), flujo.mjs (punta a punta REST), agentes.mjs (usuarios y
                          clientes MCP compartidos), entrar.mjs, probar-mcp.mjs, comun.mjs
docs/integracion/         README (flujo y diagrama), concesionario.md, facturacion.md, datos-simulados.md
web/src/
  api/                    cliente.ts (fetch + token en sessionStorage + 401 → salir; subirArchivo,
                          abrirArchivo), tipos.ts
  sesion/                 SesionProvider, usarSesion, RutaProtegida
  tema/                   TemaProvider, usarTema, InterruptorTema (claro/oscuro)
  logica/                 formato (pesos, fechas, tonos, nombres de estados, causas y pagadores),
                          permisos (espejo de la API), costos (espejo), usarDatos/usarAccion
  componentes/            Boton, Etiqueta/EstadoOrden, Avatar/GrupoAvatares, Superficies (Tarjeta, Contorno,
                          Ventana, Metrica, Encabezado, Ceja, Aviso, Cargando), Campos, Tabla, BarraNav,
                          Marca, FichaOrden (vehículo por VIN, garantía, mensajes, prediagnóstico)
  paginas/                Entrar, MisTrabajos, OrdenDetalle, Diagnostico, Reparacion, Usuarios, SinAcceso
  pruebas/                preparar.ts, utilidades.tsx (renderizar, simularApi y datos de prueba)
```

## Convenciones

- **Español en todo**: identificadores, rutas, archivos, mensajes de error y comentarios. Los comentarios explican el porqué, en frases cortas.
- **Una carpeta por funcionalidad** con `x.entity.ts`, `x.service.ts`, `dto.ts` y `reglas.ts`. Las reglas de negocio puras van en `reglas.ts` para probarlas sin base de datos. Los services orquestan; las rutas y el MCP no tienen lógica.
- **Las reglas viven en los services y en `reglas.ts`**: las cumple quien entre por cualquier puerta (web, MCP o simulador).
- **Errores**:
  - Lance `invalido`, `prohibido`, `noEncontrado`, `conflicto` o `noDisponible` (de `comun/errores.ts`). No use `throw new Error` para errores de negocio.
  - La ruta los vuelve `{ message }` con su código. El MCP los devuelve como resultado con `isError`.
  - Una orden que ya tomó otro mecánico responde 409.
- **Lo ajeno da 404, no 403**: un mecánico que pide una orden de otra sede o que no tiene asignada recibe 404 (`puedeVerOrden`).
- **TypeORM con Next**:
  - Cada `@Column` declara su `type`, porque no se usa la metadata de los decoradores.
  - Las relaciones usan `Relation<>`.
  - Toda entidad nueva se agrega a `base-datos/entidades.ts`.
  - Las columnas `numeric` usan el transformer `numerico`.
  - Las tablas solo cambian con migraciones (`synchronize: false`).
  - `bd()` rehace la conexión si la recarga en caliente cambió alguna clase de entidad.
- **Rutas**:
  - `export const runtime = 'nodejs'`.
  - Se envuelven con `ruta(ROLES, async ({ req, actor, params, url }) => …, estadoExito)`.
  - Los grupos de roles son `TALLER` (todos), `GESTION` (administrador y agente) y `SOLO_ADMIN` (`usuarios/rol.entity.ts`).
  - Los ids de la ruta se leen con `entero()`.
- **DTOs zod**: para editar, construya el esquema con campos **sin** `.default()`. `.partial()` conserva los defaults y reescribiría valores que no se enviaron.
- **Integraciones**:
  - Un service nunca llama directo a otro agente. Escribe con `encolar(tx, destino, herramienta, datos)` dentro de su transacción y después llama `avisarDespacho()`.
  - La única excepción es el concesionario: se consulta en línea con `concesionario()` (relación, VIN y garantía). Es el simulado si no hay `MCP_CONCESIONARIO_URL`.
- **Idempotencia**: toda herramienta MCP que cambia algo acepta `id_mensaje` y se envuelve con `unaVez(id_mensaje, herramienta, fn)`.
- **Sin inventario**: no hay existencias, precios de repuestos ni tiendas en el taller. Los repuestos se piden por código universal y cantidad; las partes usadas solo se registran.

## Reglas de dominio

**Estados de la orden** (mapa `SIGUIENTE` y `PASOS` en `ordenes/reglas.ts`):
- `agendada → en_diagnostico → (remitida → en_diagnostico) → validando_garantia → en_cotizacion → aprobada → en_reparacion → pendiente_facturacion → facturada → entregada`.
- `en_cotizacion → rechazada → entregada`: el vehículo sale sin reparar.
- Se puede pasar a `cancelada`, con motivo, desde cualquier estado antes de `en_reparacion`.

**Qué dispara cada cambio:**

| Llamada | Quién | Efecto |
|---|---|---|
| `agendar_cita` | Concesionario | Crea la orden `agendada` en una franja libre. Lleva los mensajes del cliente y el prediagnóstico, y puede venir `por_garantia`. Un `id_relacion` no puede tener dos órdenes abiertas. |
| `tomar_orden` | Mecánico de la sede | La saca de la cola: `agendada` o `remitida` pasan a `en_diagnostico`, y `aprobada` pasa a `en_reparacion`. |
| `remitir_orden` | Mecánico de mantenimiento | Agrega la tarea fija `REV-GENERAL` (hecha y cobrada) y pasa la orden a `remitida`, en la sede especializada. |
| `finalizar_diagnostico` | Mecánico | Pasa a `validando_garantia` y le pide la validación al concesionario. **Toda orden se consulta.** |
| `registrar_resultado_garantia` | Concesionario | Pasa a `en_cotizacion` y encola `crear_cotizacion` a facturación. |
| `registrar_respuesta_cliente` | Facturación | Pasa a `aprobada` (guarda la orden de compra) o a `rechazada`. |
| `terminar_reparacion` | Mecánico | Pasa a `pendiente_facturacion` y encola `notificar_reparacion_terminada`. |
| `registrar_pago` | Facturación | Pasa a `facturada`. |
| `registrar_salida` | Gestión | Pasa a `entregada`. |
| Cada cambio de estado | — | Encola `notificar_estado_vehiculo` al concesionario. |

**Prediagnóstico** (`prediagnostico/`):
- El agente lee los mensajes del cliente y responde con datos del catálogo:
  - Especialidad.
  - SKU probables.
  - Confianza.
  - Resumen.
  - **Ruta**:
    - `especializada`: confianza ≥ 0,6 y hay sede con esa especialidad.
    - `revision_general`: si no, va a mantenimiento.
- Si el modelo no responde o sale del catálogo, se usan las palabras clave del SKU (`fuente: 'reglas'`).

**Costos:**
- **Mano de obra** = Σ precio fijo del SKU de cada servicio. La revisión general se cobra junto con la especialidad.
- Las **horas** son solo de control. Un registro dura de 0 a 16 h, y para terminar hace falta al menos uno y un servicio hecho.
- **Repuestos**: el taller no los cotiza.
- `total_mano_obra_cliente` descuenta las líneas con garantía válida.

**Garantía** (`garantias/reglas.ts`):

| Causa | Dictamen sugerido | Paga si el concesionario la valida |
|---|---|---|
| `defecto_fabrica` | aplica | fabricante |
| `repuesto_defectuoso` | aplica | tienda |
| `mala_instalacion_taller` | aplica | taller |
| `manipulacion_cliente` | no aplica | cliente |
| `desgaste_normal` | no aplica | cliente |

- El mecánico puede cambiar el dictamen sugerido. Cada servicio con causa necesita un motivo.
- **Evidencia obligatoria** si el dictamen dice que aplica o si la orden vino por garantía. Son fotos JPG, PNG o WEBP, o PDF, de hasta 5 MB; el tipo se verifica por la firma del archivo.
- **Cobertura** desde el `id_relacion`: 3 años desde la venta o 60.000 km, y solo los sistemas que cubre.
- Si la garantía no es válida, paga el cliente. `mensaje_garantia` explica por qué, para el Telegram de facturación.

**Permisos:**

| Acción | Admin | Agente | Mecánico |
|---|---|---|---|
| Usuarios (con sede para el mecánico) | ✔ | — | — |
| Todas las herramientas MCP | ✔ | ✔ | Solo las suyas (`HERRAMIENTAS_MECANICO`) |
| Ver órdenes | Todas | Todas | La cola de su sede y las asignadas |
| Tomar una orden | Para un mecánico (`mecanico_id`) | Para un mecánico (`mecanico_id`) | Para sí, solo en su sede |
| Diagnóstico, evidencias, remitir, horas, partes, tareas | ✔ | ✔ | Solo si está asignado a esa etapa |
| Agendar, cancelar, garantía, cotización, pago, salida | ✔ | ✔ | — |
| Web | Mis trabajos (todas) + Usuarios | Sin pantallas | Mis trabajos, Orden, Diagnóstico, Reparación |

- **Los roles son fijos**: `administrador`, `mecanico` y `agente` (`ROLES_SISTEMA`). Los crea la semilla y no se pueden crear ni borrar.
- `agente` es el rol de los sistemas externos y orquestadores. Hay un usuario por sistema, para que el historial diga quién hizo cada cosa.
- Un mecánico **debe** tener sede.
- Si hace falta un rol nuevo, se agrega en `ROLES_SISTEMA`, en la semilla, en los permisos de la API, en `HERRAMIENTAS_MECANICO`/`herramientasDe` y en `web/src/logica/permisos.ts`.

## Estilo visual: `DESIGN.md` es obligatorio

La web usa el sistema «ClickUp» de `DESIGN.md`: tema claro, tipografía pesada, todo en píldoras y color solo en estados. Los tokens están copiados tal cual en `web/src/estilos.css` (`@theme`). Antes de tocar la interfaz:

**Tema claro y oscuro:**
- El claro es el de DESIGN.md y es el valor por defecto. El oscuro usa las superficies oscuras del mismo DESIGN.md: Dark Panel `#111111`, Ink Black `#202020`, Carbon `#2a2a2a` y Mist `#f8f9fa` como acción.
- El interruptor (`InterruptorTema`, en `web/src/tema/`) pone `data-tema="oscuro"` en `<html>` y recuerda la elección en `localStorage` (`taller.tema`). Un script en `index.html` lo aplica antes de pintar.
- Use **siempre los colores por significado**, que cambian solos con el tema: `bg-lienzo`, `bg-tarjeta`, `bg-banda`, `text-texto`, `text-titulo`, `text-texto-2`, `text-texto-3`, `border-borde`, `border-linea`, `bg-chip`, `bg-accion` / `text-accion-texto` y `bg-sutil`. Nunca un gris fijo (`text-slate`, `bg-white`…) para superficies o textos.
- Para un ajuste puntual en oscuro use la variante `dark:` (`dark:bg-carbon`).

**Sí:**
- **Tipografía**:
  - Plus Jakarta Sans 700/800 en títulos (`h1`–`h3` ya la usan), con tracking negativo (`text-heading` = 48 px, -0.035em).
  - Inter para el cuerpo (16 / 14 px).
  - Sometype Mono 12 px en MAYÚSCULAS con tracking 0.06em (utilidad `mono`) para cejas, encabezados de tabla, SKU y códigos de repuesto.
  - Las etiquetas de los campos van en Inter 14 px 500.
- **Botones** (`Boton`), siempre píldora (`rounded-full`), Plus Jakarta 14 px 700:
  - `primario`: `#202020` relleno (en oscuro, Mist). Uno por pantalla, para la acción principal.
  - `contorno`: borde `#e8e8e8`, sin relleno. Es el valor por defecto.
  - `azul`: borde azul `#0091ff`, para una acción interactiva secundaria (adjuntar evidencia, remitir).
  - `suave`: compacto, con fondo sutil, para filas y barras.
- **Estados** con `Etiqueta` / `EstadoOrden` (píldoras de 12 px 600):

  | Tono | Píldora | Estados de la orden |
  |---|---|---|
  | `progreso` | azul `#0091ff`, texto blanco | en diagnóstico, remitida, en reparación |
  | `revision` | violeta `#6647f0` | validando garantía, en cotización, pendiente de facturación (esperan a otro agente) |
  | `aprobado` | teal `#16c0a4` | aprobada |
  | `listo` | menta `#6ee7b7`, texto oscuro | facturada, entregada; garantía válida |
  | `alerta` | magenta `#fb49a5` (sale del degradado cónico) | rechazada; garantía no válida |
  | `neutro` | gris | agendada, cancelada |

- **Radios**: 9 px en campos (`rounded-lg`), 12 px en tarjetas y tablas (`rounded-xl`), 20 px en paneles grandes (`rounded-2xl-2`), píldora en botones, etiquetas y navegación.
- **Superficies planas**:
  - Tarjetas `bg-tarjeta` (`#f8f9fa`) con borde de 1 px `#e8e8e8` y 28 px de padding.
  - La única sombra es `shadow-subtle-2`, en `Ventana` (el panel tipo captura del producto).
- **Espaciado**: base de 4 px. `--spacing: 1px` hace que las utilidades numéricas sean píxeles (`p-28` = 28 px); use múltiplos de 4. Espacio entre secciones de 80 px y entre elementos de 12 px.
- **Identidad**: el logo es `web/public/logo-pulgas-locas.webp` (también es el favicon). Use siempre `Logo` / `Marca` de `componentes/Marca.tsx`, que lo ponen sobre una placa blanca (`bg-signal-white`) porque la imagen no es transparente. El nombre visible es «Pulgas Locas» con el lema «Mecánica general». En la API, el nombre sale de `NOMBRE_TALLER` (`config.ts`, variable `TALLER_NOMBRE`).
- **Avatares** (`Avatar`, `GrupoAvatares`) con iniciales para personas: mecánicos y usuario en sesión.
- **Borde arcoíris** (`borde-arcoiris`): el degradado cónico que gira, **uno por página como máximo** (hoy solo en la tarjeta de inicio de sesión). Gira cada 4 s, no cada 0,45 s como dice DESIGN.md (demasiado rápido para una pantalla de trabajo), y se detiene con `prefers-reduced-motion`.
- **Movimiento**: transiciones de 0.15 s en hover, curva `ease-asentar`.
- **Celular**: el mecánico trabaja junto al carro. La subida de evidencias usa `capture="environment"` para abrir la cámara.

**No:**
- Colores fuera de los tokens.
- Violeta o azul como relleno de botones. El violeta es solo el estado «espera a otro agente».
- Degradados en tarjetas o fondos (solo el borde arcoíris).
- Sombras fuertes o apiladas.
- Radios distintos dentro del mismo tipo de componente.
- Plus Jakarta por debajo de 14 px.
- Tracking positivo en texto normal (solo en `mono`).
- Menú lateral: solo la barra superior de 64 px, con los enlaces en píldora.

**Móvil:**
- Margen lateral de 16 px.
- Hasta `lg` los enlaces de la barra pasan a una segunda fila desplazable.
- Las tablas se desplazan dentro de su caja (`Tabla` ya lo hace) y la página nunca se desplaza en horizontal.

## MCP del taller

`POST /api/auth/token-mcp` (con sesión web) entrega un token de 7 días para `/mcp`. Con él
se crea un servidor por petición. `herramientasDe(rol)` da **todas** las herramientas al
`agente` y al administrador, y al mecánico solo las suyas.

**Herramientas** (agrupadas por quién las usa normalmente):

| Grupo | Herramientas |
|---|---|
| Orquestador | `describir_flujo`, `estado_orden`, `listar_ordenes` |
| Concesionario | `listar_talleres`, `prediagnosticar`, `consultar_disponibilidad`, `agendar_cita`, `cancelar_cita` (`destructiveHint`), `consultar_evidencias`, `registrar_resultado_garantia` |
| Facturación | `consultar_cotizacion`, `registrar_respuesta_cliente`, `registrar_pago` |
| Mecánico | `mis_ordenes`, `tomar_orden`, `consultar_diagnostico`, `registrar_diagnostico`, `adjuntar_evidencia` (base64), `remitir_orden`, `finalizar_diagnostico`, `consultar_reparacion`, `registrar_horas`, `registrar_parte_usada`, `marcar_tarea`, `terminar_reparacion`, `consultar_servicios`, `buscar_codigos_repuesto` |
| Administración | `registrar_taller`, `actualizar_taller`, `registrar_servicio`, `registrar_salida`, `consultar_bandeja`, `reintentar_envios` |

**Recursos:**
- `taller://flujo` y `taller://contrato`: salen de `mcp/flujo.ts`, generados con `SIGUIENTE`, `PASOS` y `CONTRATO`, así nunca se desactualizan.
- `taller://talleres` y `taller://servicios`.

**Reglas para las herramientas (son para orquestadores):**
- Cada herramienta declara `outputSchema` y devuelve `structuredContent`.
- Toda respuesta sobre una orden trae `estado`, `siguiente_paso { responsable, descripcion }` y `acciones_disponibles` (de `PASOS`).
- Las que cambian algo aceptan `id_mensaje` y usan `unaVez`.
- Sus esquemas zod son simples (sin `transform`). Dentro se valida con el DTO de la API (`validar(dto, …)`), así la normalización es la misma que en REST.
- Una herramienta nueva:
  1. Se registra en `herramientasDe` (y en `HERRAMIENTAS_MECANICO` si es del mecánico).
  2. Si es de un agente, se agrega a `ENTRANTES` de `mcp/flujo.ts`.
  3. Su prueba va en `src/mcp/herramientas.test.ts` (cliente en memoria).

**Conectar Claude Code:**
- `.mcp.json` registra este servidor.
- Defina `TALLER_MCP_TOKEN` en el entorno antes de abrir Claude Code.
- El token se obtiene con `node api/pruebas/entrar.mjs` y queda en `api/pruebas/.token-mcp`.

## Contrato con los otros agentes (MCP salientes)

Se configuran con `MCP_<DESTINO>_URL` y `MCP_<DESTINO>_TOKEN`.
- **Concesionario sin URL:** se usa el proveedor **simulado** (`integraciones/concesionario/simulado/`), que valida la garantía al instante.
- **Facturación sin URL:** el destino queda **desactivado**. El mensaje se guarda en `eventos_integracion` y se reenvía con `reintentar_envios`.
- Hay 5 intentos antes de quedar `fallido`.

El contrato está en `api/src/integraciones/contrato.ts`, con ejemplos en `docs/integracion/`.

| Destino | Herramienta que el taller llama | Cuándo |
|---|---|---|
| concesionario | `consultar_relacion { id_relacion }`, `decodificar_vin { vin }` | En línea, al prediagnosticar o agendar |
| concesionario | `validar_garantia { codigo, id_relacion, vin, por_garantia, motivo_reclamo, servicios[] }` | Al finalizar cada diagnóstico; responde con `registrar_resultado_garantia` |
| concesionario | `notificar_estado_vehiculo { codigo, id_relacion, placa, sede, estado, nota, fecha }` | En cada cambio de estado |
| facturacion | `crear_cotizacion { …, mano_obra[] con precio, repuestos[] sin precio, mensaje_garantia }` | Al validar la garantía; responde con `registrar_respuesta_cliente` |
| facturacion | `notificar_reparacion_terminada { mano_obra_realizada[], partes_usadas[], total_mano_obra }` | Al terminar la reparación; responde con `registrar_pago` |

## Pruebas: cada funcionalidad se da por válida solo con sus pruebas

- **API** (`api`, `npm run pruebas`):
  - Las reglas puras van en `src/**/reglas.ts` + `*.test.ts`.
  - Las rutas se prueban en `app/**/route.test.ts` con `vi.mock` de los services y `peticion()` / `conParams()` / `actorDe(rol, id, tallerId)` de `src/comun/pruebas.ts`.
  - Lo transaccional se prueba con un `EntityManager` falso (ver `ordenes.test.ts`, `diagnosticos.test.ts`).
  - El agente de prediagnóstico se prueba con el modelo simulado: respuesta válida, fuera de catálogo y caída.
  - El MCP se prueba con `InMemoryTransport` (`src/mcp/herramientas.test.ts`): qué ve cada rol, `id_mensaje` y `siguiente_paso`.
- **Web** (`web`, `npm run pruebas`):
  - La lógica va en `logica/*.test.ts`.
  - Componentes y páginas se prueban con `renderizar(ui, { actor, ruta, patron, rutas })` y `simularApi()` de `src/pruebas/utilidades.tsx`. Reemplazan fetch con una tabla de rutas, y un `FormData` llega tal cual.
  - Los datos de prueba (`orden()`, `diagnostico()`, `reparacion()`, `sede()`, `catalogo`) están en el mismo archivo.
- **Simulador** (`api`, `npm run simular -- todos`):
  - Corre los 11 casos de garantía, ruta, remisión y rechazo por MCP, siguiendo `siguiente_paso`.
  - Crea una vez los usuarios agente y un mecánico por sede, y guarda sus claves y tokens en `pruebas/.usuarios-simulacion.json` (en `.gitignore`).
- **Punta a punta** (`api`, `npm run flujo`):
  - El lado manual por REST: cola de la sede, tomar, remitir, diagnóstico con evidencia, reparación y partes usadas.
  - Revisa los permisos (401, 403, 404 de lo ajeno, 409, 400).
  - Reutiliza los tokens guardados, así no choca con el límite de 10 inicios de sesión por minuto.
- Los dos requieren la API en marcha y `TALLER_ADMIN_*`. Sin Ollama, el prediagnóstico usa reglas y los casos pasan igual.

## Antes de dar una tarea por terminada

1. `npm run tipos` y `npm run pruebas` en `api` y en `web`, sin errores.
2. Si cambió una entidad: `npm run migracion:generar -- src/base-datos/migraciones/<Nombre>`, revise el SQL y corra `npm run migracion:correr`.
3. Si cambió una regla o un permiso: actualice `web/src/logica/permisos.ts`, `costos.ts` o `formato.ts` (`dictamenSugerido`), que son espejos; las tablas de esta guía; y `docs/integracion/` si cambia el contrato.
4. Si tocó el flujo de órdenes o el MCP: `npm run simular -- todos` y `npm run flujo` con la API en marcha.
5. Si tocó la interfaz: revísela en el navegador en tema claro y oscuro, a ancho de escritorio y de móvil, contra las reglas de DESIGN.md.
