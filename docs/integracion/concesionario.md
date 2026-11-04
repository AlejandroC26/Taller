# Contrato con el concesionario

El concesionario es dueño de la relación cliente–vehículo (`id_relacion`), de la API
pública del VIN y de la garantía. Le envía carros al taller y valida la garantía de
cada orden.

## Herramientas del taller que llama el concesionario

Todas están en `POST /mcp` con un token de rol `agente`. Las que cambian algo aceptan
`id_mensaje` (ver [idempotencia](README.md#reglas-para-los-agentes)).

| Herramienta | Entrada | Para qué |
|---|---|---|
| `listar_talleres` | `especialidad?`, `ciudad?` | Sedes con tipo, especialidades, ubicación y horario. |
| `enrutar_garantia` | `id_relacion`, `motivo_reclamo`, `mensajes_cliente[]?`, `vin?`, `kilometraje?`, `id_mensaje?` | Para un reclamo de garantía: a qué sede va (`taller`), `motivo_decision`, garantía probable e `id_prediagnostico`. |
| `prediagnosticar` | `id_relacion`, `mensajes_cliente[]` o `motivo_reclamo`, `vin?`, `por_garantia?`, `kilometraje?`, `id_mensaje?` | Lo mismo para cualquier cliente: especialidad, servicios probables con precio, confianza, ruta y sede. |
| `consultar_disponibilidad` | `taller` (id o código) y `desde` + `hasta?` (AAAA-MM-DD, hasta 14 días) o `fecha` | Con rango, solo las franjas libres; con `fecha`, todas las del día con sus cupos. |
| `reservar_franja` | `taller`, `fecha_hora`, `id_relacion`, `id_mensaje?` | Aparta la franja 10 minutos mientras el cliente confirma. Devuelve `id_reserva`. |
| `agendar_cita` | `id_relacion`, `id_prediagnostico?`, `id_reserva?`, `fecha_hora?` (obligatoria sin `id_reserva`), `taller?`, `mensajes_cliente[]?`, `sintomas?`, `kilometraje?`, `por_garantia?`, `motivo_reclamo?`, `id_mensaje?` | Crea la orden `agendada`. Con `id_prediagnostico` usa esa decisión sin recalcular; con `id_reserva`, la hora y la sede apartadas. |
| `cancelar_cita` | `codigo`, `motivo`, `id_mensaje?` | Cancela mientras no haya empezado la reparación. |
| `estado_orden` | `codigo` | La orden completa con `siguiente_paso` y `acciones_disponibles`. |
| `listar_ordenes` | `estado?`, `taller?`, `id_relacion?`, `abiertas?` | Órdenes filtradas. |
| `consultar_diagnostico` | `codigo` | Servicios, causa, dictamen del mecánico, repuestos y evidencias. |
| `consultar_evidencias` | `codigo` | Las evidencias con su URL de descarga. |
| `registrar_resultado_garantia` | `codigo`, `resultados[{ tarea_id, valida, motivo }]`, `id_mensaje?` | Responde a `validar_garantia`. La orden pasa a `en_cotizacion`. |
| `registrar_salida` | `codigo`, `nota?`, `id_mensaje?` | El vehículo sale, pagado o sin reparar. |

Las evidencias se descargan con `GET /api/evidencias/:id`, usando el token **web** del
mismo usuario agente, no el de MCP.

### Flujo de garantía, bot a bot

1. `enrutar_garantia` con el motivo del reclamo → `id_prediagnostico` y `taller`.
2. `consultar_disponibilidad { taller, desde, hasta }` → franjas libres para ofrecerle al cliente.
3. `reservar_franja` con la hora que elija → `id_reserva` (10 minutos).
4. Cuando el cliente dice «sí»: `agendar_cita { id_relacion, id_prediagnostico, id_reserva, id_mensaje }`.
5. El taller envía `notificar_estado_vehiculo` en cada cambio y `validar_garantia` al finalizar el diagnóstico.

### Ejemplo: enrutar_garantia

```json
{
  "id_relacion": "REL-1005",
  "vin": "9FBHJD204LM500005",
  "por_garantia": true,
  "motivo_reclamo": "Los frenos chillan mucho desde hace una semana",
  "mensajes_cliente": ["Vengo a cobrar la garantía porque los frenos chillan mucho"],
  "kilometraje": 98000,
  "id_mensaje": "conc-<uuid>-enrutar"
}
```

```json
{
  "id_prediagnostico": "PD-0012",
  "id_relacion": "REL-1005",
  "vehiculo": "Renault Duster Intens 1.3 Turbo 2020 (SUV, 5 puertas)",
  "taller": {
    "id": 2,
    "codigo": "PL-FRENOS",
    "nombre": "Pulgas Locas Frenos y Suspensión",
    "tipo": "especializado",
    "ubicacion": { "ciudad": "Bogotá", "direccion": "Avenida Boyacá # 64-20, Normandía", "latitud": 4.667, "longitud": -74.111 },
    "horario": { "dias": [1, 2, 3, 4, 5], "apertura": "07:00", "cierre": "16:00" }
  },
  "especialidad": "frenos",
  "servicios": ["FRE-DISCOS", "FRE-LIQUIDO"],
  "confianza": 0.9,
  "resumen": "Frenos: rectificación o cambio de discos y purga y cambio de líquido de frenos",
  "fuente": "modelo",
  "ruta": "especializada",
  "motivo_decision": "Lo que cuenta el cliente apunta a frenos (rectificación o cambio de discos, purga y cambio de líquido de frenos). Por eso va directo a Pulgas Locas Frenos y Suspensión, la sede especialista.",
  "garantia": {
    "vigente": false,
    "vence": "2023-02-17",
    "kmMaximo": 60000,
    "cubre": ["frenos", "suspension", "motor", "electrico", "transmision"],
    "motivo": "La garantía venció el 2023-02-17",
    "aplica_probable": false,
    "causa_probable": "desgaste_normal"
  },
  "por_garantia": true,
  "motivo_reclamo": "Los frenos chillan mucho desde hace una semana",
  "servicios_probables": [
    { "sku": "FRE-DISCOS", "nombre": "Rectificación o cambio de discos", "precio_mano_obra": 140000 },
    { "sku": "FRE-LIQUIDO", "nombre": "Purga y cambio de líquido de frenos", "precio_mano_obra": 60000 }
  ],
  "sede_sugerida": { "…": "igual que taller" },
  "siguiente_paso": { "responsable": "concesionario", "descripcion": "Consultar disponibilidad en PL-FRENOS (consultar_disponibilidad con desde y hasta), apartar la hora con reservar_franja y agendar con agendar_cita enviando id_prediagnostico" },
  "acciones_disponibles": ["consultar_disponibilidad", "reservar_franja", "agendar_cita"]
}
```

`prediagnosticar` responde igual; ahí `motivo_reclamo` es opcional y `por_garantia` vale `false`
si no se envía.

- **`fuente`**: `modelo` si lo decidió el agente de IA (`LOCAL_URL`); `reglas` si se usaron las palabras clave del catálogo, porque el modelo no respondió o su confianza fue menor a 0,6.
- **`garantia.aplica_probable` y `causa_probable`** son una estimación por lo que cuenta el cliente (por ejemplo, «chillan» apunta a desgaste normal). Quien decide es el mecánico, con evidencias, y quien valida es el concesionario.
- **`kilometraje`**: si supera los 60.000 km, la garantía sale como no vigente aunque la fecha no haya vencido.
- **`vin`**: si no es el del `id_relacion`, responde «El VIN … no corresponde al id_relacion …».
- **Revisión general**: con un mensaje ambiguo («hace un ruido raro, no sé qué es»), la ruta es `revision_general`, `taller` es la sede de mantenimiento y `motivo_decision` lo explica.

**Tiempo de respuesta.** El modelo tiene `LOCAL_TIEMPO_MS` (8 s por defecto, 22 s como máximo); si
no alcanza, siguen las reglas. La herramienta completa responde en menos de 30 s: si algo no
alcanza, devuelve `isError: true` con «No se pudo calcular el prediagnóstico a tiempo, intente de
nuevo», nunca un corte. Con el mismo `id_mensaje`, un reintento devuelve el mismo
`id_prediagnostico` sin volver a llamar al modelo.

### Ejemplo: consultar_disponibilidad por rango

```json
{ "taller": "PL-FRENOS", "desde": "2026-11-05", "hasta": "2026-11-12" }
```

```json
{
  "taller": { "codigo": "PL-FRENOS", "nombre": "Pulgas Locas Frenos y Suspensión", "horario": { "dias": [1, 2, 3, 4, 5], "apertura": "07:00", "cierre": "16:00" } },
  "desde": "2026-11-05",
  "hasta": "2026-11-12",
  "cupo_por_franja": 1,
  "franjas": [
    { "inicio": "2026-11-05T14:00:00-05:00", "libres": 1 },
    { "inicio": "2026-11-05T15:00:00-05:00", "libres": 1 }
  ],
  "total": 47,
  "siguiente_paso": { "responsable": "concesionario", "descripcion": "Ofrézcale las horas al cliente; aparte la que elija con reservar_franja mientras confirma" },
  "acciones_disponibles": ["reservar_franja", "agendar_cita"]
}
```

Sin `hasta`, el rango es de una semana. Más de 14 días responde «Consulte como máximo 14 días por
vez». Las citas y las horas apartadas por otros vehículos no aparecen. Con `fecha` (un solo día)
sigue funcionando como antes: todas las franjas, también las llenas (`libres: 0`).

### Ejemplo: reservar_franja

```json
{ "taller": "PL-FRENOS", "fecha_hora": "2026-11-05T14:00:00-05:00", "id_relacion": "REL-1005", "id_mensaje": "conc-<uuid>-reservar" }
```

```json
{
  "id_reserva": "RS-0012",
  "id_relacion": "REL-1005",
  "taller": { "codigo": "PL-FRENOS", "nombre": "Pulgas Locas Frenos y Suspensión", "…": "…" },
  "fecha_hora": "2026-11-05T14:00:00-05:00",
  "vence_en": "2026-11-04T01:52:36-05:00",
  "minutos_vigencia": 10,
  "siguiente_paso": { "responsable": "concesionario", "descripcion": "Confirme la hora con el cliente y agende con agendar_cita enviando id_reserva (y id_prediagnostico) antes de 10 minutos" },
  "acciones_disponibles": ["agendar_cita", "reservar_franja"]
}
```

- Mientras está vigente, la franja ocupa cupo: para otro vehículo responde «Esa franja ya está llena».
- Un vehículo tiene una sola reserva vigente: apartar otra hora libera la anterior.
- Si vence, ya no aparta nada, pero `agendar_cita` con ese `id_reserva` funciona si la franja sigue libre.

### Ejemplo: agendar_cita

Con lo ya decidido (el caso del concesionario):

```json
{ "id_relacion": "REL-1005", "id_prediagnostico": "PD-0012", "id_reserva": "RS-0012", "id_mensaje": "conc-<uuid>-agendar" }
```

- La sede sale de `taller`, si se envía; si no, de la reserva, y si no, del prediagnóstico. La hora sale de la reserva, o de `fecha_hora`.
- Con `id_prediagnostico` **no se recalcula** el prediagnóstico: la orden guarda el mismo, con sus mensajes, `por_garantia`, `motivo_reclamo` y kilometraje, salvo que se envíen otros.
- Sin `id_prediagnostico` sigue funcionando como antes: con `fecha_hora` y `mensajes_cliente`, el taller lo calcula.

La respuesta es la orden, igual que en `estado_orden`. Su `outputSchema` garantiza `codigo`,
`estado`, `siguiente_paso`, `acciones_disponibles`, `sede { id, codigo, nombre, ubicacion }`,
`fecha_cita` (ISO 8601 con zona `-05:00`), `por_garantia` y `motivo_reclamo`. Se ve así, recortada:

```json
{
  "codigo": "OT-0037",
  "estado": "agendada",
  "siguiente_paso": { "responsable": "mecanico", "descripcion": "Cita agendada: cuando llegue el vehículo, un mecánico de la sede toma la orden" },
  "acciones_disponibles": ["tomar_orden", "cancelar_cita"],
  "sede": { "id": 2, "codigo": "PL-FRENOS", "nombre": "Pulgas Locas Frenos y Suspensión", "tipo": "especializado", "ubicacion": { "ciudad": "Bogotá", "direccion": "Avenida Boyacá # 64-20, Normandía" } },
  "fecha_cita": "2026-10-28T09:00:00-05:00",
  "id_relacion": "REL-1007",
  "cliente": { "cedula": "79456123", "nombre": "Ricardo Peña", "telefono": "3113332211" },
  "vehiculo": { "vin": "9BWAG45U0PT700007", "marca": "Volkswagen", "modelo": "Gol", "anio": 2023, "carroceria": "Hatchback", "puertas": 5, "placa": "RPN908", "kilometraje": 22800 },
  "garantia": { "vigente": true, "vence": "2027-10-30", "kmMaximo": 60000, "cubre": ["motor", "transmision", "electrico"] },
  "prediagnostico": { "especialidad": "frenos", "ruta": "especializada", "confianza": 1, "fuente": "reglas", "servicios": ["FRE-DISCOS", "FRE-PASTILLAS"] },
  "por_garantia": false,
  "historial": [{ "estado": "agendada", "fecha": "2026-10-27T13:55:21.454Z", "usuario": "Agente Concesionario", "nota": "Cita en Pulgas Locas Frenos y Suspensión" }]
}
```

**Idempotencia.** Con el mismo `id_mensaje` (por ejemplo `conc-<uuid>-agendar`, hasta 120
caracteres), un reintento devuelve la misma orden y no crea otra. Si el reintento llega mientras
la primera llamada todavía no termina, puede responder «El vehículo ya tiene la orden … abierta»:
consulte `listar_ordenes { id_relacion, abiertas: true }` y use esa orden.

**Errores de negocio** (`isError: true`, mensaje en español):

| Caso | Mensaje |
|---|---|
| Ya hay una orden abierta | «El vehículo ya tiene la orden OT-0072 abierta» |
| Franja llena | «Esa franja ya está llena: elija otra con consultar_disponibilidad» |
| Hora que no es una franja | «Esa hora no es una franja de la sede: consulte consultar_disponibilidad» |
| Sede que no existe | «No existe la sede PL-NOEXISTE» |
| Sin hora | «Envíe fecha_hora o id_reserva» |
| Prediagnóstico de otro vehículo | «El prediagnóstico PD-0012 es de otro id_relacion» |
| Reserva ya usada o reemplazada | «La reserva RS-0012 ya no está vigente: aparte la hora de nuevo con reservar_franja» |
| Reserva en otra sede u hora | «La reserva RS-0012 es en …, no en …» / «La reserva RS-0012 es para …, no para …» |
| `id_relacion` desconocido | «El concesionario no reconoce el id_relacion REL-9999. El cliente debe obtenerlo en el concesionario con su cédula y el VIN» |

### Ejemplo: registrar_resultado_garantia

```json
{
  "codigo": "OT-0012",
  "resultados": [
    { "tarea_id": 31, "valida": true, "motivo": "Garantía válida: defecto de fábrica" },
    { "tarea_id": 32, "valida": false, "motivo": "Desgaste normal: no lo cubre la garantía" }
  ],
  "id_mensaje": "conc-5b1e-garantia-OT-0012"
}
```

Hay que responder **todos** los servicios que llegaron en `validar_garantia`. El taller
calcula quién paga cada línea con la causa: una garantía válida la paga el responsable,
por dispersión. Después envía la cotización a facturación.

## Lo que el taller llama en el MCP del concesionario

Se configura con `MCP_CONCESIONARIO_URL` y `MCP_CONCESIONARIO_TOKEN`. Sin URL se usa el
concesionario simulado ([datos-simulados.md](datos-simulados.md)), que responde al
instante.

| Herramienta | Cuándo | Respuesta esperada |
|---|---|---|
| `consultar_relacion { id_relacion }` | Al prediagnosticar o agendar | Cliente, VIN, placa, kilometraje, cabecera del VIN y cobertura de la garantía (ejemplo abajo). |
| `decodificar_vin { vin }` | Con la relación | La cabecera del VIN: marca, modelo, versión, carrocería, puertas, motor, combustible y transmisión. |
| `validar_garantia { … }` | Al finalizar cada diagnóstico | Ninguna. El concesionario responde después con `registrar_resultado_garantia`. |
| `notificar_estado_vehiculo { … }` | En cada cambio de estado | Un acuse de recibo. |

### consultar_relacion

La respuesta se lee tal cual como `DatosRelacion` (`api/src/integraciones/concesionario/proveedor.ts`).
Por eso sus campos van en camelCase. La cobertura ya viene calculada por el concesionario.

```json
{
  "idRelacion": "REL-1001",
  "cedula": "1020304050",
  "cliente": "Laura Mejía",
  "telefono": "3015556677",
  "vin": "9FBHJD204PM100001",
  "placa": "LMX201",
  "kilometraje": 18200,
  "cabeceraVin": { "vin": "9FBHJD204PM100001", "marca": "Renault", "modelo": "Duster", "anio": 2023, "version": "Intens 1.3 Turbo", "carroceria": "SUV", "puertas": 5, "motor": "1.3 L turbo", "combustible": "Gasolina", "transmision": "Automática CVT" },
  "garantia": { "vigente": true, "vence": "2028-03-14", "kmMaximo": 60000, "cubre": ["frenos", "suspension", "motor", "electrico", "transmision"] }
}
```

Si no existe la relación, responda `null`: el taller contesta que el concesionario no reconoce
ese `id_relacion`. Si no hay conexión, el taller responde 503 y no agenda.

### validar_garantia

```json
{
  "codigo": "OT-0012",
  "id_relacion": "REL-1001",
  "vin": "9FBHJD204PM100001",
  "por_garantia": true,
  "motivo_reclamo": "Desgaste prematuro de pastillas con 18.000 km",
  "servicios": [
    {
      "tarea_id": 31,
      "sku": "FRE-PASTILLAS",
      "especialidad": "frenos",
      "causa": "defecto_fabrica",
      "aplica": true,
      "motivo": "Compuesto de las pastillas de fábrica cristalizado a los 18.000 km",
      "evidencias": ["http://localhost:3417/api/evidencias/14", "http://localhost:3417/api/evidencias/15"]
    }
  ],
  "responder_con": "registrar_resultado_garantia"
}
```

Esta es la regla del concesionario simulado. Un concesionario real puede tener la suya.

| Situación | Resultado |
|---|---|
| Servicio sin causa | No válida. |
| El mecánico dijo «no aplica» | No válida: «Manipulación del cliente: …», «Desgaste normal…» u otro motivo. |
| Sin garantía vigente (más de 3 años o más de 60.000 km) | No válida: «La garantía venció el …». |
| La garantía no cubre ese sistema | No válida. |
| Sin evidencias | No válida. |
| Ninguna de las anteriores | Válida. |

### notificar_estado_vehiculo

```json
{
  "codigo": "OT-0037",
  "id_relacion": "REL-1007",
  "placa": "RPN908",
  "sede": "Pulgas Locas Frenos y Suspensión",
  "estado": "entregada",
  "nota": "Sale sin reparar",
  "fecha": "2026-10-27T13:55:23.763Z"
}
```
