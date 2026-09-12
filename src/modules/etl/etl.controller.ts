import {
  Request,
  Response,
  NextFunction,
} from 'express';

import {
  ETLService,
} from './etl.service.js';

import {
  ETLSource,
} from '../../types/etl.js';


const etlService =
  new ETLService();


export class ETLController {

  // ==========================================================
  // EJECUTAR
  // ==========================================================

  static async ejecutarETL(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {

      const sources:
        ETLSource[] =
          req.body.sources;


      if (
        !sources ||
        !Array.isArray(sources)
      ) {

        return res
          .status(400)
          .json({
            ok: false,

            message:
              'Se requiere un array de fuentes',
          });
      }


      const result =
        await etlService
          .ejecutarETL(
            sources
          );


      return res
        .status(200)
        .json({
          ok: true,

          data:
            result,
        });

    } catch (error) {

      return next(error);
    }
  }


  // ==========================================================
  // REPORTE
  // ==========================================================

  static async generarReporteETL(
    _req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {

      const report =
        await etlService
          .generarReporteETL();


      return res
        .status(200)
        .json({
          ok: true,

          data:
            report,
        });

    } catch (error) {

      return next(error);
    }
  }


  // ==========================================================
  // LISTAR ARCHIVOS
  // ==========================================================

  static async listarArchivos(
    _req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {

      const files =
        await etlService
          .listarArchivosGenerados();


      return res
        .status(200)
        .json({
          ok: true,

          files:
            files.map(
              (file) => ({
                name:
                  file.name,

                url:
                  `/etl/archivo/${encodeURIComponent(
                    file.name
                  )}`,
              })
            ),
        });

    } catch (error) {

      return next(error);
    }
  }


  // ==========================================================
  // DESCARGAR
  // ==========================================================

  static async descargarArchivo(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {

      const filename =
        String(
          req.params.filename ||
          ''
        );


      const file =
        await etlService
          .obtenerArchivoGenerado(
            filename
          );


      if (!file) {

        return res
          .status(404)
          .json({
            ok: false,

            message:
              'Archivo no encontrado',
          });
      }


      const safeFilename =
        filename.replace(
          /["\r\n]/g,
          ''
        );


      res.setHeader(
        'Content-Type',
        file.contentType ||
          'text/csv; charset=utf-8'
      );


      res.setHeader(
        'Content-Length',
        String(
          file.body.length
        )
      );


      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${safeFilename}"`
      );


      res.setHeader(
        'Cache-Control',
        'private, no-store'
      );


      return res.send(
        file.body
      );

    } catch (error) {

      return next(error);
    }
  }
}