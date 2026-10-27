# Taller Pulgas Locas S.A.S.

<img src="web/public/logo-pulgas-locas.webp" alt="Logo del Taller Pulgas Locas" width="160" />

Un taller con varias **sedes**: una de mantenimiento y otras especializadas (frenos y
suspensión; motor, eléctrico y transmisión). Es una pieza de un ecosistema de **agentes
que se hablan por MCP**:

```
Concesionario ──► Taller S.A.S. ──► Facturación ──► Tiendas
 (id_relacion,     (prediagnóstico,   (cotiza, Telegram,
  VIN, garantía)    diagnóstico,       PSE)
                    garantía, reparación)
```

1. El concesionario envía los mensajes del cliente y el agente de **prediagnóstico** del taller decide la ruta:
   - **Especialista directo**, si el síntoma es claro.
   - **Revisión general** primero, si no se sabe qué tiene. Después se remite a la sede especializada.
2. El concesionario **agenda la cita** en la sede.
3. El mecánico **toma** la orden y la **diagnostica**. Registra:
   - Servicios por SKU, con precio fijo de mano de obra.
   - La causa de la falla y su dictamen de garantía, con evidencias.
   - Los repuestos que hay que comprar, por código universal y **sin precio**: el taller no tiene inventario.
4. El concesionario **valida la garantía** de cada orden.
5. Facturación **cotiza** con las tiendas, le avisa al cliente por Telegram y, si acepta, devuelve la orden de compra.
6. El mecánico **repara**: horas de control, servicios hechos y partes usadas.
7. Facturación **cobra** por PSE y el vehículo sale.

## Roles

| Rol | Qué hace |
|---|---|
| Administrador | Todo, más usuarios y sedes de los mecánicos |
| Mecánico | Pertenece a una sede. Toma órdenes de la cola de su sede, diagnostica y repara (web o MCP) |
| Agente | Sistemas externos y orquestadores (concesionario, facturación…). Usan todas las herramientas del MCP |

## Tecnología

| Parte | Stack |
|---|---|
| `api/` | Next.js 16 (solo rutas API) + TypeORM + PostgreSQL + zod, puerto 3001 |
| `web/` | React 19 + Vite + Tailwind CSS 4, puerto 5173: la parte manual del mecánico |
| MCP | Servidor MCP en `/mcp`: `outputSchema`, `id_mensaje` idempotente, `siguiente_paso` y recursos `taller://…` |

El contrato con el concesionario y facturación, con ejemplos, está en
[docs/integracion](docs/integracion/README.md). Mientras esos sistemas no existan:
- El concesionario se **simula** con datos de prueba.
- Los mensajes a facturación quedan en una bandeja de salida.

## Cómo correrlo

Requiere Node 24 y Docker. Las variables viven en el `.env` de la carpeta superior
(`SENA-IA/.env`); vea la sección «Taller» de `SENA-IA/.env.ejemplo`.

```bash
# Base de datos (desde la carpeta SENA-IA)
docker compose up -d postgres
docker compose exec postgres createdb -U <DB_USUARIO> taller

# API
cd taller/api
npm install
npm run migracion:correr
npm run semilla
npm run dev

# Web (en otra terminal)
cd taller/web
npm install
npm run dev
```

Abra http://localhost:5173 y entre con el administrador definido en `TALLER_ADMIN_USUARIO` /
`TALLER_ADMIN_CLAVE`. Para ver órdenes de verdad, agéndelas con el simulador (abajo) y entre
con un mecánico de esa sede.

## Simular y probar

```bash
cd api && npm run simular -- casos    # los 11 casos (garantía, rutas, remisión, rechazo…)
cd api && npm run simular -- todos    # los corre por MCP, como un orquestador
cd api && npm run simular -- agendar REL-1001 PL-FRENOS "chilla al frenar"   # una orden para la web
cd api && npm run flujo               # el lado manual por REST, con los permisos
cd api && npm run pruebas             # pruebas unitarias de la API
cd web && npm run pruebas             # pruebas de componentes y páginas
```

El simulador crea los usuarios `agente-concesionario`, `agente-facturacion`, `mec-centro`,
`mec-frenos` y `mec-motor`. Sus claves quedan en `api/pruebas/.usuarios-simulacion.json`,
que no se sube al repositorio.

La guía completa (convenciones, reglas, permisos, diseño y MCP) está en
[CLAUDE.md](CLAUDE.md). El sistema visual está en [DESIGN.md](DESIGN.md).
