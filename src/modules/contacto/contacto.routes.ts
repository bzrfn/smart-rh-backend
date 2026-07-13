import { Router } from 'express';
import { enviarCorreoContactoController } from './contacto.controller';

const contactoRoutes = Router();

contactoRoutes.post('/', enviarCorreoContactoController);

export default contactoRoutes;