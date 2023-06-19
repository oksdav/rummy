export enum Action {
    Join,
    Leave,
    Name,
    Deal,
    Move,
    Revert,
    Next,
    Draw
}

export enum MeldType {
    Run,
    Set,
    Any
}

export type Move = {
    from: string;
    to: string;
    card: Card;
};

export type Name = {
    name: string;
};

export type Options = Move | Name;

export type Card = {
    pack: number;
    suit: string;
    rank: number;
};

export type Meld = {
    id: string;
    type: MeldType;
    cards: Card[];
};

export type PlayerInfo = {
    id: string;
    name: string;
    cardsAmount: number;
};

export type Message = {
    playerId?: string;
    hand?: Card[];
    draw?: Card;
    turnId?: string;
    gameOver?: boolean;
    players?: PlayerInfo[];
    board?: Meld[];
    deckSize?: number;
    invalid?: boolean;
    revert?: boolean;
    move?: Move;
};

export function getCookieValue(cookie: string, key: string): string | undefined {
    return cookie.split("; ").find(kv => kv.startsWith(key))?.split("=")[1];
}

export function isEqual(card1: Card, card2: Card): boolean {
    return card1.pack === card2.pack &&
        card1.suit === card2.suit &&
        card1.rank === card2.rank;
}

export function addToMeld(board: Meld[], meldId: string, card: Card): Meld[] | undefined {
    const meld = board.find(m => m.id === meldId);
    if (meld) {
        const newMeld = (() => {
            if (meld.cards.length === 0) {
                return { id: meld.id, type: MeldType.Any, cards: [card] };
            }

            switch (meld.type) {
                case MeldType.Set:
                    return addToSet(meld, card);
                case MeldType.Run:
                    return addToRun(meld, card);
                default:
                    return addToSet(meld, card) || addToRun(meld, card);
            }
        })();

        if (newMeld) {
            return board.map(m => m === meld ? newMeld : m);
        }
    }
}

function addToSet(meld: Meld, card: Card): Meld | undefined {
    if (card.rank === meld.cards[0].rank &&
        meld.cards.every(c => c.suit !== card.suit)) {
        return { id: meld.id, type: MeldType.Set, cards: [...meld.cards, card] };
    }
}

function addToRun(meld: Meld, card: Card): Meld | undefined {
    const cards = [...meld.cards, card].sort((c1, c2) => c1.rank - c2.rank);
    if (cards.every((c, i) =>
        c.suit === cards[0].suit &&
        c.rank === cards[0].rank + i)) {
        return { id: meld.id, type: MeldType.Run, cards: cards };
    }
}

export function removeFromMeld(board: Meld[], meldId: string, card: Card): Meld[] | undefined {
    const meld = board.find(m => m.id === meldId);
    if (meld) {
        const cards = meld.cards.filter(c => !isEqual(c, card));
        if (cards.length === meld.cards.length) return;

        if (board.at(-1) === meld && cards.length === 0) {
            const lastMeldIndex = board.slice(0, -1).findLastIndex(m => m.cards.length > 0);
            return board.filter((_, index) => index <= lastMeldIndex);
        }

        const newMeld = cards.length > 1
            ? { id: meld.id, type: meld.type, cards: cards }
            : { id: meld.id, type: MeldType.Any, cards: cards };
        return board.map(m => m === meld ? newMeld : m);
    }
}