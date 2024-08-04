import crypto from 'crypto';
import { start, Socket } from './server.ts';
import { isEqual, addToMeld, removeFromMeld, Message, Action, Options, Name, PlayerInfo, Card, Meld, MeldType, Move } from '../common.ts';

type Player = {
    ws: Socket;
    id: string;
    timeoutId?: Timer;
    cards: Card[];
};

type Game = {
    turn: number;
    gameOver: boolean;
    players: Player[];
    board: Meld[];
    deck: Card[];
    currentBoard: Meld[];
    playedHand: Card[];
    move?: Move;
};

const DEAL = 13,
    PACKS = 2,
    DECK: Card[] = [...Array(PACKS).keys()].flatMap(pack =>
        ['C', 'D', 'H', 'S'].flatMap(suit =>
            [...Array(13).keys()].map(rank =>
                ({ pack: pack, suit: suit, rank: rank + 1 }))));

const games: Map<string, Game> = new Map();

const server = start({
    generateGameId,
    join: ws => receive(ws, { action: Action.Join }),
    play: (ws, message) => receive(ws, JSON.parse(message)),
    leave: ws => receive(ws, { action: Action.Leave }),
});

function publish(gameId: string, message: Message) {
    server.publish(gameId, JSON.stringify(message));
}

function send(player: Player, message: Message) {
    player.ws.send(JSON.stringify(message));
}

function generateGameId() {
    let gameId;
    do {
        gameId = Math.random().toString(36).slice(-4);
    } while (games.has(gameId));
    return gameId;
}

async function receive(ws: Socket, message: { action: Action, options?: Options }) {
    const game = games.get(ws.data.gameId) ?? {
        gameOver: true,
        players: [],
        board: [],
        deck: [],
        turn: 0,
        playedHand: [],
        currentBoard: [],
        move: undefined,
    };

    const changedGame = await (async () => {
        const { action, options } = message;
        switch (action) {
            case Action.Join:
                return join(game, ws);
            case Action.Leave:
                const changedGame = await leave(game, ws);
                if (changedGame?.players.length === 0) {
                    games.delete(ws.data.gameId);
                    return undefined;
                }
                return changedGame;
            case Action.Deal:
                return deal(game);
            case Action.Name:
                ws.data.playerName = (options as Name).name;
                return game;
        }

        const player = game.players[game.turn];
        if (player.ws.data.playerToken === ws.data.playerToken) {
            switch (action) {
                case Action.Move:
                    return move(player, game, options as Move);
                case Action.Next:
                    return next(player, game);
                case Action.Draw:
                    return draw(player, game);
                case Action.Revert:
                    return revert(player, game);
            }
        }
    })();

    if (changedGame) {
        games.set(ws.data.gameId, { ...changedGame, move: undefined });
        publish(ws.data.gameId, {
            turnId: changedGame.players[changedGame.turn].id,
            gameOver: changedGame.gameOver,
            players: playersInfo(changedGame),
            board: changedGame.currentBoard,
            deckSize: changedGame.deck.length,
            move: changedGame.move,
        });
    }
}

function playersInfo(game: Game): PlayerInfo[] {
    return game.players.map(player => ({
        id: player.id,
        name: player.ws.data.playerName,
        cardsAmount: player.cards.length,
    }));
}

function join(game: Game, ws: Socket): Game | undefined {
    ws.subscribe(ws.data.gameId);

    if (game.gameOver && game.players.length < 52 * PACKS / DEAL) {
        const otherPlayers = game.players.filter(player => player.ws.data.playerToken !== ws.data.playerToken);
        const players = [...otherPlayers, { ws: ws, id: crypto.randomUUID(), cards: [] }];
        players.forEach(player => send(player, { playerId: player.id }));
        return {
            ...game,
            players: players,
        };
    }

    const player = game.players.find(player => player.ws.data.playerToken === ws.data.playerToken);
    if (player) {
        clearTimeout(player.timeoutId);
        player.ws = ws;
        send(player, {
            playerId: player.id,
            hand: player.cards,
            turnId: game.players[game.turn].id,
            gameOver: game.gameOver,
            players: playersInfo(game),
            board: game.currentBoard,
            deckSize: game.deck.length,
        });
    }
}

async function leave(game: Game, ws: Socket): Promise<Game | undefined> {
    if (game.gameOver) {
        const players = game.players.filter(player => player.ws.data.playerToken !== ws.data.playerToken);
        return {
            ...game,
            players: players,
        };
    }

    return new Promise<Game | undefined>(resolve => {
        const timeoutId = setTimeout(() => {
            const changedGame = games.get(ws.data.gameId);
            const player = changedGame?.players.find(player => player.ws.data.playerToken === ws.data.playerToken);
            if (changedGame && player) {
                const players = changedGame.players.filter(p => p !== player);
                if (players.length === 0) {
                    resolve({
                        ...changedGame,
                        players: [],
                    });
                } else {
                    const isTurn = player.id === changedGame.players[changedGame.turn].id;
                    const turn = changedGame.turn % players.length;
                    const playerPlayedHand = isTurn ? changedGame.playedHand : [];
                    resolve({
                        ...changedGame,
                        players: players,
                        turn: turn,
                        deck: shuffle([...changedGame.deck, ...player.cards, ...playerPlayedHand]),
                        playedHand: isTurn ? [] : changedGame.playedHand,
                        currentBoard: isTurn ? changedGame.board : changedGame.currentBoard,
                    });
                }
            } else {
                resolve(undefined);
            }
        }, 300_000);

        const player = game.players.find(player => player.ws.data.playerToken === ws.data.playerToken);
        if (player) {
            player.timeoutId = timeoutId;
        }
    });
}

function deal(game: Game): Game | undefined {
    if (game.gameOver) {
        const deck: Card[] = shuffle([...DECK]);
        const players: Player[] = shuffle([...game.players]).map(player =>
            ({ ...player, cards: deck.splice(0, DEAL) }));
        players.forEach(player => send(player, { hand: player.cards }));
        return {
            turn: 0,
            gameOver: false,
            players: players,
            board: [],
            deck: deck,
            currentBoard: [],
            playedHand: [],
            move: undefined,
        };
    }
}

function shuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function move(player: Player, game: Game, { from, to, card }: Move): Game | undefined {
    if (to === from) return;

    const lastMeld = game.currentBoard.at(-1);
    if (to === 'board' &&
        from === lastMeld?.id &&
        lastMeld?.cards.length === 1) return;

    let board = [...game.currentBoard];
    let hand = [...player.cards];

    const isMoveTo = (() => {
        if (to === 'board') {
            board = [...board, { id: crypto.randomUUID(), type: MeldType.Any, cards: [card] }];
            return true;
        } else if (to === 'hand' && game.playedHand.some(c => isEqual(c, card))) {
            hand = [...hand, card];
            return true;
        } else {
            const changedBoard = addToMeld(board, to, card);
            if (changedBoard) {
                board = changedBoard;
                return true;
            }
        }
        return false;
    })();

    if (isMoveTo) {
        const isMoveFrom = (() => {
            if (from === 'hand') {
                hand = player.cards.filter(c => !isEqual(c, card));
                if (hand.length < player.cards.length) return true;
            } else {
                const changedBoard = removeFromMeld(board, from, card);
                if (changedBoard) {
                    board = changedBoard;
                    return true;
                }
            }
            return false;
        })();

        if (isMoveFrom) {
            const players = game.players.map(p => p === player ? { ...p, cards: hand } : p);
            const playedHand =
                from === 'hand' ? [...game.playedHand, card]
                    : to === 'hand' ? game.playedHand.filter(c => !isEqual(c, card))
                        : game.playedHand;
            return {
                ...game,
                players: players,
                currentBoard: board,
                playedHand: playedHand,
                move: {
                    from: from === 'hand' ? player.id : from,
                    to: to === 'board' ? 'board-placeholder' : to === 'hand' ? player.id : to,
                    card: card,
                },
            };
        }
    }
}

function revert(player: Player, game: Game): Game {
    const hand = [...player.cards, ...game.playedHand];
    const players = game.players.map(p => p === player ? { ...p, cards: hand } : p);
    send(player, { hand: hand });
    publish(player.ws.data.gameId, { revert: true });
    return {
        ...game,
        players: players,
        currentBoard: game.board,
        playedHand: [],
    }
}

function next(player: Player, game: Game): Game | undefined {
    const board = game.currentBoard.filter(meld => meld.cards.length > 0);
    if ((game.playedHand.length > 0 || game.deck.length === 0) && isBoardValid(board)) {
        const gameOver = player.cards.length === 0;
        const turn = gameOver ? game.turn : (game.turn + 1) % game.players.length;
        return {
            ...game,
            turn: turn,
            gameOver: gameOver,
            board: board,
            currentBoard: board,
            playedHand: [],
        };
    }
    send(player, { invalid: true });
}

function draw(player: Player, game: Game): Game | undefined {
    const board = game.currentBoard.filter(meld => meld.cards.length > 0);
    if ((game.playedHand.length === 0 && game.deck.length > 0) && isBoardValid(board)) {
        const [draw, ...deck] = game.deck;
        const players = game.players.map(p => p === player ? { ...p, cards: [...p.cards, draw] } : p);
        const turn = (game.turn + 1) % game.players.length;
        send(player, { draw: draw });
        return {
            ...game,
            turn: turn,
            players: players,
            deck: deck,
            currentBoard: board,
            move: {
                from: 'deck',
                to: player.id,
                card: { pack: 0, suit: 'S', rank: 0 },
            },
        };
    }
    send(player, { invalid: true });
}

function isBoardValid(board: Meld[]): boolean {
    return board.every(meld => {
        const suits = meld.cards.map(card => card.suit);
        const ranks = meld.cards.map(card => card.rank).sort((r1, r2) => r1 - r2);
        return meld.cards.length > 2 && (
            (meld.type === MeldType.Set &&
                new Set(suits).size === suits.length &&
                ranks.every(rank => rank === ranks[0])) ||
            (meld.type === MeldType.Run &&
                suits.every(suit => suit === suits[0]) &&
                ranks.every((rank, i) => rank === ranks[0] + i)));
    });
}