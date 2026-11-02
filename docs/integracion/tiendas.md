# Tienda de repuestos

La tienda vende las partes y maneja su inventario. El taller **no compra ni guarda precios**:
solo consulta el catálogo para que el mecánico elija qué hace falta, por **código universal**
(PAS-DEL-CER, AMO-DEL-GAS…), que es el mismo en todas las tiendas. Facturación cotiza con ese
código (`consultar_precio_repuesto`), aparta lo que el cliente acepta y paga.

## Conexión

| Dato | Valor |
|---|---|
| MCP | `POST http://10.4.16.147:3100/mcp` (Streamable HTTP), red APRENDIZ |
| Autenticación | `Authorization: Bearer dev-mcp-token` |

En el taller (`api/.env.local` o `SENA-IA/.env`):

```
MCP_TIENDA_1_URL=http://10.4.16.147:3100/mcp
MCP_TIENDA_1_TOKEN=dev-mcp-token
MCP_TIENDA_1_NOMBRE=Tienda de repuestos
```

Hasta 9 tiendas (`MCP_TIENDA_2_…`). Sin ninguna, el taller usa la **tienda simulada**
([datos-simulados.md](datos-simulados.md)).

## Lo que el taller llama: el agente de la tienda

La tienda pide que el taller **no llame su herramienta de catálogo directamente**. El taller le
escribe a su agente `hablar_con_repuestos`, y la respuesta trae el campo `catalogo` tal como
sale del inventario (no del texto del modelo):

```json
{ "mensaje": "Somos el taller Taller Pulgas Locas. ¿Qué repuestos tienen disponibles? Respondan con el catálogo completo." }
```

```json
{
  "conversacion_id": "20e89eb2-74bd-4912-8b4d-abec784c6de3",
  "respuesta": "Aquí está el catálogo de repuestos disponibles: …",
  "datos": [],
  "catalogo": {
    "tienda": "Tienda de repuestos",
    "precio_incluye_iva": false,
    "total": 22,
    "repuestos": [
      { "codigo_repuesto": "PAS-DEL-CER", "nombre": "Juego de pastillas delanteras cerámicas", "categoria": "Frenos", "marcas": ["Bosch", "Brembo"], "unidades_disponibles": 11, "precio_desde": 144580 }
    ]
  }
}
```

- **Tiempo:** el agente tarda de 20 a 30 s. El taller lo espera hasta 45 s y **guarda el
  catálogo 5 minutos**. Las búsquedas del mecánico (por texto o categoría) se filtran en el
  taller y salen al instante. «Actualizar» en la web, o `refrescar: true`, lo pide de nuevo.
- **Sin precio:** `precio_desde` se descarta al leerlo (`integraciones/tiendas/proveedor.ts`).
- **Si el agente falla** o responde sin `catalogo`, el taller usa el último catálogo guardado
  y avisa «No respondió: …». No hay respaldo llamando a `catalogo_repuestos` directamente.
- **Varias tiendas:** un mismo código sale una vez, con las marcas y las tiendas juntas y las
  unidades sumadas.

## Del lado del taller

| Puerta | Uso |
|---|---|
| `buscar_repuestos_tienda { codigo, texto?, categoria?, refrescar? }` (MCP) | Devuelve `{ categorias, repuestos[{ codigo_repuesto, nombre, categoria, marcas, unidades_disponibles }], sin_respuesta, actualizado_en }`. |
| `GET /api/ordenes/:codigo/repuestos-tienda?texto=&categoria=&refrescar=true` | Lo mismo, para la web. |
| `registrar_diagnostico` | Cada repuesto va como `{ codigo_repuesto, cantidad }`. Un código que no está en el catálogo responde 400. |

El taller guarda **código universal, nombre, categoría y cantidad**. Eso va en
`crear_cotizacion.repuestos[]` a facturación ([facturacion.md](facturacion.md)).

## Lo que el taller no hace

`apartar_para_orden`, `entregar_orden`, `cancelar_orden` y `registrar_pago_orden` los usa
**facturación**. Facturación aparta cuando el cliente acepta; avisa qué se usó cuando el taller
termina (con `partes_usadas` de `notificar_reparacion_terminada`) y paga con la referencia PSE.
