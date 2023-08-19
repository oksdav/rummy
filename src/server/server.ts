import fs from 'fs/promises';
import crypto from 'crypto';
import { App, HttpResponse, WebSocket, SHARED_COMPRESSOR } from 'uWebSockets.js';
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
    const server = App().ws<UserData>('/*', {
        upgrade: (res, req, context) => {
            const cookie = req.getHeader('cookie');
            const playerToken = getCookieValue(cookie, 'token');
            const playerName = getCookieValue(cookie, 'name');
            res.upgrade<UserData>({
                gameId: req.getUrl().substring(1),
                playerToken: playerToken,
                playerName: playerName,
            },
                req.getHeader('sec-websocket-key'),
                req.getHeader('sec-websocket-protocol'),
                req.getHeader('sec-websocket-extensions'),
                context);
        },
        open: ws => join(castWebSocket(ws)),
        message: (ws, message) => play(castWebSocket(ws), Buffer.from(message).toString()),
        close: ws => leave(castWebSocket(ws)),
        compression: SHARED_COMPRESSOR,
    }).get('/', res => {
        res.writeStatus('302').writeHeader('location', '/' + generateGameId()).end();
    }).get('/style.css', (res, req) => {
        sendFile(res, req.getUrl(), 'text/css');
    }).get('/index.js', (res, req) => {
        sendFile(res, req.getUrl(), 'text/javascript');
    }).get('/favicon.ico', (res, req) => {
        sendFile(res, req.getUrl(), 'image/x-icon');
    }).get('/turn.mp3', (res, req) => {
        sendFile(res, req.getUrl(), 'audio/mpeg');
    }).get('/*', (res, req) => {
        const cookie = req.getHeader('cookie');
        const playerToken = getCookieValue(cookie, 'token') || crypto.randomUUID();
        res.writeHeader('Set-Cookie', `token=${playerToken}; SameSite=Strict; Max-Age=31536000`);
        sendFile(res, '/index.html', 'text/html');
    }).listen(3000, () => { });

    return {
        publish: (topic: string, message: string) => server.publish(topic, message, false, true),
    };
}

async function sendFile(res: HttpResponse, fileName: string, contentType: string) {
    res.onAborted(() => {
        res.aborted = true;
    });
    const data = await fs.readFile('public' + fileName);
    if (!res.aborted) {
        res.cork(() => {
            res.writeStatus('200').writeHeader('Content-Type', contentType).end(data);
        });
    }
}

function castWebSocket(ws: WebSocket<UserData>): Socket {
    return {
        data: ws.getUserData(),
        send: (message: string) => ws.send(message, false, true),
        subscribe: (topic: string) => ws.subscribe(topic),
    };
}