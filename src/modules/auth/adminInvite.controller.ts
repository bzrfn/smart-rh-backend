import { getPendingInvitations, resendAdminInvitation } from './adminInvite.service.js';
import type {
  NextFunction,
  Response,
} from 'express';

import type {
  AuthRequest,
} from '../../middlewares/authJwt.js';

import {
  acceptAdminInvite,
  requestAdminInvitation,
} from './adminInvite.service.js';


export async function requestAdminInvitationController(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const result =
      await requestAdminInvitation(
        req.auth?.userId,
        req.body,
        req.ip
      );

    res.status(
      201
    ).json({
      ok:
        true,

      ...result,
    });

  } catch (error) {
    next(
      error
    );
  }
}


export async function acceptAdminInvitationController(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const result =
      await acceptAdminInvite(
        req.body
      );

    res.json({
      ok:
        true,

      ...result,
    });

  } catch (error) {
    next(
      error
    );
  }
}

export async function listPendingInvitationsController(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json({ ok: true, invitations: await getPendingInvitations(req.auth?.userId) }); }
  catch (error) { next(error); }
}
export async function resendInvitationController(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json({ ok: true, ...await resendAdminInvitation(req.auth?.userId, req.params.id, req.body, req.ip) }); }
  catch (error) { next(error); }
}
