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
