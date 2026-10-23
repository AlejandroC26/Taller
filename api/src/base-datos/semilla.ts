import { DataSource } from 'typeorm';
import { requerida } from '../config';
import { Categoria } from '../inventario/categoria.entity';
import { Item } from '../inventario/item.entity';
import { cifrarClave } from '../usuarios/claves';
import { Rol } from '../usuarios/rol.entity';
import { Usuario } from '../usuarios/usuario.entity';
import { opcionesBaseDatos } from './opciones';

// Carga los datos iniciales. Se puede ejecutar varias veces: actualiza en lugar de
// duplicar.
const db = await new DataSource(opcionesBaseDatos).initialize();

const roles = db.getRepository(Rol);
const ROLES = [
  ['administrador', 'Acceso total: usuarios, roles y toda la operación del taller'],
  ['recepcionista', 'Clientes, órdenes, inventario y asignación de mecánicos'],
  ['mecanico', 'Consulta sus carros asignados, registra diagnósticos y reparaciones'],
  ['concesionario', 'Usuario técnico del sistema del concesionario que envía carros al taller'],
] as const;
for (const [nombre, descripcion] of ROLES) {
  const existente = await roles.findOneBy({ nombre });
  await roles.save({ ...(existente ?? {}), nombre, descripcion });
}

const categorias = db.getRepository(Categoria);
const NOMBRES = ['Lubricantes', 'Filtros', 'Frenos', 'Suspensión', 'Eléctrico', 'Motor'];
for (const nombre of NOMBRES) {
  if (!(await categorias.existsBy({ nombre }))) await categorias.save({ nombre });
}
const categoria = async (nombre: string) => categorias.findOneByOrFail({ nombre });

const items = db.getRepository(Item);
const ITEMS: [string, string, number, number, number, string][] = [
  ['ACE-5W30', 'Aceite sintético 5W-30 (cuarto)', 38000, 24, 8, 'Lubricantes'],
  ['FIL-ACE-01', 'Filtro de aceite', 25000, 10, 4, 'Filtros'],
  ['FIL-AIR-01', 'Filtro de aire', 42000, 6, 3, 'Filtros'],
  ['PAS-DEL-01', 'Juego de pastillas de freno delanteras', 120000, 4, 2, 'Frenos'],
  ['LIQ-FRE-01', 'Líquido de frenos DOT 4', 28000, 5, 2, 'Frenos'],
  ['AMO-DEL-01', 'Amortiguador delantero', 260000, 2, 2, 'Suspensión'],
  ['BAT-12V-60', 'Batería 12V 60Ah', 420000, 3, 1, 'Eléctrico'],
  ['BUJ-IRI-01', 'Bujía de iridio', 35000, 16, 8, 'Motor'],
];
for (const [codigo, nombre, precio, cantidad, nivelAlerta, cat] of ITEMS) {
  // Las existencias de un ítem que ya existe no se tocan: solo se crea si falta.
  if (!(await items.existsBy({ codigo }))) {
    await items.save({ codigo, nombre, precio, cantidad, nivelAlerta, categoria: await categoria(cat) });
  }
}

// El primer administrador sale del archivo .env; los demás usuarios los crea él.
const usuario = requerida('TALLER_ADMIN_USUARIO').toLowerCase();
const clave = requerida('TALLER_ADMIN_CLAVE');
if (clave.length < 10) throw new Error('TALLER_ADMIN_CLAVE debe tener al menos 10 caracteres');
const usuarios = db.getRepository(Usuario);
const existente = await usuarios.findOneBy({ usuario });
await usuarios.save({
  ...(existente ?? {}),
  nombre: existente?.nombre ?? 'Administrador',
  apellido: existente?.apellido ?? 'del Taller',
  documento: existente?.documento ?? '0000000000',
  telefono: existente?.telefono ?? '0000000',
  usuario,
  activo: true,
  rol: await roles.findOneByOrFail({ nombre: 'administrador' }),
  claveHash: await cifrarClave(clave),
});

console.log(
  `Semilla cargada: ${ROLES.length} roles, ${NOMBRES.length} categorías, ` +
    `${ITEMS.length} ítems y el administrador ${usuario}`,
);
await db.destroy();
