import { Card } from '../common.ts';
import { CardComponent, MoveFn } from './card.tsx';

export default function HandComponent({ cards, isTurn, move }: { cards: Card[], isTurn: boolean, move: MoveFn }) {
    return (
        <div id='hand'>
            {cards.map(card =>
                <div key={card.pack + card.suit + card.rank}
                    className='card-wrapper'>
                    <CardComponent
                        card={card}
                        isSort={false}
                        isTurn={isTurn}
                        moveAnimation={undefined}
                        move={move}
                    />
                </div>
            )}
            <span id='hand-placeholder' style={{ height: '5.2rem' }} />
        </div>
    );
}