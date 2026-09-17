import express, {
  Router,
} from 'express';

import {
  receiveAwsSnsController,
} from './awsSns.controller.js';


export const awsSnsRoutes =
  Router();


awsSnsRoutes.post(
  '/aws/sns',

  express.text({
    type: [
      'text/plain',
      'text/*',
    ],
    limit: '256kb',
  }),

  receiveAwsSnsController
);
