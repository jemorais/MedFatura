import { config } from 'dotenv';
import { serve } from '@hono/node-server';
import app from './src/worker/index';

// Carregar variáveis de ambiente
config();

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3012;
const HOSTNAME = process.env.HOSTNAME || 'localhost';

async function findAvailablePort(startPort: number): Promise<number> {
  const net = await import('net');
  const initialPort = !startPort || startPort <= 0 ? 3012 : startPort;

  const tryPort = async (p: number): Promise<number> =>
    new Promise((resolve) => {
      const server = net.createServer();
      server.unref();
      server.once('error', () => resolve(tryPort(p + 1)));
      server.once('listening', () => {
        const addr = server.address();
        const actualPort = typeof addr === 'string' || !addr ? p : addr.port;
        server.close(() => resolve(actualPort));
      });
      server.listen({ port: p, host: '127.0.0.1' });
    });

  return tryPort(initialPort);
}

async function startServer() {
  const start = PORT && PORT > 0 ? PORT : 3012;
  const port = await findAvailablePort(start);

  serve({ fetch: app.fetch, port, hostname: HOSTNAME });
  console.log(`🚀 Backend Server running on http://${HOSTNAME}:${port}`);
}

startServer();

export default startServer;
