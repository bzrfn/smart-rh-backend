import {
  NextFunction,
  Response,
} from 'express';

import {
  AuthRequest,
} from '../../middlewares/authJwt.js';

import {
  attachIncapacidadComprobante,
  getAllIncapacidades,
  getIncapacidadDetail,
  getIncapacidadReviewHistoryAsAdmin,
  getOwnIncapacidades,
  registerIncapacidad,
  reviewIncapacidadAsAdmin,
} from './incapacidades.service.js';


function actorFromRequest(
  req: AuthRequest
) {
  return {
    userId:
      Number(
        req.auth?.userId
      ),

    role:
      String(
        req.auth?.role ||
        ''
      ),
  };
}


export async function create(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const result =
      await registerIncapacidad(
        actorFromRequest(req),
        req.body || {}
      );

    return res
      .status(201)
      .json({
        ok: true,
        incapacidad: result,
      });
  } catch (error) {
    return next(error);
  }
}


export async function mine(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const result =
      await getOwnIncapacidades(
        actorFromRequest(req)
      );

    return res.json({
      ok: true,
      incapacidades: result,
    });
  } catch (error) {
    return next(error);
  }
}


export async function detail(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const result =
      await getIncapacidadDetail(
        actorFromRequest(req),
        req.params.id
      );

    return res.json({
      ok: true,
      incapacidad: result,
    });
  } catch (error) {
    return next(error);
  }
}


export async function all(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const result =
      await getAllIncapacidades(
        actorFromRequest(req),
        req.query.estado
      );

    return res.json({
      ok: true,
      incapacidades: result,
    });
  } catch (error) {
    return next(error);
  }
}


export async function reviewHistory(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const result =
      await getIncapacidadReviewHistoryAsAdmin(
        actorFromRequest(req),
        req.params.id
      );


    return res.json({
      ok: true,

      incapacidad_id:
        Number(
          req.params.id
        ),

      revisiones:
        result,
    });

  } catch (error) {
    return next(error);
  }
}



export async function review(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const result =
      await reviewIncapacidadAsAdmin(
        actorFromRequest(req),
        req.params.id,
        req.body?.estado,
        req.body?.observaciones_admin
      );

    return res.json({
      ok: true,
      incapacidad: result,
    });
  } catch (error) {
    return next(error);
  }
}



// ============================================================
// GI-HU02 — COMPROBANTE MÉDICO
// ============================================================

export async function attachComprobante(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const result =
      await attachIncapacidadComprobante(
        actorFromRequest(req),
        req.params.id,
        {
          base64:
            req.body?.base64,

          filename:
            req.body?.filename,
        }
      );

    return res.json({
      ok: true,
      incapacidad: result,
    });
  } catch (error) {
    return next(error);
  }
}
