import { isEqual, Meld, Move } from '../common.ts';
import { CardComponent, MoveFn } from './card.tsx';

export default function MeldComponent({ meld, isTurn, moveAnimation, move }: { meld: Meld, isTurn: boolean, moveAnimation: Move | undefined, move: MoveFn }) {
    return (
        <div id={meld.id}
            className='meld'>
            {meld.cards.map(card =>
                <CardComponent
                    key={card.pack + card.suit + card.rank}
                    card={card}
                    isSort={true}
                    isTurn={isTurn}
                    moveAnimation={moveAnimation && isEqual(card, moveAnimation.card) ? moveAnimation : undefined}
                    move={move}
                />
            )}
        </div>
    );
}