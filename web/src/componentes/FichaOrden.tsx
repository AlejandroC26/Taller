import type { Cobertura, Orden } from '../api/tipos';
import { dia, numero, NOMBRE_ESPECIALIDAD } from '../logica/formato';
import { Etiqueta } from './Etiqueta';
import { Ceja, Contorno } from './Superficies';

// Lo que el mecánico necesita saber antes de abrir el capó: el vehículo según el VIN, su
// garantía, lo que contó el cliente y lo que adelantó el prediagnóstico.

export function GarantiaVehiculo({ garantia }: { garantia: Cobertura }) {
  return garantia.vigente ? (
    <div className="flex flex-col items-start gap-8">
      <Etiqueta tono="listo">Garantía vigente</Etiqueta>
      <p className="text-body-sm text-texto-2">
        Hasta el {dia(garantia.vence)} o {numero(garantia.kmMaximo)} km. Cubre: {garantia.cubre.map((e) => NOMBRE_ESPECIALIDAD[e]).join(', ')}.
      </p>
    </div>
  ) : (
    <div className="flex flex-col items-start gap-8">
      <Etiqueta>Sin garantía vigente</Etiqueta>
      <p className="text-body-sm text-texto-2">{garantia.motivo ?? 'El vehículo no tiene garantía de fábrica'}</p>
    </div>
  );
}

export function FichaOrden({ orden }: { orden: Orden }) {
  const v = orden.vehiculo;
  const pre = orden.prediagnostico;
  return (
    <div className="grid gap-16 md:grid-cols-2">
      <Contorno>
        <Ceja className="mb-12">Vehículo (según el VIN)</Ceja>
        <p className="font-plus-jakarta-sans text-subheading font-bold text-titulo">
          {v.marca} {v.modelo} {v.anio}
        </p>
        <p className="text-body-sm text-texto-2">
          {v.version} · {v.carroceria} · {v.puertas} puertas · {v.motor} · {v.transmision}
        </p>
        <p className="mt-8 text-body-sm">
          Placa <strong className="font-semibold">{v.placa}</strong> · {numero(orden.kilometraje ?? v.kilometraje)} km
        </p>
        <p className="mono mt-8 text-texto-3">VIN {v.vin}</p>
      </Contorno>
      <Contorno>
        <Ceja className="mb-12">Cliente · {orden.id_relacion}</Ceja>
        <p className="font-semibold">{orden.cliente.nombre}</p>
        <p className="mb-16 text-body-sm text-texto-2">
          C.C. {orden.cliente.cedula} · {orden.cliente.telefono}
        </p>
        <GarantiaVehiculo garantia={orden.garantia} />
      </Contorno>
      {orden.por_garantia && (
        <div className="rounded-xl border border-brand-violet/40 bg-brand-violet/5 p-20 md:col-span-2" role="note">
          <Etiqueta tono="revision">Viene por garantía</Etiqueta>
          <p className="mt-8 text-body-sm">{orden.motivo_reclamo}</p>
          <p className="mt-4 text-[12px] text-texto-2">Dictamine cada servicio y adjunte evidencias que respalden su decisión.</p>
        </div>
      )}
      <Contorno>
        <Ceja className="mb-12">Lo que contó el cliente</Ceja>
        {orden.mensajes_cliente.length ? (
          <ul className="flex flex-col gap-8">
            {orden.mensajes_cliente.map((m, i) => (
              <li key={i} className="rounded-lg bg-tarjeta px-12 py-8 text-body-sm">
                «{m.texto}»
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-body-sm text-texto-2">{orden.sintomas || 'Sin mensajes'}</p>
        )}
      </Contorno>
      <Contorno>
        <Ceja className="mb-12">Prediagnóstico</Ceja>
        {pre ? (
          <>
            <div className="mb-8 flex flex-wrap items-center gap-8">
              <Etiqueta tono="revision">{NOMBRE_ESPECIALIDAD[pre.especialidad]}</Etiqueta>
              <span className="text-[12px] text-texto-3">
                confianza {Math.round(pre.confianza * 100)} % · {pre.fuente === 'modelo' ? 'agente IA' : 'reglas'} ·{' '}
                {pre.ruta === 'especializada' ? 'directo a especialista' : 'revisión general'}
              </span>
            </div>
            <p className="text-body-sm">{pre.resumen}</p>
          </>
        ) : (
          <p className="text-body-sm text-texto-2">Sin prediagnóstico</p>
        )}
      </Contorno>
      {orden.remitida_desde && (
        <Contorno className="md:col-span-2">
          <Ceja className="mb-8">Remitida desde {orden.remitida_desde.nombre}</Ceja>
          <p className="text-body-sm">{orden.remitida_desde.nota}</p>
        </Contorno>
      )}
    </div>
  );
}
