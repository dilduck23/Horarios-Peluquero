import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const preferredPort = Number.parseInt(process.env.PORT || '3001', 10);

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
