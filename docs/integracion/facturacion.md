# Contrato con facturación

Facturación cotiza los repuestos con las tiendas, le escribe al cliente por Telegram y
cobra con PSE. El taller **no tiene inventario ni precios de repuestos**. Envía la mano de
obra con su precio fijo por SKU y los repuestos con su código universal y cantidad, que
es el mismo código en todas las tiendas.

## Lo que el taller llama en el MCP de facturación

Se configura con `MCP_FACTURACION_URL` y `MCP_FACTURACION_TOKEN`. Sin URL, los mensajes
quedan en la bandeja (`consultar_bandeja`). Facturación también puede leer todo con
`consultar_cotizacion` y avanzar sin recibir nada.

### crear_cotizacion

Se envía cuando el concesionario respondió la garantía (la orden pasa a `en_cotizacion`).
Cada línea lleva su garantía:
- `aplica`: el dictamen del mecánico.
- `valida`: la respuesta del concesionario.
- `pagador`: quién paga.
- `motivo`: el porqué.

Así facturación le avisa al cliente qué va por garantía y por qué. `mensaje_garantia` ya
trae ese texto listo para Telegram.

```json
{
  "codigo": "OT-0037",
  "id_relacion": "REL-1007",
  "taller": "Taller Pulgas Locas",
  "sede": "Pulgas Locas Frenos y Suspensión",
  "cliente": { "cedula": "79456123", "nombre": "Ricardo Peña", "telefono": "3113332211" },
  "vehiculo": { "vin": "9BWAG45U0PT700007", "placa": "RPN908", "descripcion": "Volkswagen Gol Trendline 2023 (Hatchback, 5 puertas)" },
  "mano_obra": [
    {
      "tarea_id": 40,
      "sku": "FRE-DISCOS",
      "descripcion": "Rectificación o cambio de discos",
      "precio": 140000,
      "causa": "desgaste_normal",
      "garantia": { "aplica": false, "valida": false, "pagador": "cliente", "motivo": "Desgaste normal: no lo cubre la garantía" }
    }
  ],
  "repuestos": [
    {
      "tarea_id": 40,
      "codigo_repuesto": "DIS-DEL-VENT",
      "descripcion": "Disco de freno delantero ventilado",
      "cantidad": 2,
      "garantia": { "aplica": false, "valida": false, "pagador": "cliente", "motivo": "Desgaste normal: no lo cubre la garantía" }
    }
  ],
  "hay_repuestos": true,
  "total_mano_obra": 140000,
  "total_mano_obra_cliente": 140000,
  "mensaje_garantia": "Lo revisado es desgaste normal: no lo cubre la garantía.",
  "responder_con": "registrar_respuesta_cliente"
}
```

Casos que cambian el mensaje:
- **Solo mano de obra.** No hacen falta repuestos: `repuestos` va vacío y `hay_repuestos` en `false`.
- **Garantía válida.** La línea lleva `valida: true` y el pagador es `fabricante`, `tienda` o `taller`. Esa línea no la paga el cliente (`total_mano_obra_cliente` la descuenta) y el mensaje empieza con «Va por garantía…».
- **Remitida.** La orden pasó por revisión general: `mano_obra` incluye `REV-GENERAL` (fija, ya hecha) además de los servicios del especialista.

### notificar_reparacion_terminada

Se envía al terminar la reparación (la orden pasa a `pendiente_facturacion`). Es lo que de
verdad se hizo y se gastó. Con esto facturación envía el PSE.

```json
{
  "codigo": "OT-0036",
  "id_relacion": "REL-1005",
  "cotizacion_ref": "FAC-OT-0036",
  "mano_obra_realizada": [
    { "tarea_id": 38, "sku": "REV-GENERAL", "descripcion": "Revisión general", "precio": 60000, "pagador": "cliente" },
    { "tarea_id": 39, "sku": "SUS-AMORT", "descripcion": "Cambio de amortiguadores", "precio": 150000, "pagador": "cliente" }
  ],
  "servicios_no_realizados": [],
  "partes_usadas": [
    { "codigo_repuesto": "AMO-DEL-GAS", "descripcion": "Amortiguador delantero a gas", "cantidad": 2, "compra_id": 24, "tienda": "AutoPartes La 68" }
  ],
  "total_mano_obra": 210000,
  "responder_con": "registrar_pago"
}
```

## Herramientas del taller que llama facturación

| Herramienta | Entrada | Para qué |
|---|---|---|
| `consultar_cotizacion` | `codigo` | Lo mismo que `crear_cotizacion`, más `estado`, `siguiente_paso` y la `orden_compra` ya registrada. |
| `registrar_respuesta_cliente` | `codigo`, `aceptada`, `motivo?`, `referencia?`, `orden_compra[]?`, `id_mensaje?` | El cliente respondió por Telegram. Si aceptó, la orden pasa a `aprobada`; si no, a `rechazada`. |
| `registrar_pago` | `codigo`, `referencia_pse`, `valor`, `id_mensaje?` | Pago PSE confirmado: la orden pasa a `facturada`. |
| `estado_orden` | `codigo` | Estado, `siguiente_paso` y `acciones_disponibles`. |

### registrar_respuesta_cliente

Cuando el cliente acepta, se envía la **orden de compra** que facturación armó con las
tiendas. El mecánico la ve como referencia de qué llega y de dónde, y desde ella marca las
partes usadas.

```json
{
  "codigo": "OT-0036",
  "aceptada": true,
  "referencia": "FAC-OT-0036",
  "orden_compra": [
    { "codigo_repuesto": "AMO-DEL-GAS", "descripcion": "Amortiguador delantero a gas", "cantidad": 2, "tienda": "AutoPartes La 68", "precio_unitario": 288300 }
  ],
  "id_mensaje": "fac-0b9d-respuesta-OT-0036"
}
```

- `pagador` en cada línea es opcional. Si no viene, se toma el de la línea de la cotización.
- Si el cliente rechaza: `{ "codigo": "OT-0037", "aceptada": false, "motivo": "El cliente no aceptó el valor" }`. El vehículo sale sin reparar con `registrar_salida`.

### registrar_pago

```json
{ "codigo": "OT-0036", "referencia_pse": "PSE-1761573279966", "valor": 210000, "id_mensaje": "fac-0b9d-pago-OT-0036" }
```

Solo se acepta con la orden en `pendiente_facturacion`. En otro estado responde
`isError` con «La orden … está …: no espera pago».

## Idempotencia y errores

- Envíe el mismo `id_mensaje` en los reintentos: el taller devuelve la respuesta de la primera vez.
- Los errores de negocio (estado equivocado o datos faltantes) vuelven con `isError: true` y se corrigen; no se reintentan.
- Un error de conexión o un 5xx sí se reintenta, con el mismo `id_mensaje`.
