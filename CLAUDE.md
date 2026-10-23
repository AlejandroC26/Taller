# Taller — guía para Claude

Sistema de gestión de un taller mecánico. Gira alrededor de la **orden de servicio**:

1. Recepción registra el carro.
2. Un mecánico lo diagnostica, paso a paso, con repuestos y costo.
3. El cliente aprueba.
4. Uno o varios mecánicos lo reparan, registrando horas y partes.
5. Se liquida y se entrega.

Hay tres roles humanos, **administrador**, **recepcionista** y **mecánico**, y uno técnico, **concesionario**, para el sistema que envía carros. La API también es un **servidor MCP** y está preparada para hablar con los MCP de otros proyectos: partes de vehículos, facturación y concesionario.

Sigue las convenciones de `../espiga-pro`:
- Todo en español.
- Una carpeta por funcionalidad.
- `config.ts` con `requerida()`.
- `base-datos/` con migraciones y semilla.
- Claves con scrypt.
- JWT con audiencias `web` y `mcp`.
- MCP de un servidor por petición.
- La carpeta `pruebas/` con CLIs `.mjs`.

## Stack y puertos

| Parte | Tecnología | Puerto |
|---|---|---|
| `api/` | Next.js 16 (App Router, solo rutas API) + TypeORM 1 + PostgreSQL 18 + zod 4 + jose | 3001 |
| `web/` | React 19 + Vite 8 + Tailwind CSS 4 + React Router 8 | 5173 (reenvía `/api` y `/mcp` a 3001) |
| MCP | `@modelcontextprotocol/server` 2 (Streamable HTTP en `/mcp`) | 3001 |
| Pruebas | Vitest 5 en los dos proyectos; Testing Library + jsdom en `web` | — |

- **Variables:** viven en `SENA-IA/.env` (compartido con los otros proyectos; ver `SENA-IA/.env.ejemplo`, sección Taller).
- **Valores de desarrollo:** se pueden poner en `api/.env.local`, que no se sube al repositorio.
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
npm run semilla               # roles, categorías, ítems de ejemplo y el administrador
npm run dev                   # http://localhost:3001
npm run pruebas               # pruebas unitarias (sin base de datos)
npm run tipos                 # tsc --noEmit
npm run flujo                 # prueba de punta a punta contra la API en marcha
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
  app/api/**/route.ts     Rutas delgadas: validan con zod (dto.ts) y llaman al service.
  app/mcp/route.ts        Puerta MCP: exige el token de audiencia 'mcp'.
  src/config.ts           RAIZ, requerida(), TARIFA_HORA. Carga SENA-IA/.env.
  src/comun/              errores.ts (ErrorHttp), http.ts (validar, leerCuerpo, entero),
                          guardia.ts (ruta(roles, fn), publica(fn)), limite.ts, columnas.ts, pruebas.ts
  src/base-datos/         entidades.ts (lista a mano), opciones.ts, conexion.ts (bd()),
                          fuente.ts (CLI de migraciones), semilla.ts, migraciones/
  src/usuarios/           Rol y Usuario, claves (scrypt), tokens (jose), actor, service, dto
  src/clientes/           Cliente y Vehiculo
  src/inventario/         Categoria, Item, Movimiento; reglas.ts (saldo, alerta)
  src/ordenes/            Orden, Asignacion; reglas.ts (estados, permisos, carga); service (panel, disponibilidad)
  src/diagnosticos/       Diagnostico, Tarea (paso), Repuesto; reglas.ts (costo estimado)
  src/reparaciones/       Reparacion, RegistroHoras, ParteUsada; reglas.ts (horas, liquidación, factura)
  src/integraciones/      Bandeja de salida (evento.entity, bandeja, despachador), conector MCP, contrato,
                          concesionario (ingreso de carros), partes (búsqueda en línea)
  src/mcp/herramientas.ts Servidor MCP por petición; herramientasDe(rol)
  pruebas/                flujo.mjs (punta a punta), entrar.mjs, probar-mcp.mjs, comun.mjs
web/src/
  api/                    cliente.ts (fetch + token en sessionStorage + 401 → salir), tipos.ts
  sesion/                 SesionProvider, usarSesion, RutaProtegida
  logica/                 formato, permisos (espejo de la API), costos (espejo), usarDatos/usarAccion
  componentes/            Boton, Etiqueta/Pulso/EstadoOrden, Superficies (Tarjeta, Contorno, Ventana,
                          Metrica, Encabezado, Aviso, Cargando), Campos, Tabla, BarraNav
  paginas/                Entrar, Panel, Ordenes, OrdenDetalle, Diagnostico, Reparacion, MisTrabajos,
                          Inventario, Clientes, Usuarios, Roles, Integraciones, SinAcceso
  pruebas/                preparar.ts, utilidades.tsx (renderizar, simularApi, orden)
```

## Convenciones

- **Español en todo**: identificadores, rutas, archivos, mensajes de error y comentarios. Los comentarios explican el porqué, en frases cortas.
- **Una carpeta por funcionalidad** con `x.entity.ts`, `x.service.ts`, `dto.ts` y `reglas.ts`. Las reglas de negocio puras van en `reglas.ts` para probarlas sin base de datos. Los services orquestan y las rutas no tienen lógica.
- **Las reglas viven en los services y en `reglas.ts`**, nunca en las rutas ni en el MCP: las cumple quien entre por cualquier puerta.
- **Errores**: lance `invalido`, `prohibido`, `noEncontrado`, `conflicto` (de `comun/errores.ts`). La ruta los vuelve `{ message }` con su código. El MCP los devuelve como resultado con `isError`. No use `throw new Error` para errores de negocio.
- **Lo ajeno da 404, no 403**: un mecánico que pide una orden que no tiene asignada recibe 404 (`puedeVerOrden`).
- **TypeORM con Next**:
  - Cada `@Column` declara su `type`, porque no se usa la metadata de los decoradores.
  - Las relaciones usan `Relation<>`.
  - Toda entidad nueva se agrega a `base-datos/entidades.ts`.
  - Las columnas `numeric` usan el transformer `numerico`, y los montos se redondean con `pesos()`.
  - Las tablas solo cambian con migraciones (`synchronize: false`).
- **Rutas**:
  - `export const runtime = 'nodejs'`.
  - Se envuelven con `ruta(ROLES, async ({ req, actor, params, url }) => …, estadoExito)`.
  - Los grupos de roles son `PERSONAL`, `TALLER` y `SOLO_ADMIN` (`usuarios/rol.entity.ts`).
  - Los ids de la ruta se leen con `entero()`.
- **DTOs zod**: para editar, construya el esquema con campos **sin** `.default()`. `.partial()` conserva los defaults y reescribiría valores que no se enviaron (ya pasó con kilometraje y nivel de alerta).
- **Existencias**: solo cambian con `moverExistencias(tx, …)`, dentro de una transacción. Esa función bloquea la fila (`FOR UPDATE`) y deja el `Movimiento`.
- **Integraciones**: un service nunca llama directo a otro proyecto. Escribe con `encolar(tx, destino, herramienta, datos)` dentro de su transacción y después llama `avisarDespacho()`.

## Reglas de dominio

**Estados de la orden** (mapa `SIGUIENTE` en `ordenes/reglas.ts`):
- `recibido → en_diagnostico → diagnosticado → aprobado → en_reparacion → terminado → entregado`.
- Se puede pasar a `cancelado` desde cualquier estado antes de `terminado`. Cancelar exige un motivo, cancela el diagnóstico en borrador y la reparación en curso, y no devuelve partes ya usadas.

**Qué dispara cada cambio:**
- Asignar el primer mecánico de **diagnóstico** abre el diagnóstico (tarifa = `TALLER_TARIFA_HORA`) y pasa la orden a `en_diagnostico`.
- Finalizar el diagnóstico la pasa a `diagnosticado`.
- Aprobar (recepción) la pasa a `aprobado`.
- Asignar el primer mecánico de **reparación** abre la reparación y la pasa a `en_reparacion`.
- Terminar fija el total y la pasa a `terminado`.
- Entregar la pasa a `entregado`.
- Un vehículo no puede tener dos órdenes abiertas.

**Costos:**
- **Costo estimado** = Σ(horas estimadas × tarifa) + Σ valor del servicio + Σ(cantidad × precio de los repuestos). Las piezas fuera de inventario llevan un precio estimado.
- **Liquidación** = Σ valor del servicio de las tareas **completadas** + Σ horas registradas × tarifa + Σ partes usadas (precio del momento).
- Un registro de horas dura de 0 a 16 h. Para terminar hace falta al menos uno.
- **Alerta de inventario**: cuando `cantidad <= nivel_alerta`. Una salida sin existencias responde 409.

**Permisos:**

| Acción | Admin | Recepción | Mecánico |
|---|---|---|---|
| Usuarios, roles, integraciones | ✔ | — | — |
| Clientes, vehículos, crear orden, asignar, aprobar, entregar, cancelar | ✔ | ✔ | — |
| Inventario: crear, editar, movimientos | ✔ | ✔ | Solo consulta |
| Registrar diagnóstico, horas, partes, tareas | ✔ | — | Solo si está asignado a esa etapa |
| Cambiar la tarifa por hora | ✔ | ✔ | — |
| Ver órdenes | Todas | Todas | Las asignadas |
| Panel | ✔ | ✔ | — |

- El rol `concesionario` solo usa `POST /api/integraciones/concesionario/ingresos`, `GET …/vehiculos/:referencia` y sus 2 herramientas MCP, y ve únicamente las órdenes de origen concesionario.
- Los roles nuevos que cree el administrador no tienen permisos hasta que se agreguen en el código.

## Estilo visual: `DESIGN.md` es obligatorio

La web usa el sistema «Factory» de `DESIGN.md`. Los tokens están copiados en `web/src/estilos.css` (`@theme`). Antes de tocar la interfaz:

**Sí:**
- Lienzo `#101010` en todo.
- Las únicas superficies claras son las tarjetas `Tarjeta` (`#eeeeee`, radio 10 px, padding 24 px, texto `#101010`). Ahí van los formularios.
- Use Geist 400 para todo y 500 solo para énfasis puntual.
- Geist Mono 12 px en MAYÚSCULAS (utilidad `mono`) para cejas, etiquetas de campos, encabezados de tabla y estados.
- Radios: 3 px en botones y campos (`rounded-sm`), 10 px en tarjetas (`rounded-lg`), 20 px en paneles grandes (`rounded-2xl`).
- Profundidad por contraste y bordes de 1 px (`border-carbon-lift` / `border-ash-stroke`).
- Transiciones de 0.15 s y nada más.
- `--spacing: 1px`: las utilidades numéricas son píxeles (`p-24` = 24 px, `gap-16` = 16 px). Use la escala de DESIGN.md: 8, 16, 24, 32, 40, 56, 80, 96, 120.
- **Color = estado**: naranja `signal-orange` para lo que está en curso o en alerta (pulso de 6 px), verde `metric-green` para listo o disponible. Use siempre `Etiqueta` / `EstadoOrden` / `Pulso`.

**No:**
- Colores nuevos.
- Sombras, brillos o desenfoques.
- Negrita 600+.
- Interlineado mayor a 1.5.
- Radios redondeados tipo píldora.
- Naranja o verde en botones, fondos o textos grandes.
- Otras fuentes.
- Menú lateral: solo la barra superior de 64 px.

**Botones** (`Boton`):
- `oscuro` (`#1d1a18`) en fondo oscuro.
- `claro` (`#fafafa`, texto `#101010`) para la acción principal de la página.
- `tinta` (`#101010`) dentro de tarjetas claras.
- `fantasma` (solo borde) para lo secundario, con `sobre="claro"` en tarjetas.

**Contradicciones del propio DESIGN.md ya resueltas:**
- Se ignora la «pill 9999px».
- El relleno oscuro es `carbon-lift`.
- El botón claro lleva texto `#101010`.

**Móvil:**
- Margen lateral de 16 px.
- Las tablas se desplazan dentro de su caja (`Tabla` ya lo hace) y la página nunca se desplaza en horizontal.

## MCP del taller

`POST /api/auth/token-mcp` (con sesión web) entrega un token de 7 días para `/mcp`. Con él se crea un servidor por petición, y `herramientasDe(rol)` decide qué ve cada rol.

**Herramientas por rol:**
- **Todos los del taller:**
  - `consultar_ordenes`
  - `consultar_diagnostico`
  - `consultar_reparacion`
  - `consultar_inventario`
- **Mecánico y admin:**
  - `registrar_diagnostico`
  - `finalizar_diagnostico`
  - `registrar_horas`
  - `registrar_parte_usada`
  - `marcar_tarea`
  - `terminar_reparacion`
- **Recepción y admin:**
  - `panel_taller`
  - `consultar_disponibilidad`
  - `asignar_mecanico`
  - `buscar_clientes`
  - `registrar_cliente`
  - `registrar_vehiculo`
  - `crear_orden`
  - `cambiar_estado_orden`
  - `actualizar_inventario`
  - `cancelar_orden` (`destructiveHint`)
- **Concesionario** (y personal):
  - `registrar_ingreso_vehiculo`
  - `estado_vehiculo`

**Reglas para las herramientas:**
- Sus esquemas zod son simples (sin `transform`) y dentro se valida con el DTO de la API (`validar(dto, …)`), así la normalización es la misma.
- Una herramienta nueva se registra en `herramientasDe` y con `if (si('nombre'))`. Agregue su prueba en `src/mcp/herramientas.test.ts` (cliente en memoria).

**Conectar Claude Code:** `.mcp.json` registra este servidor. Defina `TALLER_MCP_TOKEN` en el entorno antes de abrir Claude Code (se obtiene con `node api/pruebas/entrar.mjs`; queda en `api/pruebas/.token-mcp`).

## Contrato con los otros proyectos (MCP salientes)

Se configuran con `MCP_<DESTINO>_URL` y `MCP_<DESTINO>_TOKEN`. Sin URL, el destino está **desactivado**: el evento queda en `eventos_integracion` con ese estado y se reenvía con `POST /api/integraciones/reintentar` (o el botón en la pantalla Integraciones). Hay 5 intentos antes de quedar `fallido`. El contrato está en `api/src/integraciones/contrato.ts`:

| Destino | Herramienta que el taller llama | Cuándo |
|---|---|---|
| partes | `buscar_parte { texto }` | En línea, `GET /api/integraciones/partes?buscar=` |
| partes | `solicitar_parte { orden, placa, vehiculo, codigo, descripcion, cantidad }` | Al finalizar un diagnóstico con piezas fuera de inventario o sin stock |
| facturacion | `emitir_factura { orden, cliente, vehiculo, origen, lineas[{concepto,cantidad,valor_unitario}], total }` | Al terminar la reparación |
| concesionario | `notificar_estado_vehiculo { referencia_externa, placa, orden, estado, nota, fecha }` | En cada cambio de estado de una orden de origen concesionario |

En la otra dirección, el concesionario envía carros con `registrar_ingreso_vehiculo` (MCP) o `POST /api/integraciones/concesionario/ingresos`, y consulta con `estado_vehiculo`.

## Pruebas: cada funcionalidad se da por válida solo con sus pruebas

- **API** (`api`, `npm run pruebas`):
  - Las reglas puras van en `src/**/reglas.ts` + `*.test.ts`.
  - Las rutas se prueban en `app/**/route.test.ts` con `vi.mock` de los services y `peticion()` / `conParams()` / `actorDe()` de `src/comun/pruebas.ts`.
  - Lo transaccional se prueba con un `EntityManager` falso (ver `inventario.test.ts`, `ordenes.test.ts`).
  - El MCP se prueba con `InMemoryTransport` (`src/mcp/herramientas.test.ts`).
- **Web** (`web`, `npm run pruebas`):
  - La lógica va en `logica/*.test.ts`.
  - Componentes y páginas se prueban con `renderizar(ui, { actor, ruta, patron, rutas })` y `simularApi()` de `src/pruebas/utilidades.tsx`, que reemplazan fetch con una tabla de rutas.
- **Punta a punta** (`api`, `npm run flujo`): recorre el flujo completo con todos los roles contra la API y la base reales. Requiere la API en marcha y las variables `TALLER_ADMIN_*`. Cada corrida inicia sesión 6 veces y el límite es de 10 por minuto por IP: entre corridas, espere un minuto o recibirá 429.

## Antes de dar una tarea por terminada

1. `npm run tipos` y `npm run pruebas` en `api` y en `web`, sin errores.
2. Si cambió una entidad: `npm run migracion:generar -- src/base-datos/migraciones/<Nombre>`, revise el SQL y corra `npm run migracion:correr`.
3. Si cambió una regla o un permiso: actualice `web/src/logica/permisos.ts` o `costos.ts` (son espejos) y las tablas de esta guía.
4. Si tocó el flujo de órdenes: `npm run flujo` con la API en marcha.
5. Si tocó la interfaz: revísela en el navegador a ancho de escritorio y de móvil contra las reglas de DESIGN.md.
