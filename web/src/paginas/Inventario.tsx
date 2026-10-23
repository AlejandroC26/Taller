import { useState } from 'react';
import type { FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import { api } from '../api/cliente';
import type { Categoria, Item } from '../api/tipos';
import { Boton } from '../componentes/Boton';
import { aNumero, Entrada, Seleccion } from '../componentes/Campos';
import { Etiqueta } from '../componentes/Etiqueta';
import { Aviso, Cargando, Encabezado, Tarjeta } from '../componentes/Superficies';
import { Celda, Fila, Tabla } from '../componentes/Tabla';
import { cuenta, pesos } from '../logica/formato';
import { puede } from '../logica/permisos';
import { usarAccion, usarDatos } from '../logica/usarDatos';
import { usarSesion } from '../sesion/sesion';

function NuevoItem({ categorias, alCrear }: { categorias: Categoria[]; alCrear: () => void }) {
  const vacio = { codigo: '', nombre: '', precio: '', cantidad: '0', nivelAlerta: '0', categoriaId: '' };
  const [f, setF] = useState(vacio);
  const { ocupado, error, ejecutar } = usarAccion();
  const campo = (clave: keyof typeof vacio) => ({ value: f[clave], onChange: (e: { target: { value: string } }) => setF({ ...f, [clave]: e.target.value }) });

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const r = await ejecutar(() =>
      api('/api/inventario', {
        metodo: 'POST',
        cuerpo: { codigo: f.codigo, nombre: f.nombre, precio: aNumero(f.precio), cantidad: aNumero(f.cantidad), nivelAlerta: aNumero(f.nivelAlerta), categoriaId: Number(f.categoriaId) },
      }),
    );
    if (r) {
      setF(vacio);
      alCrear();
    }
  }

  return (
    <Tarjeta className="mb-40">
      <form onSubmit={enviar} className="grid gap-16 sm:grid-cols-2 lg:grid-cols-6">
        <h2 className="text-subheading sm:col-span-2 lg:col-span-6">Nuevo ítem</h2>
        <Entrada etiqueta="Código" {...campo('codigo')} placeholder="FIL-ACE-02" required />
        <div className="lg:col-span-2">
          <Entrada etiqueta="Ítem" {...campo('nombre')} required />
        </div>
        <Entrada etiqueta="Precio" type="number" min={0} {...campo('precio')} required />
        <Entrada etiqueta="Cantidad" type="number" min={0} {...campo('cantidad')} />
        <Entrada etiqueta="Nivel de alerta" type="number" min={0} {...campo('nivelAlerta')} />
        <Seleccion etiqueta="Categoría" {...campo('categoriaId')} required>
          <option value="">Elija</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </Seleccion>
        <div className="flex items-end gap-16 sm:col-span-2 lg:col-span-5">
          <Boton type="submit" variante="primario" disabled={ocupado}>
            Crear ítem
          </Boton>
          {error && <Aviso>{error}</Aviso>}
        </div>
      </form>
    </Tarjeta>
  );
}

// Entrada de mercancía, salida manual o ajuste por conteo; también precio y nivel de alerta.
function EditarItem({ item, alCambiar }: { item: Item; alCambiar: () => void }) {
  const [tipo, setTipo] = useState<'entrada' | 'salida' | 'ajuste'>('entrada');
  const [cantidad, setCantidad] = useState('');
  const [nota, setNota] = useState('');
  const [precio, setPrecio] = useState(String(item.precio));
  const [nivel, setNivel] = useState(String(item.nivelAlerta));
  const { ocupado, error, ejecutar } = usarAccion();

  return (
    <div className="grid gap-24 py-16 md:grid-cols-2">
      <form
        className="grid gap-16 sm:grid-cols-3"
        onSubmit={async (e) => {
          e.preventDefault();
          const r = await ejecutar(() => api(`/api/inventario/${item.id}/movimientos`, { metodo: 'POST', cuerpo: { tipo, cantidad: aNumero(cantidad), nota } }));
          if (r) alCambiar();
        }}
      >
        <Seleccion etiqueta="Movimiento" value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)}>
          <option value="entrada">Entrada</option>
          <option value="salida">Salida</option>
          <option value="ajuste">Ajuste (conteo)</option>
        </Seleccion>
        <Entrada etiqueta={tipo === 'ajuste' ? 'Conteo físico' : 'Cantidad'} type="number" min={0} value={cantidad} onChange={(e) => setCantidad(e.target.value)} required />
        <Entrada etiqueta="Nota" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Factura, motivo…" />
        <Boton type="submit" disabled={ocupado} className="sm:col-span-3 sm:justify-self-start">
          Registrar movimiento
        </Boton>
      </form>
      <form
        className="grid gap-16 sm:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault();
          const r = await ejecutar(() => api(`/api/inventario/${item.id}`, { metodo: 'PATCH', cuerpo: { precio: aNumero(precio), nivelAlerta: aNumero(nivel) } }));
          if (r) alCambiar();
        }}
      >
        <Entrada etiqueta="Precio" type="number" min={0} value={precio} onChange={(e) => setPrecio(e.target.value)} />
        <Entrada etiqueta="Nivel de alerta" type="number" min={0} value={nivel} onChange={(e) => setNivel(e.target.value)} />
        <Boton type="submit" variante="contorno" disabled={ocupado} className="sm:col-span-2 sm:justify-self-start">
          Guardar cambios
        </Boton>
      </form>
      {error && (
        <div className="md:col-span-2">
          <Aviso>{error}</Aviso>
        </div>
      )}
    </div>
  );
}

export function Inventario() {
  const { actor } = usarSesion();
  const [parametros, setParametros] = useSearchParams();
  const alertas = parametros.get('alertas') === '1';
  const categoria = parametros.get('categoria') ?? '';
  const buscar = parametros.get('buscar') ?? '';
  const [texto, setTexto] = useState(buscar);
  const [creando, setCreando] = useState(false);
  const [abierto, setAbierto] = useState<number | null>(null);
  const consulta = new URLSearchParams({ ...(buscar ? { buscar } : {}), ...(alertas ? { alertas: '1' } : {}), ...(categoria ? { categoria } : {}) }).toString();
  const { datos, error, cargando, recargar } = usarDatos<Item[]>(`/api/inventario${consulta ? `?${consulta}` : ''}`);
  const { datos: categorias } = usarDatos<Categoria[]>('/api/categorias');
  const edita = actor ? puede.editarInventario(actor.rol) : false;

  const cambiar = (clave: string, valor: string) => {
    const nuevos = new URLSearchParams(parametros);
    if (valor) nuevos.set(clave, valor);
    else nuevos.delete(clave);
    setParametros(nuevos, { replace: true });
  };
  const enAlerta = (datos ?? []).filter((i) => i.enAlerta).length;

  return (
    <>
      <Encabezado ceja={enAlerta ? `${cuenta(enAlerta, 'ítem', 'ítems')} en alerta` : 'Existencias'} titulo="Inventario">
        {edita && !creando && (
          <Boton variante="primario" onClick={() => setCreando(true)}>
            Nuevo ítem
          </Boton>
        )}
      </Encabezado>
      {creando && (
        <NuevoItem
          categorias={categorias ?? []}
          alCrear={() => {
            setCreando(false);
            recargar();
          }}
        />
      )}
      <form
        className="mb-24 grid gap-16 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          cambiar('buscar', texto.trim());
        }}
      >
        <Entrada etiqueta="Buscar" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Nombre o código" />
        <Seleccion etiqueta="Categoría" value={categoria} onChange={(e) => cambiar('categoria', e.target.value)}>
          <option value="">Todas</option>
          {(categorias ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </Seleccion>
        <Seleccion etiqueta="Mostrar" value={alertas ? '1' : ''} onChange={(e) => cambiar('alertas', e.target.value)}>
          <option value="">Todo</option>
          <option value="1">Solo en alerta</option>
        </Seleccion>
        <Boton type="submit">Buscar</Boton>
      </form>
      {error && <Aviso>{error}</Aviso>}
      {cargando && !datos ? (
        <Cargando />
      ) : (
        <Tabla columnas={['Código', 'Ítem', 'Categoría', 'Precio', 'Cantidad', 'Alerta en', 'Estado']} vacia="No hay ítems con esos filtros">
          {(datos ?? []).flatMap((i) => [
            <Fila key={i.id} onClick={edita ? () => setAbierto(abierto === i.id ? null : i.id) : undefined}>
              <Celda className="mono">{i.codigo}</Celda>
              <Celda>{i.nombre}</Celda>
              <Celda className="text-texto-2">{i.categoria}</Celda>
              <Celda>{pesos(i.precio)}</Celda>
              <Celda>{i.cantidad}</Celda>
              <Celda className="text-texto-2">{i.nivelAlerta}</Celda>
              <Celda>
                <Etiqueta tono={i.enAlerta ? "alerta" : "listo"}>{i.enAlerta ? 'Alerta' : 'OK'}</Etiqueta>
              </Celda>
            </Fila>,
            abierto === i.id ? (
              <tr key={`${i.id}-editar`} className="border-b border-borde">
                <td colSpan={7} className="px-12">
                  <EditarItem
                    item={i}
                    alCambiar={() => {
                      setAbierto(null);
                      recargar();
                    }}
                  />
                </td>
              </tr>
            ) : null,
          ])}
        </Tabla>
      )}
    </>
  );
}
