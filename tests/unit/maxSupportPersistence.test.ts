jest.mock('../../src/config/db.js', () => ({ pool: { query: jest.fn() } }));
jest.mock('../../src/modules/actividad/actividad.service.js', () => ({ registrarActividadEmpleado: jest.fn() }));
import mongoose from 'mongoose';
import { SoporteTicketModel } from '../../src/modules/soporte/soporte.model.js';
import { crearTicketSoporte, obtenerTicketSoporteAutorizado } from '../../src/modules/soporte/soporte.service.js';
import { MaxSessionModel, maxSessionKey, withMaxSession } from '../../src/modules/chatbot/max.session.js';

const ticket = { _id: '6ac3e3c9b0f9047825cd714a', estado: 'abierto', titulo: 'Prueba' };
function mongoState(value: number) { Object.defineProperty(mongoose.connection, 'readyState', { configurable: true, value }); }
describe('Max: persistencia, permisos y reintentos', () => {
  beforeEach(() => { mongoState(1); });
  afterEach(() => { jest.restoreAllMocks(); mongoState(0); });
  it.each(['empleado', 'usuario', 'tecnico'])('limita la lectura de %s al propietario', async role => {
    const lean = jest.fn().mockResolvedValue(ticket); const select = jest.fn().mockReturnValue({ lean });
    const query = jest.spyOn(SoporteTicketModel, 'findOne').mockReturnValue({ select } as any);
    await obtenerTicketSoporteAutorizado({ ticket_id: String(ticket._id), usuario_id: 42, role });
    expect(query).toHaveBeenCalledWith({ _id: ticket._id, usuario_id: 42 });
    expect(select).toHaveBeenCalledWith('_id titulo estado respuesta_admin updatedAt');
  });
  it('permite al administrador el alcance del módulo de soporte', async () => {
    const find = jest.spyOn(SoporteTicketModel, 'findOne').mockReturnValue({ select: () => ({ lean: async () => ticket }) } as any);
    await obtenerTicketSoporteAutorizado({ ticket_id: ticket._id, usuario_id: 42, role: 'admin' });
    expect(find).toHaveBeenCalledWith({ _id: ticket._id });
  });
  it('no revela si un folio de otra cuenta existe', async () => {
    jest.spyOn(SoporteTicketModel, 'findOne').mockReturnValue({ select: () => ({ lean: async () => null }) } as any);
    await expect(obtenerTicketSoporteAutorizado({ ticket_id: ticket._id, usuario_id: 42, role: 'empleado' })).rejects.toMatchObject({ statusCode: 404 });
  });
  it('un identificador inválido no llega a la base de datos', async () => {
    const find = jest.spyOn(SoporteTicketModel, 'findOne');
    await expect(obtenerTicketSoporteAutorizado({ ticket_id: 'inventado', usuario_id: 42, role: 'admin' })).rejects.toMatchObject({ statusCode: 400 });
    expect(find).not.toHaveBeenCalled();
  });
  it('sin Mongo no afirma que el estado sea abierto ni que un ticket se haya creado', async () => {
    mongoState(0);
    await expect(obtenerTicketSoporteAutorizado({ ticket_id: ticket._id, usuario_id: 42, role: 'admin' })).rejects.toMatchObject({ statusCode: 503 });
    await expect(withMaxSession('test', jest.fn())).rejects.toMatchObject({ statusCode: 503 });
  });
  it('devuelve el ticket existente ante reintento con la misma clave', async () => {
    jest.spyOn(SoporteTicketModel, 'init').mockResolvedValue(SoporteTicketModel as any);
    jest.spyOn(SoporteTicketModel, 'findOne').mockResolvedValue(ticket as any);
    const create = jest.spyOn(SoporteTicketModel, 'create');
    const result = await crearTicketSoporte({ usuario_id: 42, categoria: 'Soporte', titulo: 'Prueba', descripcion: 'No veo la asistencia.', max_request_key: 'same-key' });
    expect(result).toBe(ticket); expect(create).not.toHaveBeenCalled();
  });
  it('resuelve una colisión concurrente mediante el índice único', async () => {
    jest.spyOn(SoporteTicketModel, 'init').mockResolvedValue(SoporteTicketModel as any);
    jest.spyOn(SoporteTicketModel, 'findOne').mockResolvedValueOnce(null).mockResolvedValueOnce(ticket as any);
    jest.spyOn(SoporteTicketModel, 'create').mockRejectedValue({ code: 11000 });
    expect(await crearTicketSoporte({ usuario_id: 42, categoria: 'Soporte', titulo: 'Prueba', descripcion: 'No veo la asistencia.', max_request_key: 'same-key' })).toBe(ticket);
  });
  it('separa conversación por usuario, rol, canal e identificador', () => {
    const keys = [maxSessionKey(1, 'admin', 'web', 'one'), maxSessionKey(2, 'admin', 'web', 'one'), maxSessionKey(1, 'empleado', 'web', 'one'), maxSessionKey(1, 'admin', 'mobile', 'one'), maxSessionKey(1, 'admin', 'web', 'two')];
    expect(new Set(keys).size).toBe(5);
  });
  it('rechaza otro turno mientras la conversación esté bloqueada', async () => {
    jest.spyOn(MaxSessionModel, 'init').mockResolvedValue(MaxSessionModel as any);
    jest.spyOn(MaxSessionModel, 'updateOne').mockResolvedValue({ modifiedCount: 1 } as any);
    jest.spyOn(MaxSessionModel, 'findOneAndUpdate').mockReturnValue({ lean: async () => null } as any);
    const turn = jest.fn();
    await expect(withMaxSession('test', turn)).rejects.toMatchObject({ statusCode: 409 }); expect(turn).not.toHaveBeenCalled();
  });
  it('libera el bloqueo cuando falla el turno y conserva el estado anterior', async () => {
    jest.spyOn(MaxSessionModel, 'init').mockResolvedValue(MaxSessionModel as any);
    const update = jest.spyOn(MaxSessionModel, 'updateOne').mockResolvedValue({ modifiedCount: 1 } as any);
    jest.spyOn(MaxSessionModel, 'findOneAndUpdate').mockReturnValue({ lean: async () => ({ state: { history: [] } }) } as any);
    await expect(withMaxSession('test', async () => { throw new Error('fallo'); })).rejects.toThrow('fallo');
    expect((update as jest.Mock).mock.calls.at(-1)?.[1]).toEqual({ $unset: { lockToken: '', lockUntil: '' } });
    expect((update as jest.Mock).mock.calls.some(c => (c[1] as any).$set?.state)).toBe(false);
  });
});
