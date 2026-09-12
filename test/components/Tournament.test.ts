import { expect } from 'chai';
import { Tournament } from '../../src/components/Tournament.js';
import { thrown } from '../helpers.js';

const withPlayers = (count: number, settings = {}): Tournament => {
    const tournament = new Tournament('t1', 'Test Event');
    tournament.settings = settings;
    for (let i = 1; i <= count; i++) {
        tournament.createPlayer(`Player ${i}`, `p${i}`);
    }
    return tournament;
};

/** Plays every active match, with player one winning each. */
const playRound = (tournament: Tournament): void => {
    tournament.matches.filter(m => m.active === true).forEach(m => tournament.enterResult(m.id, 1, 0));
};

describe('Tournament', () => {
    describe('setup', () => {
        it('starts in setup with default settings', () => {
            const tournament = new Tournament('t1', 'Test Event');
            expect(tournament.status).to.equal('setup');
            expect(tournament.round).to.equal(0);
            expect(tournament.players).to.deep.equal([]);
            expect(tournament.matches).to.deep.equal([]);
            expect(tournament.stageOne.format).to.equal('single-elimination');
            expect(tournament.stageTwo.format).to.equal(null);
        });

        it('refuses duplicate player IDs', () => {
            const tournament = withPlayers(2);
            expect(thrown(() => tournament.createPlayer('Impostor', 'p1'))).to.equal('Player with ID p1 already exists');
            expect(tournament.players).to.have.lengthOf(2);
        });

        it('enforces the maximum number of players', () => {
            const tournament = withPlayers(2, { stageOne: { maxPlayers: 2 } });
            expect(thrown(() => tournament.createPlayer('Player 3'))).to.equal('Maximum number of players (2) are enrolled');
        });

        it('refuses to start without enough players', () => {
            const tournament = withPlayers(1);
            expect(thrown(() => tournament.start())).to.equal('Insufficient number of players (1) to start event');
            const doubleElim = withPlayers(3, { stageOne: { format: 'double-elimination' } });
            expect(thrown(() => doubleElim.start())).to.equal('Insufficient number of players (3) to start event');
        });
    });

    describe('single elimination', () => {
        it('creates a bracket and computes the number of rounds', () => {
            const tournament = withPlayers(4);
            tournament.start();
            expect(tournament.status).to.equal('stage-one');
            expect(tournament.round).to.equal(1);
            expect(tournament.stageOne.rounds).to.equal(2);
            expect(tournament.matches.filter(m => m.round === 1)).to.have.lengthOf(2);
            expect(tournament.matches.filter(m => m.round === 2)).to.have.lengthOf(1);
            expect(tournament.matches.filter(m => m.active === true)).to.have.lengthOf(2);
        });

        it('advances the winner along the path', () => {
            const tournament = withPlayers(4);
            tournament.start();
            const final = tournament.matches.find(m => m.round === 2)!;
            const [first, second] = tournament.matches.filter(m => m.round === 1);
            const winners = [first.player1.id, second.player1.id];
            tournament.enterResult(first.id, 1, 0);
            expect(final.active).to.equal(false);
            tournament.enterResult(second.id, 1, 0);
            expect(final.active).to.equal(true);
            expect([final.player1.id, final.player2.id]).to.have.members(winners);
        });

        it('refuses more wins than the format allows', () => {
            const tournament = withPlayers(4, { scoring: { bestOf: 3 } });
            tournament.start();
            const match = tournament.matches.find(m => m.active === true)!;
            expect(thrown(() => tournament.enterResult(match.id, 3, 0))).to.equal('Players can not win more than 2 games in a match');
        });

        it('throws on an unknown match', () => {
            const tournament = withPlayers(4);
            tournament.start();
            expect(thrown(() => tournament.enterResult('nope', 1, 0))).to.equal('Match with ID nope does not exist');
        });

        it('can not advance rounds', () => {
            const tournament = withPlayers(4);
            tournament.start();
            expect(thrown(() => tournament.next())).to.equal('Can not advance rounds in elimination or stepladder');
        });
    });

    describe('round-robin', () => {
        it('pairs every player once per round', () => {
            const tournament = withPlayers(4, { stageOne: { format: 'round-robin' } });
            tournament.start();
            expect(tournament.stageOne.rounds).to.equal(3);
            expect(tournament.matches).to.have.lengthOf(6);
            const opponents = tournament.players.map(p => p.matches.length);
            expect(opponents).to.deep.equal([1, 1, 1, 1]);
        });

        it('refuses to advance with active matches, then advances', () => {
            const tournament = withPlayers(4, { stageOne: { format: 'round-robin' } });
            tournament.start();
            expect(thrown(() => tournament.next())).to.equal('Can not advance rounds with active matches');
            tournament.matches.filter(m => m.active === true).forEach(m => tournament.enterResult(m.id, 1, 0));
            tournament.next();
            expect(tournament.round).to.equal(2);
            expect(tournament.matches.filter(m => m.active === true)).to.have.lengthOf(2);
        });

        it('is complete once the last round is played', () => {
            const tournament = withPlayers(4, { stageOne: { format: 'round-robin' } });
            tournament.start();
            for (let round = 1; round <= 3; round++) {
                tournament.matches.filter(m => m.active === true).forEach(m => tournament.enterResult(m.id, 1, 0));
                tournament.next();
            }
            expect(tournament.status).to.equal('complete');
        });
    });

    describe('scoring and standings', () => {
        it('ranks players by match points', () => {
            const tournament = withPlayers(4, {
                stageOne: { format: 'round-robin' },
                scoring: { win: 3, draw: 1, loss: 0 }
            });
            tournament.start();
            tournament.matches.filter(m => m.active === true).forEach(m => tournament.enterResult(m.id, 1, 0));
            tournament.next();
            const standings = tournament.standings();
            expect(standings).to.have.lengthOf(4);
            expect(standings.slice(0, 2).every(s => s.matchPoints === 3)).to.equal(true);
            expect(standings.slice(2).every(s => s.matchPoints === 0)).to.equal(true);
            expect(standings.map(s => s.matchPoints)).to.deep.equal([...standings.map(s => s.matchPoints)].sort((a, b) => b - a));
        });

        it('clears a result', () => {
            const tournament = withPlayers(4, { stageOne: { format: 'round-robin' } });
            tournament.start();
            const match = tournament.matches.find(m => m.active === true)!;
            tournament.enterResult(match.id, 1, 0);
            expect(match.player1.win).to.equal(1);
            tournament.clearResult(match.id);
            expect(match.active).to.equal(true);
            expect(match.player1.win).to.equal(0);
            expect(match.player2.loss).to.equal(0);
        });

        it('awards a bye worth the configured points', () => {
            const tournament = withPlayers(5, {
                stageOne: { format: 'swiss' },
                scoring: { win: 3, draw: 1, loss: 0, bye: 3 }
            });
            tournament.start();
            const bye = tournament.matches.find(m => m.bye === true)!;
            const standing = tournament.standings().find(s => s.player.id === bye.player1.id)!;
            expect(standing.matchPoints).to.equal(3);
            expect(standing.player.matches.filter(m => m.bye === true)).to.have.lengthOf(1);
        });

        it('only assigns byes during Swiss pairings', () => {
            const tournament = withPlayers(4, { stageOne: { format: 'round-robin' } });
            tournament.start();
            expect(thrown(() => tournament.assignBye('p1', 1))).to.equal('Can only assign losses during Swiss pairings');
        });

        it('excludes inactive players from standings unless asked', () => {
            const tournament = withPlayers(4, { stageOne: { format: 'round-robin' } });
            tournament.start();
            tournament.removePlayer('p1');
            expect(tournament.standings().map(s => s.player.id)).to.not.include('p1');
            expect(tournament.standings(false).map(s => s.player.id)).to.include('p1');
        });

        it('refuses to remove a player twice', () => {
            const tournament = withPlayers(4, { stageOne: { format: 'round-robin' } });
            tournament.start();
            tournament.removePlayer('p1');
            expect(thrown(() => tournament.removePlayer('p1'))).to.equal('Player is already marked inactive');
            expect(thrown(() => tournament.removePlayer('nope'))).to.equal('Player with ID nope does not exist');
        });
    });

    describe('swiss', () => {
        it('defaults to a logarithmic number of rounds and allows late entries', () => {
            const tournament = withPlayers(8, { stageOne: { format: 'swiss' } });
            tournament.start();
            expect(tournament.stageOne.rounds).to.equal(3);
            expect(tournament.matches.filter(m => m.round === 1)).to.have.lengthOf(4);
            expect(tournament.createPlayer('Late', 'p9').id).to.equal('p9');
        });

        it('gives a bye when the player count is odd', () => {
            const tournament = withPlayers(5, { stageOne: { format: 'swiss' } });
            tournament.start();
            expect(tournament.matches.filter(m => m.bye === true)).to.have.lengthOf(1);
        });
    });

    describe('settings', () => {
        it('merges partial settings instead of replacing whole sections', () => {
            const tournament = new Tournament('t1', 'Test Event');
            tournament.settings = { scoring: { win: 3 } };
            tournament.settings = { scoring: { draw: 1 } };
            expect(tournament.scoring.win).to.equal(3);
            expect(tournament.scoring.draw).to.equal(1);
            expect(tournament.scoring.bestOf).to.equal(1);
            tournament.settings = { stageOne: { format: 'swiss' } };
            tournament.settings = { stageOne: { rounds: 5 } };
            expect(tournament.stageOne.format).to.equal('swiss');
            expect(tournament.stageOne.rounds).to.equal(5);
        });

        it('seeds the bracket by player value when sorting is set', () => {
            const tournament = withPlayers(4, { sorting: 'descending' });
            tournament.players.forEach((player, i) => player.values = { value: 4 - i });
            tournament.start();
            // Highest seed meets lowest seed, second seed meets third.
            const pairs = tournament.matches.filter(m => m.round === 1).map(m => [m.player1.id, m.player2.id].sort());
            expect(pairs).to.deep.include.members([['p1', 'p4'], ['p2', 'p3']]);
        });

        it('records seating when enabled', () => {
            const tournament = withPlayers(4, { seating: true, stageOne: { format: 'swiss' } });
            tournament.start();
            const match = tournament.matches.find(m => m.active === true)!;
            const player1 = tournament.players.find(p => p.id === match.player1.id)!;
            const player2 = tournament.players.find(p => p.id === match.player2.id)!;
            expect(player1.matches.find(m => m.id === match.id)!.seating).to.equal(1);
            expect(player2.matches.find(m => m.id === match.id)!.seating).to.equal(-1);
        });

        it('starts at the configured initial round', () => {
            const tournament = withPlayers(4, { stageOne: { format: 'round-robin', initialRound: 5 } });
            tournament.start();
            expect(tournament.round).to.equal(5);
            expect(tournament.matches.filter(m => m.active === true).every(m => m.round === 5)).to.equal(true);
        });
    });

    describe('very small tournaments', () => {
        it('runs a two player single elimination as one match', () => {
            const tournament = withPlayers(2);
            tournament.start();
            expect(tournament.stageOne.rounds).to.equal(1);
            expect(tournament.matches).to.have.lengthOf(1);
            const match = tournament.matches[0];
            const winner = match.player1.id;
            const loser = match.player2.id;
            tournament.enterResult(match.id, 1, 0);
            expect(match.active).to.equal(false);
            expect(tournament.players.find(p => p.id === loser)!.active).to.equal(false);
            expect(tournament.players.find(p => p.id === winner)!.active).to.equal(true);
            expect(tournament.standings(false)[0].player.id).to.equal(winner);
        });

        it('lets the odd player out wait for the final with three players', () => {
            const tournament = withPlayers(3);
            tournament.start();
            expect(tournament.stageOne.rounds).to.equal(2);
            expect(tournament.matches.filter(m => m.active === true)).to.have.lengthOf(1);

            const semiFinal = tournament.matches.find(m => m.round === 1)!;
            const final = tournament.matches.find(m => m.round === 2)!;
            // One player is already seated in the final, waiting for an opponent.
            expect(final.active).to.equal(false);
            const waiting = final.player1.id;
            expect(waiting).to.not.equal(null);
            expect([semiFinal.player1.id, semiFinal.player2.id]).to.not.include(waiting);
            expect(tournament.players.find(p => p.id === waiting)!.matches).to.have.lengthOf(0);

            const qualified = semiFinal.player1.id;
            tournament.enterResult(semiFinal.id, 1, 0);
            expect(final.active).to.equal(true);
            expect(final.player2.id).to.equal(qualified);

            tournament.enterResult(final.id, 0, 1);
            expect(tournament.players.filter(p => p.active === true).map(p => p.id)).to.deep.equal([qualified]);
            const standings = tournament.standings(false);
            expect(standings[0].player.id).to.equal(qualified);
            expect(standings[0].matchPoints).to.equal(2);
        });

        it('runs a two player round-robin as a single round', () => {
            const tournament = withPlayers(2, { stageOne: { format: 'round-robin' } });
            tournament.start();
            expect(tournament.stageOne.rounds).to.equal(1);
            expect(tournament.matches).to.have.lengthOf(1);
            playRound(tournament);
            tournament.next();
            expect(tournament.status).to.equal('complete');
        });

        it('gives a bye every round in a three player round-robin', () => {
            const tournament = withPlayers(3, { stageOne: { format: 'round-robin' } });
            tournament.start();
            expect(tournament.stageOne.rounds).to.equal(3);
            // Three rounds, each with one real match and one bye.
            expect(tournament.matches).to.have.lengthOf(6);
            expect(tournament.matches.filter(m => m.active === true)).to.have.lengthOf(1);

            for (let round = 1; round <= 3; round++) {
                playRound(tournament);
                tournament.next();
            }
            expect(tournament.status).to.equal('complete');
            // Everyone played the two others, and sat out once.
            tournament.players.forEach(player => {
                expect(player.matches.filter(m => m.bye === false).map(m => m.opponent).sort())
                    .to.deep.equal(tournament.players.filter(p => p.id !== player.id).map(p => p.id).sort());
                expect(player.matches.filter(m => m.bye === true)).to.have.lengthOf(1);
            });
        });
    });

    describe('double elimination', () => {
        it('sends a loser to the losers bracket instead of eliminating them', () => {
            const tournament = withPlayers(4, { stageOne: { format: 'double-elimination' } });
            tournament.start();
            const [first, second] = tournament.matches.filter(m => m.round === 1);
            const firstLoser = first.player2.id;
            tournament.enterResult(first.id, 1, 0);
            // Losing once keeps a player in the tournament.
            expect(tournament.players.find(p => p.id === firstLoser)!.active).to.equal(true);
            tournament.enterResult(second.id, 1, 0);
            const losersMatch = tournament.matches.find(m => m.active === true && [m.player1.id, m.player2.id].includes(firstLoser) && m.id !== first.id)!;
            expect(losersMatch).to.not.equal(undefined);
            // Losing a second time does eliminate them.
            const eliminated = losersMatch.player1.id === firstLoser ? firstLoser : losersMatch.player2.id;
            tournament.enterResult(losersMatch.id, losersMatch.player1.id === eliminated ? 0 : 1, losersMatch.player1.id === eliminated ? 1 : 0);
            expect(tournament.players.find(p => p.id === eliminated)!.active).to.equal(false);
        });

        it('plays down to a single winner', () => {
            const tournament = withPlayers(4, { stageOne: { format: 'double-elimination' } });
            tournament.start();
            let guard = 0;
            while (tournament.matches.some(m => m.active === true) && guard++ < 20) {
                playRound(tournament);
            }
            expect(guard).to.be.lessThan(20);
            expect(tournament.players.filter(p => p.active === true)).to.have.lengthOf(1);
        });
    });

    describe('stepladder', () => {
        it('starts with the lowest seeds and adds one player per round', () => {
            const tournament = withPlayers(3, { stageOne: { format: 'stepladder' } });
            tournament.start();
            expect(tournament.stageOne.rounds).to.equal(2);
            expect(tournament.matches.filter(m => m.active === true)).to.have.lengthOf(1);
            const final = tournament.matches.find(m => m.round === 2)!;
            expect(final.player1.id).to.not.equal(null);
            expect(final.player2.id).to.equal(null);

            const challenger = tournament.matches[0].player1.id;
            tournament.enterResult(tournament.matches[0].id, 1, 0);
            expect(final.active).to.equal(true);
            expect(final.player2.id).to.equal(challenger);
            expect(thrown(() => tournament.next())).to.equal('Can not advance rounds in elimination or stepladder');
        });
    });

    describe('double round-robin', () => {
        it('pairs every player twice', () => {
            const tournament = withPlayers(4, { stageOne: { format: 'double-round-robin' } });
            tournament.start();
            expect(tournament.stageOne.rounds).to.equal(6);
            expect(tournament.matches).to.have.lengthOf(12);
            for (let round = 1; round <= 6; round++) {
                playRound(tournament);
                tournament.next();
            }
            expect(tournament.status).to.equal('complete');
            tournament.players.forEach(player => {
                const opponents = player.matches.map(m => m.opponent).sort();
                expect(opponents).to.have.lengthOf(6);
                tournament.players.filter(p => p.id !== player.id).forEach(other => {
                    expect(opponents.filter(o => o === other.id)).to.have.lengthOf(2);
                });
            });
        });
    });

    describe('stage two', () => {
        it('advances the top ranked players into a playoff bracket', () => {
            const tournament = withPlayers(4, {
                stageOne: { format: 'round-robin' },
                stageTwo: { format: 'single-elimination', advance: { method: 'rank', value: 2 } }
            });
            tournament.start();
            for (let round = 1; round <= 3; round++) {
                playRound(tournament);
                tournament.next();
            }
            expect(tournament.status).to.equal('stage-two');
            const qualified = tournament.players.filter(p => p.active === true).map(p => p.id);
            expect(qualified).to.have.lengthOf(2);

            const final = tournament.matches.find(m => m.active === true)!;
            expect([final.player1.id, final.player2.id]).to.have.members(qualified);
            const winner = final.player1.id;
            tournament.enterResult(final.id, 1, 0);
            expect(tournament.matches.some(m => m.active === true)).to.equal(false);
            expect(tournament.players.filter(p => p.active === true).map(p => p.id)).to.deep.equal([winner]);
        });

        it('advances everyone when the method is all', () => {
            const tournament = withPlayers(4, {
                stageOne: { format: 'round-robin' },
                stageTwo: { format: 'single-elimination', advance: { method: 'all' } }
            });
            tournament.start();
            for (let round = 1; round <= 3; round++) {
                playRound(tournament);
                tournament.next();
            }
            expect(tournament.status).to.equal('stage-two');
            expect(tournament.players.filter(p => p.active === true)).to.have.lengthOf(4);
            expect(tournament.matches.filter(m => m.active === true)).to.have.lengthOf(2);
        });

        it('refuses a playoff that too few players qualified for', () => {
            const tournament = withPlayers(4, {
                stageOne: { format: 'round-robin' },
                stageTwo: { format: 'single-elimination', advance: { method: 'rank', value: 1 } }
            });
            tournament.start();
            const advance = () => {
                for (let round = 1; round <= 3; round++) {
                    playRound(tournament);
                    tournament.next();
                }
            };
            expect(thrown(advance)).to.equal('Insufficient number of players (1) to create stage two matches');
        });

        it('only advances rounds during stage one', () => {
            const tournament = withPlayers(4, { stageOne: { format: 'round-robin' } });
            expect(thrown(() => tournament.next())).to.equal('Can only advance rounds during stage one');
            tournament.start();
            tournament.end();
            expect(thrown(() => tournament.next())).to.equal('Can only advance rounds during stage one');
        });

        it('refuses new players once a non-Swiss tournament has started', () => {
            const tournament = withPlayers(4, { stageOne: { format: 'round-robin' } });
            tournament.start();
            expect(thrown(() => tournament.createPlayer('Late'))).to.equal('Players can only be added during setup or stage one (if Swiss format)');
            tournament.end();
            expect(thrown(() => tournament.createPlayer('Later'))).to.equal('Players can only be added during setup or stage one (if Swiss format)');
        });
    });

    describe('byes and forfeits', () => {
        it('assigns a bye to a player without a match', () => {
            const tournament = withPlayers(4, { stageOne: { format: 'swiss' }, scoring: { win: 3, bye: 3 } });
            tournament.start();
            const latecomer = tournament.createPlayer('Late', 'p5');
            tournament.assignBye('p5', 1);
            const bye = tournament.matches.find(m => m.player1.id === 'p5')!;
            expect(bye.bye).to.equal(true);
            expect(bye.round).to.equal(1);
            expect(latecomer.matches[0].bye).to.equal(true);
            expect(tournament.standings().find(s => s.player.id === 'p5')!.matchPoints).to.equal(3);
        });

        it('rejects impossible byes', () => {
            const tournament = withPlayers(4, { stageOne: { format: 'swiss' } });
            tournament.start();
            expect(thrown(() => tournament.assignBye('nope', 1))).to.equal('Player with ID nope does not exist');
            const paired = tournament.matches[0].player1.id!;
            expect(thrown(() => tournament.assignBye(paired, 1))).to.equal('Player already has a match in round 1');
            tournament.removePlayer('p1');
            expect(thrown(() => tournament.assignBye('p1', 1))).to.equal('Player is currently inactive');
        });

        it('replaces a match with a loss and gives the opponent a bye', () => {
            const tournament = withPlayers(4, { stageOne: { format: 'swiss' } });
            tournament.start();
            const match = tournament.matches[0];
            const forfeiter = match.player1.id!;
            const opponent = match.player2.id!;
            tournament.assignLoss(forfeiter, 1);

            expect(tournament.matches.some(m => m.id === match.id)).to.equal(false);
            const loss = tournament.matches.find(m => m.player1.id === forfeiter)!;
            expect(loss.player1.loss).to.equal(1);
            expect(loss.bye).to.equal(false);
            const bye = tournament.matches.find(m => m.player1.id === opponent)!;
            expect(bye.bye).to.equal(true);

            const forfeiterMatches = tournament.players.find(p => p.id === forfeiter)!.matches;
            expect(forfeiterMatches).to.have.lengthOf(1);
            expect(forfeiterMatches[0].loss).to.equal(1);
            expect(tournament.standings().find(s => s.player.id === forfeiter)!.matchPoints).to.equal(0);
        });

        it('only assigns losses during Swiss pairings', () => {
            const tournament = withPlayers(4);
            tournament.start();
            expect(thrown(() => tournament.assignLoss('p1', 1))).to.equal('Can only assign losses during Swiss pairings');
        });
    });

    describe('editing results', () => {
        it('reverses the bracket when clearing an elimination result', () => {
            const tournament = withPlayers(4);
            tournament.start();
            const [first, second] = tournament.matches.filter(m => m.round === 1);
            const final = tournament.matches.find(m => m.round === 2)!;
            tournament.enterResult(first.id, 1, 0);
            tournament.enterResult(second.id, 1, 0);
            expect(final.active).to.equal(true);

            const wronglyEliminated = first.player2.id;
            tournament.clearResult(first.id);
            expect(first.active).to.equal(true);
            expect(first.player1.win).to.equal(0);
            expect(final.active).to.equal(false);
            // The winner of the cleared match is pulled back out of the final.
            expect([final.player1.id, final.player2.id]).to.include(null);
            expect(tournament.players.find(p => p.id === wronglyEliminated)!.active).to.equal(true);
            expect(tournament.players.find(p => p.id === final.player2.id)!.matches).to.have.lengthOf(1);

            // Entering the opposite result sends the other player through.
            tournament.enterResult(first.id, 0, 1);
            expect(final.active).to.equal(true);
            expect([final.player1.id, final.player2.id]).to.include(wronglyEliminated);
        });

        it('gives a forfeit win to the opponent when a player is removed mid-match', () => {
            const tournament = withPlayers(4);
            tournament.start();
            const match = tournament.matches.filter(m => m.round === 1)[0];
            const quitter = match.player1.id!;
            const opponent = match.player2.id!;
            tournament.removePlayer(quitter);

            expect(match.active).to.equal(false);
            expect(match.player1.loss).to.equal(1);
            expect(match.player2.win).to.equal(1);
            expect(tournament.players.find(p => p.id === quitter)!.active).to.equal(false);
            const final = tournament.matches.find(m => m.round === 2)!;
            expect([final.player1.id, final.player2.id]).to.include(opponent);
        });

        it('replaces a removed player with a bye in later round-robin rounds', () => {
            const tournament = withPlayers(4, { stageOne: { format: 'round-robin' } });
            tournament.start();
            playRound(tournament);
            tournament.next();
            tournament.removePlayer('p1');
            const laterMatches = tournament.matches.filter(m => m.round > tournament.round);
            expect(laterMatches).to.have.length.greaterThan(0);
            expect(laterMatches.some(m => m.player1.id === 'p1' || m.player2.id === 'p1')).to.equal(false);
        });

        it('counts draws for both players', () => {
            const tournament = withPlayers(2, {
                stageOne: { format: 'round-robin' },
                scoring: { win: 3, draw: 1, loss: 0 }
            });
            tournament.start();
            tournament.enterResult(tournament.matches[0].id, 0, 0, 1);
            const standings = tournament.standings(false);
            expect(standings.map(s => s.matchPoints)).to.deep.equal([1, 1]);
            expect(standings.every(s => s.player.matches[0].draw === 1)).to.equal(true);
        });

        it('tracks game wins separately from match wins in best of three', () => {
            const tournament = withPlayers(2, {
                stageOne: { format: 'round-robin' },
                scoring: { bestOf: 3, win: 3, draw: 1, loss: 0 }
            });
            tournament.start();
            tournament.enterResult(tournament.matches[0].id, 2, 1);
            const standings = tournament.standings(false);
            const winner = standings.find(s => s.matchPoints === 3)!;
            const loser = standings.find(s => s.matchPoints === 0)!;
            expect(winner.games).to.equal(3);
            expect(winner.gamePoints).to.equal(6);
            expect(winner.tiebreaks.gameWinPct).to.be.closeTo(2 / 3, 1e-9);
            expect(loser.tiebreaks.gameWinPct).to.be.closeTo(1 / 3, 1e-9);
        });
    });

    describe('tiebreaks', () => {
        it('ranks tied players by their head to head result', () => {
            const tournament = withPlayers(4, {
                stageOne: { format: 'round-robin' },
                scoring: { win: 3, draw: 1, loss: 0, tiebreaks: ['versus'] }
            });
            tournament.start();
            // p1 and p2 both finish 2-1, and p2 won their head to head match.
            const winners: { [pair: string]: string } = {
                'p1,p2': 'p2',
                'p1,p3': 'p1',
                'p1,p4': 'p1',
                'p2,p3': 'p3',
                'p2,p4': 'p2',
                'p3,p4': 'p4'
            };
            for (let round = 1; round <= 3; round++) {
                tournament.matches.filter(m => m.active === true).forEach(match => {
                    const winner = winners[[match.player1.id, match.player2.id].sort().join(',')];
                    tournament.enterResult(match.id, match.player1.id === winner ? 1 : 0, match.player1.id === winner ? 0 : 1);
                });
                tournament.next();
            }
            const standings = tournament.standings(false);
            expect(standings.slice(0, 2).map(s => s.matchPoints)).to.deep.equal([6, 6]);
            expect(standings[0].player.id).to.equal('p2');
            expect(standings[1].player.id).to.equal('p1');
        });

        it('computes opponent based tiebreaks', () => {
            const tournament = withPlayers(4, {
                stageOne: { format: 'round-robin' },
                scoring: { win: 3, draw: 1, loss: 0, tiebreaks: ['solkoff'] }
            });
            tournament.start();
            for (let round = 1; round <= 3; round++) {
                playRound(tournament);
                tournament.next();
            }
            const standings = tournament.standings(false);
            standings.forEach(standing => {
                const opponentPoints = standing.player.matches
                    .map(m => standings.find(s => s.player.id === m.opponent)!.matchPoints)
                    .reduce((sum, points) => sum + points, 0);
                expect(standing.tiebreaks.solkoff).to.equal(opponentPoints);
            });
            expect(standings.every(s => s.tiebreaks.matchWinPct === s.matchPoints / (s.matches * 3))).to.equal(true);
        });
    });

    describe('end', () => {
        it('marks everything inactive', () => {
            const tournament = withPlayers(4);
            tournament.start();
            tournament.end();
            expect(tournament.status).to.equal('complete');
            expect(tournament.players.some(p => p.active)).to.equal(false);
            expect(tournament.matches.some(m => m.active)).to.equal(false);
        });
    });
});
