import { Request, Response, NextFunction } from 'express';
import { getRoles } from './roles.service.js';
export async function listRolesController(_req: Request, res: Response, next: NextFunction) {
  try { res.json({ ok: true, roles: await getRoles() }); } catch (e) { next(e); }
}
