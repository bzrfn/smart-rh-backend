import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../../middlewares/authJwt.js';
import {
  addNomina,
  changeNominaEstado,
  getAllNominas,
  getMisNominas,
  getNominasByUser,
  updateNominaData,
} from './nomina.service.js';

export async function listAll(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json({
      ok: true,
      nominas: await getAllNominas(),
    });
  } catch (e) {
    next(e);
  }
}

export async function listMine(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    res.json({
      ok: true,
      nominas: await getMisNominas(req.auth!.userId),
    });
  } catch (e) {
    next(e);
  }
}

export async function listByUser(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({
      ok: true,
      nominas: await getNominasByUser(Number(req.params.usuarioId)),
    });
  } catch (e) {
    next(e);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const id = await addNomina(req.body);

    res.status(201).json({
      ok: true,
      id,
      message: 'Nómina registrada correctamente',
    });
  } catch (e) {
    next(e);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    await updateNominaData(Number(req.params.id), req.body);

    res.json({
      ok: true,
      message: 'Nómina actualizada correctamente',
    });
  } catch (e) {
    next(e);
  }
}

export async function updateEstado(req: Request, res: Response, next: NextFunction) {
  try {
    await changeNominaEstado(Number(req.params.id), String(req.body?.estado || '').trim());

    res.json({
      ok: true,
      message: 'Estado de nómina actualizado correctamente',
    });
  } catch (e) {
    next(e);
  }
}