import 'reflect-metadata';
import { CompraRepuesto } from '../cotizaciones/compra.entity';
import { Diagnostico } from '../diagnosticos/diagnostico.entity';
import { Evidencia } from '../diagnosticos/evidencia.entity';
import { Repuesto } from '../diagnosticos/repuesto.entity';
import { Tarea } from '../diagnosticos/tarea.entity';
import { EventoIntegracion } from '../integraciones/evento.entity';
import { MensajeRecibido } from '../integraciones/mensaje-recibido.entity';
import { Asignacion } from '../ordenes/asignacion.entity';
import { Orden } from '../ordenes/orden.entity';
import { RelacionVehiculo } from '../relaciones/relacion.entity';
import { ParteUsada } from '../reparaciones/parte-usada.entity';
import { RegistroHoras } from '../reparaciones/registro-horas.entity';
import { Reparacion } from '../reparaciones/reparacion.entity';
import { Servicio } from '../servicios/servicio.entity';
import { Taller } from '../talleres/taller.entity';
import { Rol } from '../usuarios/rol.entity';
import { Usuario } from '../usuarios/usuario.entity';

// Next empaqueta el código, así que las entidades se listan a mano: una tabla nueva se
// agrega aquí.
export const ENTIDADES = [
  Rol,
  Usuario,
  Taller,
  Servicio,
  RelacionVehiculo,
  Orden,
  Asignacion,
  Diagnostico,
  Tarea,
  Repuesto,
  Evidencia,
  CompraRepuesto,
  Reparacion,
  RegistroHoras,
  ParteUsada,
  EventoIntegracion,
  MensajeRecibido,
];
