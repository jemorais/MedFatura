import { createServer } from 'http';
import { readFileSync } from 'fs';
import { join } from 'path';
import { createServer as createNetServer } from 'net';
import { config } from 'dotenv';

// Carregar variáveis de ambiente
config();

// Função para encontrar uma porta disponível automaticamente
async function findAvailablePort(startPort: number = 3000): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createNetServer();
    
    server.listen(startPort, () => {
      const port = (server.address() as any)?.port;
      server.close(() => resolve(port));
    });
    
    server.on('error', () => {
      // Se a porta estiver ocupada, tenta a próxima
      findAvailablePort(startPort + 1).then(resolve).catch(reject);
    });
  });
}

async function startServer() {
  // Encontra uma porta disponível automaticamente
  const startPort = process.env.PORT ? parseInt(process.env.PORT) : 3010;
  const port = await findAvailablePort(startPort);

  const server = createServer(async (req, res) => {
  try {
    // Importação direta do arquivo TypeScript
    const { default: app } = await import('./src/worker/index');
    
    // Handle static files in production
    if (process.env.NODE_ENV === 'production' && req.url?.startsWith('/assets/')) {
      try {
        const filePath = join(process.cwd(), 'dist', req.url);
        const content = readFileSync(filePath);
        const ext = req.url.split('.').pop();
        
        const mimeTypes: Record<string, string> = {
          'js': 'application/javascript',
          'css': 'text/css',
          'html': 'text/html',
          'png': 'image/png',
          'jpg': 'image/jpeg',
          'svg': 'image/svg+xml'
        };
        
        res.setHeader('Content-Type', mimeTypes[ext || ''] || 'application/octet-stream');
        res.end(content);
        return;
      } catch {
        res.statusCode = 404;
        res.end('Not Found');
        return;
      }
    }

    // Convert Node.js request to Web API Request
    const url = new URL(req.url || '/', `http://localhost:${port}`);
    
    let body: string | undefined;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      body = Buffer.concat(chunks).toString();
    }

    const headers = new Headers();
    Object.entries(req.headers).forEach(([key, value]) => {
      if (value) {
        headers.set(key, Array.isArray(value) ? value[0] : value);
      }
    });

    const request = new Request(url.toString(), {
      method: req.method,
      headers,
      body: body || undefined,
    });

    // Get response from Hono app
    const response = await app.fetch(request);
    
    // Convert Web API Response to Node.js response
    res.statusCode = response.status;
    
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    if (response.body) {
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
    }
    
    res.end();
  } catch (error) {
    console.error('Server error:', error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Internal Server Error' }));
  }
});

  server.listen(port, () => {
    console.log(`🚀 Backend Server running on http://localhost:${port}`);
    console.log(`📝 Configure your frontend proxy to target: http://localhost:${port}`);
  });

  return server;
}

// Iniciar o servidor
startServer().catch(console.error);

export default startServer;
