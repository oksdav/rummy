import { Move } from '../common.ts';
import { CardComponent } from './card.tsx';

export default function PlayerComponent({ id, name, cardsAmount, isTurn, moveAnimation, isMe, setName }: { id: string, name: string, cardsAmount: number, isTurn: boolean, isMe: boolean, moveAnimation: Move | undefined, setName: (name: string) => void }) {
    return (
        <div className='player'
            style={{
                background: isTurn ? '#80C0C0' : '#FF8080',
            }}>
            <div id={id} className='card card-back'> {cardsAmount} </div>
            {isTurn && moveAnimation && moveAnimation.from === id &&
                <CardComponent
                    card={moveAnimation.card}
                    isSort={false}
                    isTurn={false}
                    moveAnimation={moveAnimation}
                    move={() => { }}
                />
            }
            {isMe
                ? <input className='name' defaultValue={name} onChange={e => setName(e.target.value)} />
                : <div className='name'> {name} </div>
            }
        </div>
    );
}