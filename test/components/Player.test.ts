import { expect } from 'chai';
import { Player } from '../../src/components/Player.js';
import { thrown } from '../helpers.js';

describe('Player', () => {
    it('is created active with no matches', () => {
        const player = new Player('abc', 'Alice');
        expect(player.id).to.equal('abc');
        expect(player.name).to.equal('Alice');
        expect(player.active).to.equal(true);
        expect(player.value).to.equal(0);
        expect(player.matches).to.deep.equal([]);
        expect(player.meta).to.deep.equal({});
    });

    it('appends matches when setting values', () => {
        const player = new Player('abc', 'Alice');
        player.addMatch({ id: 'm1', opponent: 'def' });
        player.values = {
            value: 1500,
            matches: [{
                id: 'm2',
                opponent: 'ghi',
                pairUpDown: false,
                seating: null,
                bye: false,
                win: 0,
                loss: 0,
                draw: 0
            }]
        };
        expect(player.value).to.equal(1500);
        expect(player.matches.map(m => m.id)).to.deep.equal(['m1', 'm2']);
    });

    it('fills in defaults when adding a match', () => {
        const player = new Player('abc', 'Alice');
        player.addMatch({ id: 'm1', opponent: 'def' });
        expect(player.matches[0]).to.deep.equal({
            id: 'm1',
            opponent: 'def',
            pairUpDown: false,
            seating: null,
            bye: false,
            win: 0,
            loss: 0,
            draw: 0
        });
    });

    it('refuses to add the same match twice', () => {
        const player = new Player('abc', 'Alice');
        player.addMatch({ id: 'm1', opponent: 'def' });
        expect(thrown(() => player.addMatch({ id: 'm1', opponent: 'ghi' }))).to.equal('Match with ID m1 already exists');
    });

    it('updates and removes a match', () => {
        const player = new Player('abc', 'Alice');
        player.addMatch({ id: 'm1', opponent: 'def' });
        player.updateMatch('m1', { win: 2, loss: 1 });
        expect(player.matches[0].win).to.equal(2);
        expect(player.matches[0].loss).to.equal(1);
        expect(player.matches[0].opponent).to.equal('def');
        player.removeMatch('m1');
        expect(player.matches).to.deep.equal([]);
    });

    it('keeps explicit match details given to addMatch', () => {
        const player = new Player('abc', 'Alice');
        player.addMatch({ id: 'm1', opponent: null, bye: true, win: 2, seating: -1, pairUpDown: true });
        expect(player.matches[0]).to.deep.equal({
            id: 'm1',
            opponent: null,
            pairUpDown: true,
            seating: -1,
            bye: true,
            win: 2,
            loss: 0,
            draw: 0
        });
    });

    it('leaves matches untouched when values omits them', () => {
        const player = new Player('abc', 'Alice');
        player.addMatch({ id: 'm1', opponent: 'def' });
        player.values = { active: false, meta: { club: 'Hex' } };
        expect(player.active).to.equal(false);
        expect(player.meta).to.deep.equal({ club: 'Hex' });
        expect(player.matches.map(m => m.id)).to.deep.equal(['m1']);
    });

    it('updates only the given fields of a match', () => {
        const player = new Player('abc', 'Alice');
        player.addMatch({ id: 'm1', opponent: 'def', win: 2, loss: 1 });
        player.updateMatch('m1', { draw: 1 });
        expect(player.matches[0].win).to.equal(2);
        expect(player.matches[0].loss).to.equal(1);
        expect(player.matches[0].draw).to.equal(1);
    });

    it('removes the right match when there are several', () => {
        const player = new Player('abc', 'Alice');
        ['m1', 'm2', 'm3'].forEach(id => player.addMatch({ id, opponent: 'def' }));
        player.removeMatch('m2');
        expect(player.matches.map(m => m.id)).to.deep.equal(['m1', 'm3']);
        expect(thrown(() => player.removeMatch('m2'))).to.equal('Match with ID m2 does not exist');
    });

    it('throws on an unknown match', () => {
        const player = new Player('abc', 'Alice');
        expect(thrown(() => player.updateMatch('nope', { win: 1 }))).to.equal('Match with ID nope does not exist');
        expect(thrown(() => player.removeMatch('nope'))).to.equal('Match with ID nope does not exist');
    });
});
