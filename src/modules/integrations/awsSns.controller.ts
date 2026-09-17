import {
  Request,
  Response,
  NextFunction,
} from 'express';

import {
  parseSnsBody,
  processSnsMessage,
} from './awsSns.service.js';


export async function receiveAwsSnsController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const message =
      parseSnsBody(
        req.body
      );

    const result =
      await processSnsMessage(
        message
      );

    return res
      .status(200)
      .json({
        ok: true,
        type:
          message.Type,
        action:
          result.action,
      });
  } catch (error) {
    next(error);
  }
}
