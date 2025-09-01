import { version } from '../../package.json';
import config from '../config/config';

const swaggerDef = {
  openapi: '3.0.0',
  info: {
    title: 'TypeScript Starter API documentation',
    version,
    description: 'A modern Node.js Express API with TypeScript, Prisma, and Zod validation',
    license: {
      name: 'MIT',
      url: 'https://github.com/hagopj13/node-express-boilerplate/blob/master/LICENSE',
    },
  },
  servers: [
    {
      url: `http://localhost:${config.port}/v1`,
      description: 'Development Server',
    },
  ],
};

export default swaggerDef;
