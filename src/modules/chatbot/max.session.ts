import mongoose from 'mongoose';
import { createHash, randomUUID } from 'node:crypto';
import { AppError } from '../../utils/AppError.js';
import type { MaxState, MaxTurnResult } from './max.support-flow.js';

const schema = new mongoose.Schema({
  usuarioId: Number,
  role: String,
  canal: String,
  key: { type: String, unique: true, required: true },
  state: { type: mongoose.Schema.Types.Mixed, required: true },
  lockToken: String,
  lockUntil: Date,
  expiresAt: { type: Date, required: true, expires: 0 },
}, { collection: 'max_conversations', timestamps: true });
export const MaxSessionModel = mongoose.model('MaxConversation', schema);
export function maxSessionKey(userId: number, role: string, channel: string, conversationId: string) {
  return createHash('sha256').update(`${userId}:${role}:${channel}:${conversationId}`).digest('hex');
}
export async function withMaxSession(key: string, turn: (state: MaxState) => Promise<MaxTurnResult>, owner?: { usuarioId: number; role: string; canal: string }) {
  if (mongoose.connection.readyState !== 1) throw new AppError('El servicio de soporte no está disponible. No se ha confirmado ningún ticket nuevo. Intenta de nuevo más tarde.', 503);
  await MaxSessionModel.init();
  try {
    await MaxSessionModel.updateOne({ key }, { $setOnInsert: { key, ...owner, state: { history: [] }, expiresAt: new Date(Date.now() + 7 * 86400000) } }, { upsert: true });
  } catch (error: any) { if (error?.code !== 11000) throw error; }
  const lockToken = randomUUID();
  const doc = await MaxSessionModel.findOneAndUpdate({ key, $or: [{ lockUntil: { $lte: new Date() } }, { lockUntil: { $exists: false } }] },
    { $set: { lockToken, lockUntil: new Date(Date.now() + 120000) } }, { new: true }).lean();
  if (!doc) throw new AppError('Max está procesando otro mensaje de esta conversación. Espera y reintenta.', 409);
  try {
    const state: MaxState = new Date(doc.expiresAt).getTime() <= Date.now() ? { history: [] } : doc.state as MaxState;
    const result = await turn(state);
    const saved = await MaxSessionModel.updateOne({ key, lockToken }, { $set: { state, expiresAt: new Date(Date.now() + 7 * 86400000) }, $unset: { lockToken: '', lockUntil: '' } });
    if (saved.modifiedCount !== 1) throw new AppError('No pude confirmar el guardado de la conversación. Reintenta el mismo mensaje.', 503);
    return result;
  } finally {
    await MaxSessionModel.updateOne({ key, lockToken }, { $unset: { lockToken: '', lockUntil: '' } });
  }
}
