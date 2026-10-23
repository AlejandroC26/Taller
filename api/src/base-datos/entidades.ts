import 'reflect-metadata';
import { Cliente } from '../clientes/cliente.entity';
import { Vehiculo } from '../clientes/vehiculo.entity';
import { Diagnostico } from '../diagnosticos/diagnostico.entity';
import { Repuesto } from '../diagnosticos/repuesto.entity';
import { Tarea } from '../diagnosticos/tarea.entity';
import { EventoIntegracion } from '../integraciones/evento.entity';
import { Categoria } from '../inventario/categoria.entity';
import { Item } from '../inventario/item.entity';
import { Movimiento } from '../inventario/movimiento.entity';
import { Asignacion } from '../ordenes/asignacion.entity';
import { Orden } from '../ordenes/orden.entity';
import { ParteUsada } from '../reparaciones/parte-usada.entity';
import { RegistroHoras } from '../reparaciones/registro-horas.entity';
import { Reparacion } from '../reparaciones/reparacion.entity';
import { Rol } from '../usuarios/rol.entity';
import { Usuario } from '../usuarios/usuario.entity';

// Next empaqueta el código, así que las entidades se listan a mano: una tabla nueva se
// agrega aquí.
export const ENTIDADES = [
  Rol,
  Usuario,
  Cliente,
  Vehiculo,
  Categoria,
  Item,
  Movimiento,
  Orden,
  Asignacion,
  Diagnostico,
  Tarea,
  Repuesto,
  Reparacion,
  RegistroHoras,
  ParteUsada,
  EventoIntegracion,
];
