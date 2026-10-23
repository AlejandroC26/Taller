import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as clientes from '@/clientes/clientes.service';
import { conflicto } from '@/comun/errores';
import { actorDe, conParams, leer, peticion } from '@/comun/pruebas';
import * as usuarios from '@/usuarios/usuarios.service';
import { POST as nuevoVehiculo } from './[id]/vehiculos/route';
import { GET, POST } from './route';

vi.mock('@/usuarios/usuarios.service', () => ({ actorDelToken: vi.fn() }));
vi.mock('@/clientes/clientes.service', () => ({
  listarClientes: vi.fn(async () => []),
  crearCliente: vi.fn(async (d: object) => ({ id: 1, ...d })),
  crearVehiculo: vi.fn(async (_id: number, d: object) => ({ id: 1, ...d })),
}));

const comoRol = (rol: string) => vi.mocked(usuarios.actorDelToken).mockResolvedValue(actorDe(rol));
const cliente = { nombre: 'Ana', apellido: 'Ruiz', documento: '52123456', telefono: '3001112233' };

describe('/api/clientes', () => {
  beforeEach(() => vi.clearAllMocks());

  it('el mecánico no registra clientes (403)', async () => {
    comoRol('mecanico');
    expect((await GET(peticion('/api/clientes'), conParams({}))).status).toBe(403);
  });

  it('la recepcionista busca por texto', async () => {
    comoRol('recepcionista');
    await GET(peticion('/api/clientes?buscar=ABC123'), conParams({}));
    expect(clientes.listarClientes).toHaveBeenCalledWith('ABC123');
  });

  it('registrar un cliente responde 201', async () => {
    comoRol('recepcionista');
    const r = await leer(await POST(peticion('/api/clientes', { metodo: 'POST', cuerpo: cliente }), conParams({})));
    expect(r.estado).toBe(201);
    expect(r.json.documento).toBe('52123456');
  });

  it('un documento repetido responde 409', async () => {
    comoRol('recepcionista');
    vi.mocked(clientes.crearCliente).mockRejectedValueOnce(conflicto('Ya existe un cliente con el documento 52123456'));
    const r = await leer(await POST(peticion('/api/clientes', { metodo: 'POST', cuerpo: cliente }), conParams({})));
    expect(r.estado).toBe(409);
  });

  it('registrar un vehículo normaliza la placa y usa el id del cliente', async () => {
    comoRol('recepcionista');
    const r = await nuevoVehiculo(
      peticion('/api/clientes/5/vehiculos', { metodo: 'POST', cuerpo: { placa: 'abc-123', marca: 'Kia', modelo: 'Rio', anio: 2019 } }),
      conParams({ id: '5' }),
    );
    expect(r.status).toBe(201);
    expect(clientes.crearVehiculo).toHaveBeenCalledWith(5, expect.objectContaining({ placa: 'ABC123', kilometraje: 0 }));
  });
});
