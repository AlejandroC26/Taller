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
| `prediagnosticar` | `id_relacion`, `mensajes_cliente[]` | Especialidad, servicios probables con precio, confianza, ruta y sede sugerida. |
| `consultar_disponibilidad` | `taller` (id o código), `fecha` (AAAA-MM-DD) | Franjas de una hora con los cupos libres. |
| `agendar_cita` | `id_relacion`, `fecha_hora`, `taller?`, `mensajes_cliente[]?`, `sintomas?`, `kilometraje?`, `por_garantia?`, `motivo_reclamo?`, `id_mensaje?` | Crea la orden `agendada`. Sin prediagnóstico lo calcula y, sin sede, usa la sugerida. |
| `cancelar_cita` | `codigo`, `motivo`, `id_mensaje?` | Cancela mientras no haya empezado la reparación. |
| `estado_orden` | `codigo` | La orden completa con `siguiente_paso` y `acciones_disponibles`. |
| `listar_ordenes` | `estado?`, `taller?`, `id_relacion?`, `abiertas?` | Órdenes filtradas. |
| `consultar_diagnostico` | `codigo` | Servicios, causa, dictamen del mecánico, repuestos y evidencias. |
| `consultar_evidencias` | `codigo` | Las evidencias con su URL de descarga. |
| `registrar_resultado_garantia` | `codigo`, `resultados[{ tarea_id, valida, motivo }]`, `id_mensaje?` | Responde a `validar_garantia`. La orden pasa a `en_cotizacion`. |
| `registrar_salida` | `codigo`, `nota?`, `id_mensaje?` | El vehículo sale, pagado o sin reparar. |

Las evidencias se descargan con `GET /api/evidencias/:id`, usando el token **web** del
mismo usuario agente, no el de MCP.

### Ejemplo: prediagnosticar

```json
{ "id_relacion": "REL-1001", "mensajes_cliente": ["Desde la semana pasada el carro chilla al frenar"] }
```

```json
{
  "id_relacion": "REL-1001",
  "vehiculo": "Renault Duster Intens 1.3 Turbo 2023 (SUV, 5 puertas)",
  "garantia": { "vigente": true, "vence": "2028-03-14", "kmMaximo": 60000, "cubre": ["frenos", "suspension", "motor", "electrico", "transmision"] },
  "especialidad": "frenos",
  "servicios": ["FRE-PASTILLAS"],
  "confianza": 1,
  "resumen": "Por lo que cuenta el cliente («Desde la semana pasada el carro chilla al frenar»), apunta a frenos.",
  "fuente": "reglas",
  "ruta": "especializada",
  "servicios_probables": [{ "sku": "FRE-PASTILLAS", "nombre": "Cambio de pastillas de freno", "precio_mano_obra": 80000 }],
  "sede_sugerida": {
    "id": 2,
    "codigo": "PL-FRENOS",
    "nombre": "Pulgas Locas Frenos y Suspensión",
    "tipo": "especializado",
    "ubicacion": { "ciudad": "Bogotá", "direccion": "Avenida Boyacá # 64-20, Normandía", "latitud": 4.667, "longitud": -74.111 }
  },
  "siguiente_paso": { "responsable": "concesionario", "descripcion": "Agende la cita en la sede especializada sugerida (consultar_disponibilidad → agendar_cita)" },
  "acciones_disponibles": ["consultar_disponibilidad", "agendar_cita"]
}
```

`fuente` dice de dónde salió la respuesta:
- `modelo`: el agente de IA (`LOCAL_URL`).
- `reglas`: las palabras clave del catálogo. Se usan si el modelo no responde o su confianza es menor a 0,6.

**Tiempo de respuesta.** El modelo tiene `LOCAL_TIEMPO_MS` (8 s por defecto) para responder; si
no alcanza, siguen las reglas. La herramienta completa responde en menos de 45 s: si algo no
alcanza, devuelve `isError: true` con «No se pudo calcular el prediagnóstico a tiempo, intente de
nuevo», nunca un corte. El `outputSchema` publica todos los campos de arriba.

Con un mensaje ambiguo («hace un ruido raro, no sé qué es»), la ruta es
`revision_general` y la sede sugerida es la de mantenimiento.

### Ejemplo: agendar_cita

```json
{
  "id_relacion": "REL-1001",
  "taller": "PL-FRENOS",
  "fecha_hora": "2026-10-28T09:00:00-05:00",
  "mensajes_cliente": ["Desde la semana pasada el carro chilla al frenar", "Las pastillas se gastaron muy rápido"],
  "por_garantia": true,
  "motivo_reclamo": "Desgaste prematuro de pastillas con 18.000 km",
  "id_mensaje": "conc-7f3c2a10-agendar"
}
```

La respuesta es la orden, igual que en `estado_orden`. Su `outputSchema` garantiza `codigo`,
`estado`, `siguiente_paso`, `acciones_disponibles`, `sede { id, codigo, nombre, ubicacion }` y
`fecha_cita` (ISO 8601 con zona `-05:00`). Se ve así, recortada:

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
