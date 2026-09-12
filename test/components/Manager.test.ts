import { expect } from 'chai';
import { Manager } from '../../src/components/Manager.js';
import { Match } from '../../src/components/Match.js';
import { Player } from '../../src/components/Player.js';
import { Tournament } from '../../src/components/Tournament.js';
import { thrown } from '../helpers.js';

describe('Manager', () => {
    it('creates a tournament with a generated ID', () => {
        const manager = new Manager();
        const tournament = manager.createTournament('First');
        expect(tournament.name).to.equal('First');
        expect(tournament.id).to.have.lengthOf(12);
        expect(manager.tournaments).to.deep.equal([tournament]);
    });

    it('applies settings given at creation', () => {
        const manager = new Manager();
        const tournament = manager.createTournament('Swiss Night', {
            sorting: 'descending',
            scoring: { win: 3, draw: 1 },
            stageOne: { format: 'swiss', rounds: 4 }
        }, 'swiss-night');
        expect(tournament.id).to.equal('swiss-night');
        expect(tournament.sorting).to.equal('descending');
        expect(tournament.scoring.win).to.equal(3);
        expect(tournament.scoring.draw).to.equal(1);
        expect(tournament.scoring.loss).to.equal(0);
        expect(tournament.stageOne.format).to.equal('swiss');
        expect(tournament.stageOne.rounds).to.equal(4);
    });

    it('refuses a duplicate ID', () => {
        const manager = new Manager();
        manager.createTournament('First', {}, 'dup');
        expect(thrown(() => manager.createTournament('Second', {}, 'dup'))).to.equal('Tournament with ID dup already exists');
        expect(manager.tournaments).to.have.lengthOf(1);
    });

    it('removes a tournament and ends it', () => {
        const manager = new Manager();
        manager.createTournament('First', {}, 'one');
        const second = manager.createTournament('Second', {}, 'two');
        second.createPlayer('Alice', 'a');
        const removed = manager.removeTournament('two');
        expect(removed).to.equal(second);
        expect(removed.status).to.equal('complete');
        expect(removed.players.every(p => p.active === false)).to.equal(true);
        expect(manager.tournaments.map(t => t.id)).to.deep.equal(['one']);
    });

    it('throws when removing an unknown tournament', () => {
        const manager = new Manager();
        expect(thrown(() => manager.removeTournament('nope'))).to.equal('No tournament with ID nope exists');
    });

    it('plays a single-elimination tournament with 4 players', () => {
        const manager = new Manager();
        const tournament = manager.createTournament('Cup', {
            stageOne: { format: 'single-elimination' }
        }, 'cup');
        ['Alice', 'Bob', 'Carol', 'Dave'].forEach((name, i) => tournament.createPlayer(name, `p${i + 1}`));
        tournament.start();

        const semiFinals = tournament.matches.filter(m => m.round === 1);
        const final = tournament.matches.find(m => m.round === 2)!;
        expect(semiFinals).to.have.lengthOf(2);
        expect(semiFinals.every(m => m.active === true)).to.equal(true);
        expect(final.active).to.equal(false);

        const finalists = semiFinals.map(m => m.player1.id);
        const eliminated = semiFinals.map(m => m.player2.id);
        semiFinals.forEach(m => tournament.enterResult(m.id, 1, 0));

        expect(final.active).to.equal(true);
        expect([final.player1.id, final.player2.id]).to.have.members(finalists);
        expect(tournament.players.filter(p => eliminated.includes(p.id)).every(p => p.active === false)).to.equal(true);

        const winner = final.player1.id;
        const runnerUp = final.player2.id;
        tournament.enterResult(final.id, 1, 0);

        expect(tournament.matches.some(m => m.active === true)).to.equal(false);
        expect(tournament.players.filter(p => p.active === true).map(p => p.id)).to.deep.equal([winner]);

        const standings = tournament.standings(false);
        expect(standings[0].player.id).to.equal(winner);
        expect(standings[0].matchPoints).to.equal(2);
        expect(standings.find(s => s.player.id === runnerUp)!.matchPoints).to.equal(1);

        tournament.end();
        expect(tournament.status).to.equal('complete');
        expect(tournament.players.some(p => p.active === true)).to.equal(false);
    });

    it('can export tournament to store it somewhere, and reload it', () => {
        const manager = new Manager();
        const original = manager.createTournament('Cup', {
            stageOne: { format: 'single-elimination' }
        }, 'cup');
        ['Alice', 'Bob', 'Carol', 'Dave'].forEach((name, i) => original.createPlayer(name, `p${i + 1}`));
        original.start();
        original.matches.filter(m => m.round === 1).forEach(m => original.enterResult(m.id, 1, 0));

        // What would be written to a database, a file, localStorage...
        const stored = JSON.stringify(original);

        const other = new Manager();
        const reloaded = other.reloadTournament(JSON.parse(stored));
        expect(other.tournaments).to.deep.equal([reloaded]);
        expect(reloaded).to.be.an.instanceOf(Tournament);
        expect(reloaded.id).to.equal('cup');
        expect(reloaded.name).to.equal('Cup');
        expect(reloaded.status).to.equal(original.status);
        expect(reloaded.round).to.equal(original.round);
        expect(reloaded.stageOne).to.deep.equal(original.stageOne);
        expect(reloaded.scoring).to.deep.equal(original.scoring);
        expect(reloaded.players.every(p => p instanceof Player)).to.equal(true);
        expect(reloaded.matches.every(m => m instanceof Match)).to.equal(true);
        expect(JSON.stringify(reloaded)).to.equal(stored);

        // The reloaded tournament is usable, not just readable.
        const final = reloaded.matches.find(m => m.round === 2)!;
        expect(final.active).to.equal(true);
        const winner = final.player2.id;
        reloaded.enterResult(final.id, 0, 1);
        expect(reloaded.standings(false)[0].player.id).to.equal(winner);
        expect(JSON.stringify(reloaded)).to.not.equal(stored);
    });
    it('gives every tournament a distinct generated ID', () => {
        const manager = new Manager();
        for (let i = 0; i < 20; i++) {
            manager.createTournament(`Event ${i}`);
        }
        const ids = manager.tournaments.map(t => t.id);
        expect(new Set(ids).size).to.equal(20);
    });

    it('manages several tournaments independently', () => {
        const manager = new Manager();
        const swiss = manager.createTournament('Swiss', { stageOne: { format: 'swiss' } }, 'swiss');
        const cup = manager.createTournament('Cup', { stageOne: { format: 'single-elimination' } }, 'cup');
        ['Alice', 'Bob', 'Carol', 'Dave'].forEach((name, i) => {
            swiss.createPlayer(name, `s${i}`);
            cup.createPlayer(name, `c${i}`);
        });
        swiss.start();
        expect(cup.status).to.equal('setup');
        expect(cup.matches).to.have.lengthOf(0);
        cup.start();
        expect(swiss.matches.every(m => cup.matches.every(c => c.id !== m.id))).to.equal(true);
    });

    it('reloads a Swiss tournament mid-round and can continue it', () => {
        const manager = new Manager();
        const original = manager.createTournament('Swiss', {
            stageOne: { format: 'swiss' },
            scoring: { win: 3, draw: 1, loss: 0, bye: 3 }
        }, 'swiss');
        for (let i = 1; i <= 5; i++) {
            original.createPlayer(`Player ${i}`, `p${i}`);
        }
        original.start();
        original.matches.filter(m => m.active === true).forEach(m => original.enterResult(m.id, 1, 0));
        original.next();

        const reloaded = new Manager().reloadTournament(JSON.parse(JSON.stringify(original)));
        expect(reloaded.round).to.equal(2);
        expect(reloaded.status).to.equal('stage-one');
        expect(reloaded.matches).to.have.lengthOf(original.matches.length);
        expect(reloaded.standings(false).map(s => [s.player.id, s.matchPoints]))
            .to.deep.equal(original.standings(false).map(s => [s.player.id, s.matchPoints]));

        reloaded.matches.filter(m => m.active === true).forEach(m => reloaded.enterResult(m.id, 1, 0));
        reloaded.next();
        expect(reloaded.round).to.equal(3);
    });

    it('keeps a removed tournament usable as a returned object', () => {
        const manager = new Manager();
        const tournament = manager.createTournament('Cup', {}, 'cup');
        tournament.createPlayer('Alice', 'a');
        tournament.createPlayer('Bob', 'b');
        tournament.start();
        const removed = manager.removeTournament('cup');
        expect(manager.tournaments).to.have.lengthOf(0);
        expect(removed.matches).to.have.lengthOf(1);
        expect(removed.standings(false)).to.have.lengthOf(2);
    });
});
