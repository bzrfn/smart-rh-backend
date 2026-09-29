import {
  NextFunction,
  Response,
} from 'express';

import {
  AuthRequest,
} from '../../middlewares/authJwt.js';

import {
  consumeTerminalAccessForSession,
  decideTerminalAccess,
  getTerminalAccessAvailability,
  getTerminalAccessStatus,
  requestTerminalAccess,
} from './terminalAccess.service.js';

import {
  signTerminalAccessToken,
} from './terminalAccess.token.js';


function terminalAccessUnavailable(
  res:
    Response
) {
  return res
    .status(
      503
    )
    .json({
      ok:
        false,

      message:
        'La autorización de terminal todavía no está habilitada.',
    });
}


export async function requestTerminalAccessController(
  req:
    AuthRequest,

  res:
    Response,

  next:
    NextFunction
) {
  try {
    if (
      !getTerminalAccessAvailability()
        .enabled
    ) {
      return terminalAccessUnavailable(
        res
      );
    }

    const result =
      await requestTerminalAccess(
        req.body?.terminalId,
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


export async function terminalAccessStatusController(
  req:
    AuthRequest,

  res:
    Response,

  next:
    NextFunction
) {
  try {
    if (
      !getTerminalAccessAvailability()
        .enabled
    ) {
      return terminalAccessUnavailable(
        res
      );
    }

    const result =
      await getTerminalAccessStatus(
        req.query?.challengeId
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


export async function terminalAccessDecisionController(
  req:
    AuthRequest,

  res:
    Response,

  next:
    NextFunction
) {
  try {
    if (
      !getTerminalAccessAvailability()
        .enabled
    ) {
      return terminalAccessUnavailable(
        res
      );
    }

    const result =
      await decideTerminalAccess(
        req.body?.challengeId,
        req.auth?.userId,
        req.body?.decision
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


export async function createTerminalSessionController(
  req:
    AuthRequest,

  res:
    Response,

  next:
    NextFunction
) {
  try {
    if (
      !getTerminalAccessAvailability()
        .enabled
    ) {
      return terminalAccessUnavailable(
        res
      );
    }

    const consumed =
      await consumeTerminalAccessForSession(
        req.body?.challengeId,
        req.body?.sessionProof
      );

    const token =
      signTerminalAccessToken({
        terminalId:
          consumed.terminalId,
      });

    return res
      .status(
        200
      )
      .json({
        token,

        tokenType:
          'Bearer',

        terminalId:
          consumed.terminalId,
      });

  } catch (error) {
    return next(
      error
    );
  }
}


export async function createAdminTerminalSessionController(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (
      !getTerminalAccessAvailability()
        .enabled
    ) {
      return terminalAccessUnavailable(
        res
      );
    }

    const terminalId =
      String(
        req.body?.terminalId ??
        ''
      ).trim();

    if (
      !/^[A-Za-z0-9._-]{3,64}$/.test(
        terminalId
      )
    ) {
      return res
        .status(
          400
        )
        .json({
          message:
            'Identificador de terminal inválido',
        });
    }

    const token =
      signTerminalAccessToken({
        terminalId,
      });

    return res
      .status(
        200
      )
      .json({
        token,
        tokenType:
          'Bearer',
        terminalId,
      });
  } catch (error) {
    return next(
      error
    );
  }
}
