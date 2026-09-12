import blossom from 'edmonds-blossom-fixed';
import { Match, PlayerID } from './Match.js';
import { shuffle } from './Shuffle.js';

export interface Player {
    id: PlayerID,
    score: number,
    pairedUpDown?: boolean,
    receivedBye? : boolean,
    avoid?: Array<PlayerID>,
    seating?: Array<-1 | 1>,
    rating?: number | null
}

/** A player with the index it occupies in the matching graph handed to the blossom algorithm. */
type IndexedPlayer = Player & { index: number };

export function Swiss(players: Player[], round: number, rated: boolean = false, seating: boolean = false) : Match[] {
    const matches: Match[] = [];
    if (rated) {
        players.filter(p => !p.hasOwnProperty('rating') || p.rating === null).forEach(p => p.rating = 0);
    }
    if (seating) {
        players.filter(p => !p.hasOwnProperty('seating')).forEach(p => p.seating = []);
    }
    // Both properties are guaranteed above whenever the matching weights below read them.
    const ratingOf = (p: Player): number => p.rating ?? 0;
    const seatingOf = (p: Player): Array<-1 | 1> => p.seating ?? [];
    const playerArray: IndexedPlayer[] = shuffle(players).map((p, i) => Object.assign(p, { index: i }));
    const byIndex = (index: number): IndexedPlayer => {
        const player = playerArray.find(p => p.index === index);
        if (player === undefined) {
            throw new Error(`No player with index ${index}`);
        }
        return player;
    };
    const scoreGroups = [...new Set(playerArray.map(p => p.score))].sort((a, b) => a - b);
    const scoreSums = [...new Set(scoreGroups.map((s, i, a) => {
        const sums: number[] = [];
        for (let j = i; j < a.length; j++) {
            sums.push(s + a[j]);
        }
        return sums;
    }).flat())].sort((a, b) => a - b);
    const pairs: number[][] = [];
    for (let i = 0; i < playerArray.length; i++) {
        const curr = playerArray[i];
        const next = playerArray.slice(i + 1);
        const sorted = rated ? [...next].sort((a, b) => Math.abs(ratingOf(curr) - ratingOf(a)) - Math.abs(ratingOf(curr) - ratingOf(b))) : [];
        for (let j = 0; j < next.length; j++) {
            const opp = next[j];
            if (curr.avoid?.includes(opp.id)) {
                continue;
            }
            let wt = 75 - 75 / (scoreGroups.findIndex(s => s === Math.min(curr.score, opp.score)) + 2);
            wt += 5 - 5 / (scoreSums.findIndex(s => s === curr.score + opp.score) + 1);
            let scoreGroupDiff = Math.abs(scoreGroups.findIndex(s => s === curr.score) - scoreGroups.findIndex(s => s === opp.score));
            if (scoreGroupDiff === 1 && curr.pairedUpDown === false && opp.pairedUpDown === false) {
                scoreGroupDiff -= 0.65;
            } else if (scoreGroupDiff > 0 && (curr.pairedUpDown === true || opp.pairedUpDown === true)) {
                scoreGroupDiff += 0.2;
            }
            wt += 23 / (2 *(scoreGroupDiff + 2));
            if (rated) {
                wt += 4 / (sorted.findIndex(p => p.id === opp.id) + 2);
            }
            if (seating) {
                let seatingDiff = Math.abs(seatingOf(curr).reduce((sum: number, seat) => sum + seat, 0) - seatingOf(opp).reduce((sum: number, seat) => sum + seat, 0));
                if (seatingOf(curr).slice(-1)[0] !== seatingOf(opp).slice(-1)[0]) {
                    seatingDiff += 0.5;
                }
                wt += Math.pow(2, seatingDiff - 1);
            }
            if (curr.receivedBye === true || opp.receivedBye === true) {
                wt += 40;
            }
            pairs.push([curr.index, opp.index, wt]);
        }
    }
    const blossomPairs = blossom(pairs, true);
    const playerCopy = [...playerArray];
    let byeArray: IndexedPlayer[] = [];
    let match = 1;
    do {
        const indexA = playerCopy[0].index;
        const indexB = blossomPairs[indexA];
        if (indexB === -1) {
            byeArray.push(playerCopy.splice(0, 1)[0]);
            continue;
        }
        playerCopy.splice(0, 1);
        playerCopy.splice(playerCopy.findIndex(p => p.index === indexB), 1);
        let playerA = byIndex(indexA);
        let playerB = byIndex(indexB);
        if (seating) {
            const aScore = seatingOf(playerA).reduce((sum: number, seat) => sum + seat, 0);
            const bScore = seatingOf(playerB).reduce((sum: number, seat) => sum + seat, 0);
            if (
                JSON.stringify(seatingOf(playerB).slice(-2)) === '[-1,-1]' ||
                JSON.stringify(seatingOf(playerA).slice(-2)) === '[1,1]' ||
                (seatingOf(playerB).slice(-1)[0] === -1 && seatingOf(playerA).slice(-1)[0] === 1) ||
                bScore < aScore
            ) {
                [playerA, playerB] = [playerB, playerA];
            }
        }
        matches.push({
            round: round,
            match: match++,
            player1: playerA.id,
            player2: playerB.id
        });
    } while (playerCopy.length > blossomPairs.reduce((sum: number, idx: number) => idx === -1 ? sum + 1 : sum, 0));
    byeArray = [...byeArray, ...playerCopy];
    for (let i = 0; i < byeArray.length; i++) {
        matches.push({
            round: round,
            match: match++,
            player1: byeArray[i].id,
            player2: null
        })
    }
    return matches;
}
