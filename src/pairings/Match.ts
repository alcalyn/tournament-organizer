/** Identifier of a player in a pairing algorithm: either a player ID or a seed number. */
export type PlayerID = string | number;

export interface Match {
    round: number,
    match: number,
    player1: PlayerID | null,
    player2: PlayerID | null,
    win?: {
        round: number,
        match: number
    },
    loss?: {
        round: number,
        match: number
    }
}