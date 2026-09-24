import {
  NextFunction,
  Request,
  Response,
} from 'express';

import {
  generateTerminalQr,
  getTerminalQrScaffoldState,
} from './terminal.service.js';


function terminalQrUnavailable(
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
        'La generación de QR desde terminal todavía no está habilitada.',

      terminal:
        getTerminalQrScaffoldState(),
    });
}


export async function generateTerminalQrController(
  _req:
    Request,

  res:
    Response,

  next:
    NextFunction
) {
  try {
    const state =
      getTerminalQrScaffoldState();

    if (
      !state.enabled
    ) {
      return terminalQrUnavailable(
        res
      );
    }

    const result =
      await generateTerminalQr();

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
