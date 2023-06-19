import { getCookieValue, Action } from '../common.ts'
import { generateGameId, receive } from './game.ts';

export type WebSocketData = {
    gameId: string;
    playerToken: string;
    playerName: string;
};

export const server = Bun.serve<WebSocketData>({
    fetch(req, server) {
        const pathname = new URL(req.url).pathname;

        if (req.headers.get('upgrade') === 'websocket') {
            const cookie = req.headers.get('Cookie') ?? '';
            const playerToken = getCookieValue(cookie, 'token') || crypto.randomUUID();
            const playerName = getCookieValue(cookie, 'name');
            const success = server.upgrade(req, {
                headers: { 'Set-Cookie': `token=${playerToken}; SameSite=Strict; Max-Age=31536000` },
                data: {
                    gameId: pathname.substring(1),
                    playerToken: playerToken,
                    playerName: playerName,
                },
            });
            return success ? undefined : new Response('WebSocket upgrade error', { status: 400 });
        }

        switch (pathname) {
            case '/':
                return Response.redirect('/' + generateGameId());
            case '/style.css':
                return new Response(Bun.file('public/style.css'), { headers: { 'Content-Type': 'text/css' } });
            case '/index.js':
                return new Response(Bun.file('public/index.js'), { headers: { 'Content-Type': 'text/javascript' } });
            case '/favicon.ico':
                return new Response(Bun.file('public/favicon.ico'), { headers: { 'Content-Type': 'image/x-icon' } });
            case '/turn.mp3':
                return new Response(Bun.file('public/turn.mp3'), { headers: { 'Content-Type': 'audio/mpeg' } });
            default:
                return new Response(Bun.file('public/index.html'), { headers: { 'Content-Type': 'text/html' } });
        }
    },
    websocket: {
        open(ws) {
            receive(ws, { action: Action.Join });
        },
        message(ws, message) {
            receive(ws, JSON.parse(message as string));
        },
        close(ws) {
            receive(ws, { action: Action.Leave });
        },
        perMessageDeflate: true,
    }
});