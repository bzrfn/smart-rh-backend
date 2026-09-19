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
