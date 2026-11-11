# ADR 0001. Modelo de datos del taller

**Estado:** aceptada · **Fecha:** 2026-11-10

## Contexto

El taller es una pieza de un ecosistema de cuatro servicios que se hablan por MCP. Cada servicio
tiene su propia base de datos y nadie lee las tablas de otro:

- El **concesionario** (AutoMax) es dueño de la relación cliente–vehículo (`id_relacion`), del VIN y de la garantía.
- **Facturación** cotiza los repuestos con las tiendas, le escribe al cliente y cobra.
- La **tienda de repuestos** tiene el catálogo, los precios y el inventario.

El taller necesita guardar lo suyo, que es recibir el carro, diagnosticarlo y repararlo, sin duplicar lo que es de otros.

## Decisión

1. **PostgreSQL con TypeORM**, una base (`taller`) solo para este servicio. Las tablas cambian únicamente con migraciones versionadas (`synchronize: false`).
2. **Sin tablas de clientes ni de vehículos propias.** `relaciones_vehiculo` es una copia local de lo que el concesionario responde sobre un `id_relacion` (VIN, placa, garantía), y se refresca al consultarlo. Los datos personales no salen por el MCP: `listar_ordenes` y `agendar_cita` ya no los devuelven.
3. **Sin inventario ni precios de repuestos.** `diagnostico_repuestos` guarda el código universal, el nombre, la categoría y la cantidad; el precio lo pone la tienda. `partes_usadas` registra lo que se usó.
4. **La orden es el centro.** `ordenes` lleva el estado, con las transiciones del mapa `SIGUIENTE` en `ordenes/reglas.ts`, y un código legible `OT-####`. Alrededor de la orden están:
   - `asignaciones`
   - `diagnosticos`, con sus tablas `diagnostico_tareas` y `evidencias`
   - `compras_repuestos`, que es la orden de compra de facturación
   - `reparaciones`, con sus tablas `registros_horas` y `partes_usadas`
5. **La mano de obra tiene precio fijo por servicio.** `servicios` es el catálogo de SKU con su precio y sus palabras clave. Las horas solo sirven de control.
6. **La integración también se guarda:**
   - `eventos_integracion` es la bandeja de salida: cada mensaje a otro servicio se escribe en la misma transacción que el cambio de estado y se reenvía con el mismo `id_mensaje`. Sus estados son pendiente, enviado, fallido y descartado.
   - `mensajes_recibidos` guarda la idempotencia de lo que llega, por `id_mensaje` y herramienta.
7. **Las decisiones del agente quedan registradas.** `prediagnosticos` guarda cada prediagnóstico (`PD-####`) con su fuente, modelo o reglas, y su confianza. `reservas_franja` aparta una hora 10 minutos (`RS-####`).

## Alternativas descartadas

- **Copiar clientes y vehículos en el taller**, como sugiere el kit del instructivo. Duplicaría datos personales que ya cuida el concesionario, y las dos copias se desincronizarían.
- **Guardar precios de repuestos.** El precio cambia en la tienda; una copia vieja haría que facturación cobrara mal.
- **Llamar a los otros servicios dentro de la transacción.** Si el otro servicio no responde, el cambio de estado quedaría a medias. La bandeja de salida separa el cambio, que es local y atómico, del envío, que se reintenta.

## Consecuencias

- **Positivas:** cada orden se puede reconstruir con sus eventos, el código y la base siempre coinciden gracias a las migraciones, y un reintento de otro servicio no duplica nada.
- **Costos:** para mostrar el vehículo hay que consultar al concesionario o usar la copia local. Para saber cuánto pagó el cliente por los repuestos hay que preguntarle a facturación.
- **Respaldo:** la base se respalda con `pg_dump` y se restaura con `pg_restore` sobre una base vacía, seguido de `npm run migracion:correr`. Una orden se reconstruye con `eventos_integracion` y `mensajes_recibidos`, filtrando por su código.
