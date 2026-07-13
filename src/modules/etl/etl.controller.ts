import { Request, Response, NextFunction } from 'express';
import { ETLService } from './etl.service.js';
import { ETLSource } from '../../types/etl.js';
import fs from 'fs';
import path from 'path';

const etlService = new ETLService();

export class ETLController {
  static async ejecutarETL(req: Request, res: Response, next: NextFunction) {
    try {
      const sources: ETLSource[] = req.body.sources;

      if (!sources || !Array.isArray(sources)) {
        return res.status(400).json({
          ok: false,
          message: 'Se requiere un array de fuentes',
        });
      }

      const result = await etlService.ejecutarETL(sources);

      return res.status(200).json({
        ok: true,
        data: result,
      });
    } catch (error: any) {
      next(error);
    }
  }

  static async generarReporteETL(req: Request, res: Response, next: NextFunction) {
    try {
      const report = await etlService.generarReporteETL();

      return res.status(200).json({
        ok: true,
        data: report,
      });
    } catch (error: any) {
      next(error);
    }
  }

  static async listarArchivos(req: Request, res: Response, next: NextFunction) {
    try {
      const files = etlService.listarArchivosGenerados();

      return res.status(200).json({
        ok: true,
        files: files.map((file) => ({
          name: file.name,
          url: `/etl/archivo/${encodeURIComponent(file.name)}`,
        })),
      });
    } catch (error: any) {
      next(error);
    }
  }

  static async descargarArchivo(req: Request, res: Response, next: NextFunction) {
    try {
      const { filename } = req.params;
      const filePath = path.join(process.cwd(), 'uploads', 'etl', filename);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({
          ok: false,
          message: 'Archivo no encontrado',
        });
      }

      return res.download(filePath, filename);
    } catch (error: any) {
      next(error);
    }
  }
}