import { Meld, Move } from '../common.ts';
import { MoveFn } from './card.tsx';
import MeldComponent from './meld.tsx'

export default function BoardComponent({ board, gameOver, isTurn, invalidTransition, revertTransition, moveAnimation, move }: { board: Meld[], gameOver: boolean, isTurn: boolean, invalidTransition: boolean, revertTransition: boolean, moveAnimation: Move | undefined, move: MoveFn }) {
    const transition = [
        invalidTransition ? undefined : 'background-color 1s',
        revertTransition ? undefined : 'transform 1s',
    ].filter(t => t).join(',');

    return (
        <div id='board'
            style={{
                backgroundColor: gameOver ? '#C0C0C0' : invalidTransition ? '#FF0040' : '#008000',
                transform: revertTransition ? 'translateX(-100%)' : '',
                transition: transition,
            }}>
            {board.map(meld =>
                <MeldComponent
                    key={meld.id}
                    meld={meld}
                    isTurn={isTurn}
                    moveAnimation={moveAnimation}
                    move={move}
                />
            )}
            <span id='board-placeholder' />
        </div>
    );
}