import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../../middlewares/authJwt.js';
import {
  addContrato,
  changeContratoEstado,
  getAllContratos,
  getContratosByUser,
  getMisContratos,
  updateContratoData,
} from './contratos.service.js';

export async function listAll(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json({
      ok: true,
      contratos: await getAllContratos(),
    });
  } catch (e) {
    next(e);
  }
}

export async function listMine(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    res.json({
      ok: true,
      contratos: await getMisContratos(req.auth!.userId),
    });
  } catch (e) {
    next(e);
  }
}

export async function listByUser(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({
      ok: true,
      contratos: await getContratosByUser(Number(req.params.usuarioId)),
    });
  } catch (e) {
    next(e);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const id = await addContrato(req.body);

    res.status(201).json({
      ok: true,
      id,
      message: 'Contrato registrado correctamente',
    });
  } catch (e) {
    next(e);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    await updateContratoData(Number(req.params.id), req.body);

    res.json({
      ok: true,
      message: 'Contrato actualizado correctamente',
    });
  } catch (e) {
    next(e);
  }
}

export async function updateEstado(req: Request, res: Response, next: NextFunction) {
  try {
    await changeContratoEstado(Number(req.params.id), String(req.body?.estado || '').trim());

    res.json({
      ok: true,
      message: 'Estado de contrato actualizado correctamente',
    });
  } catch (e) {
    console.error('[CONTRATOS][PATCH ESTADO]', e);
    next(e);
  }
}