import {
  NextFunction,
  Request,
  Response,
} from 'express';

import {
  requestAdminAccess,
  verifyAdminAccess,
} from './adminAccess.service.js';


export async function requestAdminAccessController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const result =
      await requestAdminAccess(
        req.body?.correo,
        req.ip
      );

    return res
      .status(
        202
      )
      .json(
        result
      );

  } catch (error) {
    return next(
      error
    );
  }
}


export async function verifyAdminAccessController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const result =
      await verifyAdminAccess(
        req.body?.challengeId,
        req.body?.codigo
      );

    return res
      .status(
        200
      )
      .json(
        result
      );

  } catch (error) {
    return next(
      error
    );
  }
}
