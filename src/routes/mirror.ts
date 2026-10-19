import { FastifyInstance } from 'fastify';
import path from 'path';
import { MirrorService } from '../services/mirror.js';

export interface MirrorRouteOptions {
  mirrorService: MirrorService;
}

export async function mirrorRoutes(
  fastify: FastifyInstance,
  options: MirrorRouteOptions
) {
  const { mirrorService } = options;

  // List all available mirrored extensions/toolchains
  fastify.get('/api/mirror/extensions', async (_req, reply) => {
    const files = mirrorService.listFiles();
    return reply.status(200).send({
      count: files.length,
      files,
    });
  });

  // Stream a specific extension or toolchain file
  fastify.get<{ Params: { filename: string } }>(
    '/api/mirror/extensions/:filename',
    async (req, reply) => {
      const { filename } = req.params;
      const file = mirrorService.getFileStream(filename);

      if (!file) {
        return reply.status(404).send({
          error: 'File not found',
          filename,
        });
      }

      const sanitizedName = path.basename(filename);
      reply.header('Content-Type', 'application/octet-stream');
      reply.header('Content-Length', file.size.toString());
      reply.header(
        'Content-Disposition',
        `attachment; filename="${sanitizedName}"`
      );

      return reply.send(file.stream);
    }
  );
}
