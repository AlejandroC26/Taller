# Datos simulados

Mientras no exista el concesionario real (sin `MCP_CONCESIONARIO_URL`), el taller usa el
proveedor simulado de `api/src/integraciones/concesionario/simulado/`. Este responde con
los datos de abajo y valida la garantía al instante con la regla de
[concesionario.md](concesionario.md#validar_garantia).

## Relaciones cliente–vehículo

La garantía de fábrica dura **3 años desde la venta o 60.000 km**, lo que pase primero.
El estado de la tabla es al 27 de octubre de 2026.

| id_relacion | Cliente | Placa | VIN | Vehículo | Km | Venta | Garantía | Cubre |
|---|---|---|---|---|---|---|---|---|
| REL-1001 | Laura Mejía | LMX201 | 9FBHJD204PM100001 | Renault Duster 2023 | 18.200 | 2025-03-14 | vigente | todo |
| REL-1002 | Carlos Rojas | CRB552 | 3MZBP2SM1RM200002 | Mazda 3 2024 | 31.500 | 2024-08-02 | vigente | todo |
| REL-1003 | Diana Cárdenas | DCK834 | 9BWAG45U0NT300003 | Volkswagen Gol 2022 | 42.000 | 2023-11-20 | vigente | tren motriz |
| REL-1004 | Andrés Pardo | APQ119 | KMHCT41DBMU400004 | Hyundai Accent 2021 | 75.400 | 2022-05-09 | **vencida** (fecha y km) | todo |
| REL-1005 | Marta Gil | MGL630 | 9FBHJD204LM500005 | Renault Duster 2020 | 98.000 | 2020-02-17 | **vencida** (fecha y km) | todo |
| REL-1006 | Julián Ortiz | JOT741 | 3MZBP2SM1SM600006 | Mazda 3 2025 | 6.100 | 2026-01-25 | vigente | todo |
| REL-1007 | Ricardo Peña | RPN908 | 9BWAG45U0PT700007 | Volkswagen Gol 2023 | 22.800 | 2024-10-30 | vigente | tren motriz |
| REL-1008 | Sofía Vargas | SVG275 | KMHCT41DBRU800008 | Hyundai Accent 2024 | 12.900 | 2025-07-01 | vigente | todo |

- **Todo:** frenos, suspensión, motor, eléctrico y transmisión.
- **Tren motriz:** motor, transmisión y eléctrico. Un reclamo de frenos en REL-1003 o REL-1007 se niega porque la garantía no cubre ese sistema.

### Ficha completa (cliente y cabecera del VIN)

Es lo que responden `consultar_relacion` y `decodificar_vin` simulados. El concesionario
puede cargar estos mismos datos para que los dos sistemas coincidan.

| id_relacion | Cédula | Cliente | Teléfono | Placa | VIN | Marca | Modelo | Año | Versión | Carrocería | Puertas | Motor | Combustible | Transmisión |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| REL-1001 | 1020304050 | Laura Mejía | 3015556677 | LMX201 | 9FBHJD204PM100001 | Renault | Duster | 2023 | Intens 1.3 Turbo | SUV | 5 | 1.3 L turbo | Gasolina | Automática CVT |
| REL-1002 | 80123456 | Carlos Rojas | 3104445566 | CRB552 | 3MZBP2SM1RM200002 | Mazda | 3 | 2024 | Touring Sedán | Sedán | 4 | 2.0 L Skyactiv-G | Gasolina | Automática 6 vel. |
| REL-1003 | 52987654 | Diana Cárdenas | 3201112233 | DCK834 | 9BWAG45U0NT300003 | Volkswagen | Gol | 2022 | Trendline | Hatchback | 5 | 1.6 L MSI | Gasolina | Manual 5 vel. |
| REL-1004 | 1015432198 | Andrés Pardo | 3157778899 | APQ119 | KMHCT41DBMU400004 | Hyundai | Accent | 2021 | GL Coupé | Coupé | 2 | 1.6 L | Gasolina | Manual 6 vel. |
| REL-1005 | 39765432 | Marta Gil | 3009998877 | MGL630 | 9FBHJD204LM500005 | Renault | Duster | 2020 | Intens 1.3 Turbo | SUV | 5 | 1.3 L turbo | Gasolina | Automática CVT |
| REL-1006 | 1032456789 | Julián Ortiz | 3186665544 | JOT741 | 3MZBP2SM1SM600006 | Mazda | 3 | 2025 | Touring Sedán | Sedán | 4 | 2.0 L Skyactiv-G | Gasolina | Automática 6 vel. |
| REL-1007 | 79456123 | Ricardo Peña | 3113332211 | RPN908 | 9BWAG45U0PT700007 | Volkswagen | Gol | 2023 | Trendline | Hatchback | 5 | 1.6 L MSI | Gasolina | Manual 5 vel. |
| REL-1008 | 1098765432 | Sofía Vargas | 3054443322 | SVG275 | KMHCT41DBRU800008 | Hyundai | Accent | 2024 | GL Coupé | Coupé | 2 | 1.6 L | Gasolina | Manual 6 vel. |

## La API del VIN

El modelo sale de los 6 primeros caracteres y el año del décimo (L = 2020 … T = 2026).

| Prefijo | Vehículo |
|---|---|
| 9FBHJD | Renault Duster Intens 1.3 Turbo, SUV, 5 puertas, CVT |
| 3MZBP2 | Mazda 3 Touring, sedán, 4 puertas, automática 6 vel. |
| 9BWAG4 | Volkswagen Gol Trendline, hatchback, 5 puertas, manual 5 vel. |
| KMHCT4 | Hyundai Accent GL Coupé, 2 puertas, manual 6 vel. |

## Sedes (semilla)

| Código | Tipo | Especialidades | Horario |
|---|---|---|---|
| PL-CENTRO | mantenimiento | mantenimiento general | lunes a sábado, 08:00–17:00 |
| PL-FRENOS | especializado | frenos, suspensión | lunes a viernes, 07:00–16:00 |
| PL-MOTOR | especializado | motor, eléctrico, transmisión | lunes a sábado, 08:00–17:00 |

## Servicios (SKU con precio fijo de mano de obra)

| SKU | Servicio | Especialidad | Mano de obra | Horas estándar |
|---|---|---|---|---|
| REV-GENERAL | Revisión general | mantenimiento | 60.000 | 1 |
| MANT-ACEITE | Cambio de aceite y filtro | mantenimiento | 45.000 | 0,75 |
| MANT-10K | Mantenimiento preventivo 10.000 km | mantenimiento | 120.000 | 2 |
| FRE-PASTILLAS | Cambio de pastillas de freno | frenos | 80.000 | 1,5 |
| FRE-DISCOS | Rectificación o cambio de discos | frenos | 140.000 | 2 |
| FRE-LIQUIDO | Purga y cambio de líquido de frenos | frenos | 60.000 | 1 |
| SUS-AMORT | Cambio de amortiguadores | suspensión | 150.000 | 2,5 |
| SUS-ALINEA | Alineación y balanceo | suspensión | 70.000 | 1 |
| MOT-DIAG | Diagnóstico computarizado de motor | motor | 90.000 | 1 |
| MOT-BUJIAS | Cambio de bujías y bobinas | motor | 110.000 | 1,5 |
| ELE-BATERIA | Diagnóstico y cambio de batería | eléctrico | 50.000 | 0,5 |
| ELE-ALTERN | Revisión y cambio de alternador | eléctrico | 160.000 | 2,5 |
| TRA-EMBRAGUE | Cambio de kit de embrague | transmisión | 380.000 | 5 |

Las palabras clave de cada SKU alimentan el prediagnóstico por reglas. Se cambian con
`registrar_servicio`.

## Tienda simulada

Sin `MCP_TIENDA_1_URL`, el mecánico elige de la «Tienda simulada»
(`integraciones/tiendas/simulado/datos.ts`): 15 repuestos por código universal, con su
categoría, marcas y unidades disponibles, en la misma forma que el catálogo de la tienda real.
No tienen precio: lo consigue facturación.

ACE-5W30-1L, FIL-ACE-STD, FIL-AIRE-STD, PAS-DEL-CER, PAS-TRA-CER, DIS-DEL-VENT,
LIQ-FRE-DOT4, AMO-DEL-GAS, AMO-TRA-GAS, BUJ-IRI-STD, BOB-ENC-STD, BAT-12V-60AH,
ALT-90A-STD, KIT-EMB-STD, SEN-OXI-STD.

## Casos del simulador

`npm run simular -- casos` los lista y `npm run simular -- todos` los corre.

| Caso | Relación | Qué prueba |
|---|---|---|
| defecto-fabrica | REL-1001 | Viene por garantía, aplica y se valida. Paga el fabricante. |
| mala-instalacion | REL-1002 | Pieza mal instalada por un taller. Paga el taller. |
| manipulacion-cliente | REL-1006 | Viene por garantía, pero el mecánico dice que no aplica, con evidencia. Paga el cliente. |
| repuesto-defectuoso | REL-1008 | Batería defectuosa. Paga la tienda. |
| fuera-de-vigencia | REL-1004 | El mecánico dice que aplica, pero la garantía ya venció. |
| desgaste | REL-1007 | No viene por garantía: igual se consulta y no la cubre. |
| garantia-no-reclamada | REL-1003 | Tiene garantía vigente y un defecto de fábrica: se le avisa que va por garantía. |
| solo-mano-obra | REL-1002 | Sin repuestos que comprar. |
| prediagnostico-claro | REL-1008 | «chilla al frenar» va directo a PL-FRENOS. |
| revision-general | REL-1005 | «ruido raro» va a PL-CENTRO, se remite a PL-FRENOS y se cobra REV-GENERAL más la especialidad. |
| rechazo-cliente | REL-1007 | El cliente rechaza: sale sin reparar. |
