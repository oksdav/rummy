import { useRef, useState, useEffect } from 'react';
import { getCookieValue, isEqual, addToMeld, removeFromMeld, Message, Action, Options, PlayerInfo, Card, Meld, MeldType, Move } from '../common.ts';
import BoardComponent from './board.tsx';
import PlayersComponent from './players.tsx';
import HandComponent from './hand.tsx';

const turnAudio = new Audio('turn.mp3');
document.addEventListener('touchstart', () => {
    turnAudio.play();
    turnAudio.pause();
    turnAudio.currentTime = 0;
}, { once: true });

enum Order {
    Suit,
    Rank
}

export default function Game() {
    const ws = useRef<WebSocket>();
    const playedHand = useRef<Card[]>([]);
    const [name, setName] = useState(getCookieValue(document.cookie, 'name'));
    const [myId, setMyId] = useState('');
    const [turnId, setTurnId] = useState('');
    const [gameOver, setGameOver] = useState(true);
    const [players, setPlayers] = useState<PlayerInfo[]>([]);
    const [board, setBoard] = useState<Meld[]>([]);
    const [hand, setHand] = useState<Card[]>([]);
    const [deckSize, setDeckSize] = useState(0);
    const [order, setOrder] = useState(Order.Suit);
    const [invalidTransition, setInvalidTransition] = useState(false);
    const [revertTransition, setRevertTransition] = useState(false);
    const [moveAnimation, setMoveAnimation] = useState<Move>();

    useEffect(() => {
        ws.current = new WebSocket((window.location.hostname === 'localhost' ? 'ws://' : 'wss://') + window.location.host + window.location.pathname);
        return () => ws.current?.close();
    }, []);

    useEffect(() => {
        if (ws.current) ws.current.onmessage = ev => receive(JSON.parse(ev.data as string));
    }, [hand]);

    useEffect(() => {
        const timeout = setTimeout(() => {
            document.cookie = `name=${name}; SameSite=Strict; Max-Age=31536000`;
            send(Action.Name, { name: name });
        }, 500);
        return () => clearTimeout(timeout);
    }, [name]);

    useEffect(() => {
        if (moveAnimation) {
            const { to, card } = moveAnimation;
            const cardElement = document.getElementById(card.pack + card.suit + card.rank);
            if (cardElement) {
                const rectFrom = cardElement.getBoundingClientRect();
                const rectTo = document.getElementById(to)?.getBoundingClientRect();
                cardElement.animate([
                    { left: rectFrom?.left + 'px', top: rectFrom?.top + 'px' },
                    { left: rectTo?.left + 'px', top: rectTo?.top + 'px' },
                ], 500);
            }
        }
    }, [moveAnimation]);

    useEffect(() => {
        if (myId === turnId && !gameOver) {
            turnAudio.play();
        }
    }, [turnId]);

    function send(action: Action, options?: Options) {
        if (ws.current?.readyState === WebSocket.OPEN)
            ws.current.send(JSON.stringify({ action: action, options: options }));
    }

    function receive(message: Message) {
        if (message.move !== undefined && (
            (message.move.from !== 'deck' && message.turnId !== myId) ||
            (message.move.from === 'deck' && message.move.to !== myId)
        )) {
            setMoveAnimation(message.move);
            setTimeout(() => {
                setMoveAnimation(undefined);
                updateState(message);
            }, 500);
        } else {
            updateState(message);
        }

        if (message.draw !== undefined) {
            setMoveAnimation({ from: 'deck', to: 'hand-placeholder', card: message.draw });
            setTimeout((draw: Card) => {
                setMoveAnimation(undefined);
                setHand([...hand, draw]);
            }, 500, message.draw);
        }

        if (message.playerId !== undefined) setMyId(message.playerId);
        if (message.hand !== undefined) setHand(message.hand);
        if (message.invalid) doInvalidTransition();
        if (message.revert) doRevertTransition();
    }

    function updateState(message: Message) {
        if (message.turnId !== undefined) setTurnId(message.turnId);
        if (message.gameOver !== undefined) setGameOver(message.gameOver);
        if (message.players !== undefined) setPlayers(message.players);
        if (message.board !== undefined) setBoard(message.board);
        if (message.deckSize !== undefined) setDeckSize(message.deckSize);
    }

    function sort() {
        switch (order) {
            case Order.Suit:
                setOrder(Order.Rank);
                setHand([...hand].sort((card1, card2) => card1.rank - card2.rank));
                break;
            case Order.Rank:
                setOrder(Order.Suit);
                setHand([...hand].sort((card1, card2) => card1.suit.charCodeAt(0) - card2.suit.charCodeAt(0)));
                break;
        }
    }

    function revert() {
        send(Action.Revert);
        playedHand.current = [];
    }

    function endTurn(action: Action) {
        if (board.every(meld => meld.cards.length > 2 || meld.cards.length === 0)) {
            send(action);
            playedHand.current = [];
        } else {
            doInvalidTransition();
        }
    }

    function move(from: string, to: string, card: Card) {
        const lastMeld = board.at(-1);
        if (to === 'board' &&
            from === lastMeld?.id &&
            lastMeld?.cards.length === 1) return;

        let newBoard = [...board];

        const move = (() => {
            if (to === 'board') {
                newBoard = [...board, { id: Math.random().toString(36).slice(-10), type: MeldType.Any, cards: [card] }];
                return true;
            } else if (to === 'hand' && playedHand.current.some(c => isEqual(c, card))) {
                setHand([...hand, card]);
                playedHand.current = playedHand.current.filter(c => !isEqual(c, card));
                return true;
            } else {
                const changedBoard = addToMeld(board, to, card);
                if (changedBoard) {
                    newBoard = changedBoard;
                    return true;
                }
            }
            return false;
        })();

        if (move) {
            if (from === 'hand') {
                setHand(hand.filter(c => !isEqual(c, card)));
                playedHand.current = [...playedHand.current, card];
            } else {
                const changedBoard = removeFromMeld(newBoard, from, card);
                if (changedBoard) {
                    newBoard = changedBoard;
                }
            }

            setBoard(newBoard);
            send(Action.Move, { from: from, to: to, card: card });
        }
    }

    function doInvalidTransition() {
        setInvalidTransition(true);
        setTimeout(() => setInvalidTransition(false), 1);
    }

    function doRevertTransition() {
        setRevertTransition(true);
        setTimeout(() => setRevertTransition(false), 1);
    }

    const isTurn = myId === turnId;
    const hasPlayed = playedHand.current.length > 0;
    const isDeckEmpty = deckSize === 0;

    return (
        <>
            <PlayersComponent players={players} myId={myId} turnId={turnId} moveAnimation={moveAnimation} setName={setName} />
            <BoardComponent board={board} gameOver={gameOver} isTurn={isTurn} invalidTransition={invalidTransition} revertTransition={revertTransition} moveAnimation={moveAnimation} move={move} />
            <HandComponent cards={hand} isTurn={isTurn} move={move} />
            <div id='actions'>
                {gameOver
                    ? <button id='deal' className='card card-back' disabled={false} onClick={() => send(Action.Deal)} />
                    : <>
                        <button id='sort' className='action' disabled={false} onClick={sort} >{order === Order.Suit ? '♢♡' : '1 2'}</button>
                        <button id='revert' className='action' disabled={!isTurn} onClick={revert} >⟲</button>
                        <button id='next' className='action' disabled={!isTurn || !(hasPlayed || isDeckEmpty)} onClick={() => endTurn(Action.Next)} >✓</button>
                        <div id='deck'>
                            <button id='draw' className='card card-back' disabled={!isTurn || hasPlayed || isDeckEmpty} onClick={() => endTurn(Action.Draw)} >{deckSize}</button>
                            {moveAnimation && moveAnimation.from === 'deck' &&
                                <div id={moveAnimation.card.pack + moveAnimation.card.suit + moveAnimation.card.rank}
                                    className='card card-back'
                                    style={{
                                        position: 'absolute',
                                        zIndex: 1,
                                    }} />
                            }
                        </div>
                    </>
                }
            </div>
        </>
    );
}