import express from 'express';
import httpStatus from 'http-status';
import prisma from '../../config/database';

const router = express.Router();

router.get('/', async (_req, res) => {
  try {
    let isDbHealthy = false;
    try {
      await prisma.$queryRaw`SELECT 1`;
      isDbHealthy = true;
    } catch {
      isDbHealthy = false;
    }

    const healthStatus = {
      status: isDbHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: {
        status: isDbHealthy ? 'connected' : 'disconnected',
        healthy: isDbHealthy,
      },
      memory: {
        used: Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100,
        total: Math.round((process.memoryUsage().heapTotal / 1024 / 1024) * 100) / 100,
        external: Math.round((process.memoryUsage().external / 1024 / 1024) * 100) / 100,
      },
    };

    const statusCode = isDbHealthy ? httpStatus.OK : httpStatus.SERVICE_UNAVAILABLE;
    res.status(statusCode).json(healthStatus);
  } catch (error) {
    res.status(httpStatus.SERVICE_UNAVAILABLE).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
    });
  }
});

export default router;
