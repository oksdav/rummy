import { PlayerInfo, Move } from '../common.ts';
import PlayerComponent from './player.tsx';

export default function PlayersComponent({ players, myId, turnId, moveAnimation, setName }: { players: PlayerInfo[], myId: string, turnId: string, moveAnimation: Move | undefined, setName: (name: string) => void }) {
    return (
        <div id='players'>
            {players.map(player =>
                <PlayerComponent
                    key={player.id}
                    id={player.id}
                    name={player.name}
                    cardsAmount={player.cardsAmount}
                    isMe={player.id === myId}
                    isTurn={player.id === turnId}
                    moveAnimation={moveAnimation}
                    setName={setName}
                />
            )}
        </div>
    );
}