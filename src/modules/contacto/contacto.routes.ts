import { Router } from 'express';
import { enviarCorreoContactoController } from './contacto.controller.js';

const contactoRoutes = Router();

contactoRoutes.post('/', enviarCorreoContactoController);

export default contactoRoutes;