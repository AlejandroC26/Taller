import { DataSource } from 'typeorm';
import { requerida } from '../config';
import { CodigoRepuesto } from '../servicios/codigo-repuesto.entity';
import { Servicio } from '../servicios/servicio.entity';
import type { Especialidad } from '../talleres/reglas';
import { Taller } from '../talleres/taller.entity';
import { cifrarClave } from '../usuarios/claves';
import { Rol } from '../usuarios/rol.entity';
import { Usuario } from '../usuarios/usuario.entity';
import { opcionesBaseDatos } from './opciones';

// Carga los datos iniciales de Pulgas Locas S.A.S. Se puede ejecutar varias veces:
// actualiza en lugar de duplicar.
const db = await new DataSource(opcionesBaseDatos).initialize();

const roles = db.getRepository(Rol);
const ROLES = [
  ['administrador', 'Acceso total: usuarios, sedes, catálogo y todas las herramientas del MCP'],
  ['mecanico', 'Toma las órdenes de su sede, diagnostica, dictamina la garantía y repara'],
  ['agente', 'Agente externo u orquestador (concesionario, facturación…): todas las herramientas del MCP'],
] as const;
for (const [nombre, descripcion] of ROLES) {
  const existente = await roles.findOneBy({ nombre });
  await roles.save({ ...(existente ?? {}), nombre, descripcion });
}

const LUNES_A_SABADO = { dias: [1, 2, 3, 4, 5, 6], apertura: '08:00', cierre: '17:00' };
const SEDES = [
  {
    codigo: 'PL-CENTRO',
    nombre: 'Pulgas Locas Centro',
    tipo: 'mantenimiento' as const,
    especialidades: ['mantenimiento_general'] as Especialidad[],
    ciudad: 'Bogotá',
    direccion: 'Calle 13 # 24-50, Paloquemao',
    latitud: 4.616,
    longitud: -74.087,
    telefono: '6017450010',
    horario: LUNES_A_SABADO,
  },
  {
    codigo: 'PL-FRENOS',
    nombre: 'Pulgas Locas Frenos y Suspensión',
    tipo: 'especializado' as const,
    especialidades: ['frenos', 'suspension'] as Especialidad[],
    ciudad: 'Bogotá',
    direccion: 'Avenida Boyacá # 64-20, Normandía',
    latitud: 4.667,
    longitud: -74.111,
    telefono: '6017450020',
    horario: { dias: [1, 2, 3, 4, 5], apertura: '07:00', cierre: '16:00' },
  },
  {
    codigo: 'PL-MOTOR',
    nombre: 'Pulgas Locas Motor y Eléctrico',
    tipo: 'especializado' as const,
    especialidades: ['motor', 'electrico', 'transmision'] as Especialidad[],
    ciudad: 'Bogotá',
    direccion: 'Autopista Sur # 68-15, Venecia',
    latitud: 4.594,
    longitud: -74.142,
    telefono: '6017450030',
    horario: LUNES_A_SABADO,
  },
];
const talleres = db.getRepository(Taller);
for (const sede of SEDES) {
  const existente = await talleres.findOneBy({ codigo: sede.codigo });
  await talleres.save({ ...(existente ?? {}), ...sede, activo: true });
}

// Catálogo de la S.A.S.: el SKU fija la mano de obra en todas las sedes.
const SERVICIOS: [string, string, Especialidad, number, number, string[]][] = [
  ['REV-GENERAL', 'Revisión general', 'mantenimiento_general', 60000, 1, ['no se que tiene', 'revision', 'revisar', 'ruido raro', 'no se']],
  ['MANT-ACEITE', 'Cambio de aceite y filtro', 'mantenimiento_general', 45000, 0.75, ['aceite', 'mantenimiento', 'kilometraje']],
  ['MANT-10K', 'Mantenimiento preventivo 10.000 km', 'mantenimiento_general', 120000, 2, ['preventivo', '10.000', 'revision de kilometraje']],
  ['FRE-PASTILLAS', 'Cambio de pastillas de freno', 'frenos', 80000, 1.5, ['frenar', 'freno', 'pastillas', 'chilla', 'rechina']],
  ['FRE-DISCOS', 'Rectificación o cambio de discos', 'frenos', 140000, 2, ['vibra al frenar', 'discos', 'pedal vibra']],
  ['FRE-LIQUIDO', 'Purga y cambio de líquido de frenos', 'frenos', 60000, 1, ['pedal esponjoso', 'pedal blando', 'liquido de frenos']],
  ['SUS-AMORT', 'Cambio de amortiguadores', 'suspension', 150000, 2.5, ['amortiguador', 'rebota', 'golpe', 'suspension', 'huecos']],
  ['SUS-ALINEA', 'Alineación y balanceo', 'suspension', 70000, 1, ['se va hacia un lado', 'alineacion', 'balanceo', 'timon vibra', 'llantas']],
  ['MOT-DIAG', 'Diagnóstico computarizado de motor', 'motor', 90000, 1, ['check engine', 'testigo motor', 'jalonea', 'pierde fuerza', 'motor']],
  ['MOT-BUJIAS', 'Cambio de bujías y bobinas', 'motor', 110000, 1.5, ['bujias', 'tiembla', 'falla en ralenti', 'cascabelea']],
  ['ELE-BATERIA', 'Diagnóstico y cambio de batería', 'electrico', 50000, 0.5, ['bateria', 'no prende', 'no arranca', 'testigo bateria']],
  ['ELE-ALTERN', 'Revisión y cambio de alternador', 'electrico', 160000, 2.5, ['alternador', 'se descarga', 'luces bajas']],
  ['TRA-EMBRAGUE', 'Cambio de kit de embrague', 'transmision', 380000, 5, ['embrague', 'clutch', 'patina', 'cambios duros', 'caja']],
];
const servicios = db.getRepository(Servicio);
for (const [sku, nombre, especialidad, precioManoObra, horasEstandar, palabrasClave] of SERVICIOS) {
  const existente = await servicios.findOneBy({ sku });
  await servicios.save({ ...(existente ?? {}), sku, nombre, especialidad, precioManoObra, horasEstandar, palabrasClave, activo: true });
}

// Códigos universales de repuestos (iguales en todas las tiendas). Sin precio ni stock.
const CODIGOS: [string, string, string][] = [
  ['ACE-5W30-1L', 'Aceite sintético 5W-30, 1 litro', 'mantenimiento_general'],
  ['FIL-ACE-STD', 'Filtro de aceite estándar', 'mantenimiento_general'],
  ['FIL-AIRE-STD', 'Filtro de aire de motor', 'mantenimiento_general'],
  ['PAS-DEL-CER', 'Juego de pastillas delanteras cerámicas', 'frenos'],
  ['PAS-TRA-CER', 'Juego de pastillas traseras cerámicas', 'frenos'],
  ['DIS-DEL-VENT', 'Disco de freno delantero ventilado', 'frenos'],
  ['LIQ-FRE-DOT4', 'Líquido de frenos DOT 4, 500 ml', 'frenos'],
  ['AMO-DEL-GAS', 'Amortiguador delantero a gas', 'suspension'],
  ['AMO-TRA-GAS', 'Amortiguador trasero a gas', 'suspension'],
  ['BUJ-IRI-STD', 'Bujía de iridio', 'motor'],
  ['BOB-ENC-STD', 'Bobina de encendido', 'motor'],
  ['BAT-12V-60AH', 'Batería 12 V 60 Ah', 'electrico'],
  ['ALT-90A-STD', 'Alternador 90 A', 'electrico'],
  ['KIT-EMB-STD', 'Kit de embrague (disco, prensa y balinera)', 'transmision'],
  ['SEN-OXI-STD', 'Sensor de oxígeno', 'motor'],
];
const codigos = db.getRepository(CodigoRepuesto);
for (const [codigo, descripcion, sistema] of CODIGOS) await codigos.save({ codigo, descripcion, sistema });

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
  taller: null,
  rol: await roles.findOneByOrFail({ nombre: 'administrador' }),
  claveHash: await cifrarClave(clave),
});

console.log(
  `Semilla cargada: ${ROLES.length} roles, ${SEDES.length} sedes, ${SERVICIOS.length} servicios, ` +
    `${CODIGOS.length} códigos de repuesto y el administrador ${usuario}`,
);
await db.destroy();
