import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const preferredPort = Number.parseInt(process.env.PORT || '3001', 10);
const webApiOrigin = process.env.WEB_API_URL || 'http://127.0.0.1:3000';

const mimeTypes = {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.map': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.txt': 'text/plain; charset=utf-8',
    '.webmanifest': 'application/manifest+json; charset=utf-8',
    '.webp': 'image/webp'
};

function resolveRequestPath(requestUrl) {
    const url = new URL(requestUrl, 'http://localhost');
    const pathname = decodeURIComponent(url.pathname === '/' ? '/login.html' : url.pathname);
    const requestedPath = path.resolve(root, `.${pathname}`);

    if (!requestedPath.startsWith(root)) {
        return null;
    }

    return requestedPath;
}

const server = createServer(async (req, res) => {
    const requestUrl = new URL(req.url || '/', 'http://localhost');
    // Development-only, exact-route proxy: keep the Horarios token on localhost
    // and use the unpublished Web Peluquero API without browser CORS errors.
    if (requestUrl.pathname === '/api/horarios/pickups') {
        if (!['GET', 'POST'].includes(req.method || '')) {
            res.writeHead(405, { 'content-type': 'application/json; charset=utf-8', allow: 'GET, POST' });
            res.end(JSON.stringify({ success: false, error: 'Método no permitido' }));
            return;
        }
        try {
            const target = new URL('/api/horarios/pickups', webApiOrigin);
            target.search = requestUrl.search;
            const chunks = [];
            let size = 0;
            if (req.method === 'POST') {
                for await (const chunk of req) {
                    size += chunk.length;
                    if (size > 16_384) {
                        res.writeHead(413, { 'content-type': 'application/json; charset=utf-8' });
                        res.end(JSON.stringify({ success: false, error: 'Solicitud demasiado grande' }));
                        return;
                    }
                    chunks.push(chunk);
                }
            }
            const upstream = await fetch(target, {
                method: req.method,
                headers: {
                    ...(req.headers.authorization ? { authorization: req.headers.authorization } : {}),
                    ...(req.method === 'POST' ? { 'content-type': req.headers['content-type'] || 'application/json' } : {})
                },
                ...(req.method === 'POST' ? { body: Buffer.concat(chunks) } : {}),
                signal: AbortSignal.timeout(15_000)
            });
            const responseBody = Buffer.from(await upstream.arrayBuffer());
            res.writeHead(upstream.status, {
                'content-type': upstream.headers.get('content-type') || 'application/json; charset=utf-8',
                'cache-control': 'no-store'
            });
            res.end(responseBody);
        } catch (error) {
            console.error('Web Peluquero local no disponible:', error.message);
            res.writeHead(502, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
            res.end(JSON.stringify({ success: false, error: 'No se pudo conectar con Web Peluquero local. Inicia npm run dev en ese proyecto y verifica WEB_API_URL.' }));
        }
        return;
    }

    const filePath = resolveRequestPath(req.url || '/');

    if (!filePath) {
        res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
        res.end('Forbidden');
        return;
    }

    try {
        const fileStat = await stat(filePath);
        if (!fileStat.isFile()) throw new Error('Not a file');

        res.writeHead(200, {
            'content-type': mimeTypes[path.extname(filePath)] || 'application/octet-stream'
        });
        createReadStream(filePath).pipe(res);
    } catch {
        res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
        res.end('Not found');
    }
});

async function listen(port) {
    return new Promise((resolve, reject) => {
        const onError = (error) => {
            server.off('listening', onListening);
            reject(error);
        };
        const onListening = () => {
            server.off('error', onError);
            resolve(port);
        };

        server.once('error', onError);
        server.once('listening', onListening);
        server.listen(port, '127.0.0.1');
    });
}

let activePort = null;
for (let port = preferredPort; port < preferredPort + 20; port += 1) {
    try {
        activePort = await listen(port);
        break;
    } catch (error) {
        if (error.code !== 'EADDRINUSE') throw error;
    }
}

if (!activePort) {
    throw new Error(`No hay puertos libres entre ${preferredPort} y ${preferredPort + 19}`);
}

console.log(`StaffPlanner local: http://localhost:${activePort}/login.html`);
console.log(`API de retiros local: ${webApiOrigin}/api/horarios/pickups`);
