import crypto from 'crypto';
import { getCookieValue } from '../common.ts';

export type Socket = {
    data: UserData;
    send: (message: string) => void;
    subscribe: (topic: string) => void;
};

type UserData = {
    gameId: string;
    playerToken: string;
    playerName: string;
};

export function start({ generateGameId, join, play, leave }: {
    generateGameId: () => string,
    join: (ws: Socket) => void,
    play: (ws: Socket, message: string) => void,
    leave: (ws: Socket) => void,
}) {
    const server = Bun.serve<UserData>({
        fetch(req, server) {
            const pathname = new URL(req.url).pathname.substring(1);
            if (!pathname) {
                return Response.redirect('/' + generateGameId());
            }

            if (req.headers.get('upgrade') === 'websocket') {
                const cookie = req.headers.get('Cookie') ?? '';
                const playerToken = getCookieValue(cookie, 'token') || crypto.randomUUID();
                const playerName = getCookieValue(cookie, 'name');
                const success = server.upgrade(req, {
                    headers: { 'Set-Cookie': `token=${playerToken}; SameSite=Strict; Max-Age=31536000` },
                    data: {
                        gameId: pathname,
                        playerToken: playerToken,
                        playerName: playerName,
                    },
                });
                return success ? undefined : new Response('WebSocket upgrade error', { status: 400 });
            }

            const filename = [
                'style.css',
                'index.js',
                'favicon.ico',
                'turn.mp3',
            ].includes(pathname) ? pathname : 'index.html';

            const file = Bun.file('public/' + filename);
            return new Response(file, { headers: { 'Content-Type': file.type } });
        },
        websocket: {
            open: join,
            message: (ws, message) => play(ws, message as string),
            close: leave,
        }
    });

    return {
        publish: (topic: string, message: string) => server.publish(topic, message, true),
    };
}