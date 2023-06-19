import { useRef, useState } from 'react';
import { Card, Move } from '../common.ts';

const suits: Record<string, { color: string, symbol: string }> = {
    'C': { color: '#008040', symbol: '♣' },
    'D': { color: '#0040C0', symbol: '♦' },
    'H': { color: '#FF4000', symbol: '♥' },
    'S': { color: 'black', symbol: '♠' }
};

export type MoveFn = (from: string, to: string, card: Card) => void;

export function CardComponent({ card, isSort, isTurn, moveAnimation, move }: { card: Card, isSort: boolean, isTurn: boolean, moveAnimation: Move | undefined, move: MoveFn }) {
    const element = useRef<HTMLDivElement>(document.createElement('div'));
    const [stylePosition, setStylePosition] = useState<'static' | 'absolute'>('static');
    const [styleZIndex, setStyleZIndex] = useState(0);
    const [styleCursor, setStyleCursor] = useState<'grab' | 'grabbing'>('grab');
    const [styleLeft, setStyleLeft] = useState('auto');
    const [styleTop, setStyleTop] = useState('auto');

    function grab(ev: React.MouseEvent | React.TouchEvent) {
        if (isTurn) {
            setStylePosition('absolute');
            setStyleZIndex(1);
            setStyleCursor('grabbing');
            drag(ev.nativeEvent);

            if (ev.nativeEvent instanceof MouseEvent) {
                document.addEventListener('mousemove', drag);
                document.addEventListener('mouseup', drop, { once: true });
            } else {
                document.addEventListener('touchmove', drag, { passive: false });
                document.addEventListener('touchend', drop, { once: true });
            }
        }
    }

    function drag(ev: MouseEvent | TouchEvent) {
        ev.preventDefault();
        const [x, y] = ev instanceof MouseEvent
            ? [ev.clientX, ev.clientY]
            : [ev.touches[0].clientX, ev.touches[0].clientY];
        setStyleLeft((x - element.current.offsetWidth / 2) + 'px');
        setStyleTop((y - element.current.offsetHeight / 2) + 'px');
    }

    function drop(ev: MouseEvent | TouchEvent) {
        if (ev instanceof MouseEvent) {
            document.removeEventListener('mousemove', drag);
        } else {
            document.removeEventListener('touchmove', drag);
        }

        setStyleZIndex(0);
        setStylePosition('static');
        setStyleCursor('grab');

        const originId = element.current.parentElement?.id || 'hand';
        const targetId = getTargetId();
        if (targetId && targetId !== originId) {
            move(originId, targetId, card);
        }
    }

    function getTargetId(): string | undefined {
        const rect = element.current.getBoundingClientRect();
        return [
            ...Array.from(document.getElementsByClassName('meld')),
            document.getElementById('hand')!,
            document.getElementById('board')!,
        ].find(el => {
            const r = el.getBoundingClientRect();
            return !(
                r.left > rect.right ||
                r.right < rect.left ||
                r.top > rect.bottom ||
                r.bottom < rect.top
            );
        })?.id;
    }

    return (
        <div ref={element}
            id={card.pack + card.suit + card.rank}
            className='card'
            style={{
                order: isSort ? card.rank : 0,
                color: suits[card.suit].color,
                position: moveAnimation ? 'absolute' : stylePosition,
                zIndex: moveAnimation ? 1 : styleZIndex,
                cursor: moveAnimation ? 'default' : styleCursor,
                left: styleLeft,
                top: styleTop,
            }}
            onMouseDown={grab}
            onTouchStart={grab}>
            {card.rank + suits[card.suit].symbol}
        </div>
    );
}