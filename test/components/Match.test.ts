import { expect } from 'chai';
import { Match } from '../../src/components/Match.js';

describe('Match', () => {
    it('is created inactive with empty players', () => {
        const match = new Match('m1', 2, 3);
        expect(match.id).to.equal('m1');
        expect(match.round).to.equal(2);
        expect(match.match).to.equal(3);
        expect(match.active).to.equal(false);
        expect(match.bye).to.equal(false);
        expect(match.player1).to.deep.equal({ id: null, win: 0, loss: 0, draw: 0 });
        expect(match.player2).to.deep.equal({ id: null, win: 0, loss: 0, draw: 0 });
        expect(match.path).to.deep.equal({ win: null, loss: null });
    });

    it('merges partial player details instead of replacing them', () => {
        const match = new Match('m1', 1, 1);
        match.values = {
            active: true,
            player1: { id: 'abc' },
            player2: { id: 'def' }
        };
        match.values = {
            player1: { win: 2 },
            player2: { loss: 2 }
        };
        expect(match.active).to.equal(true);
        expect(match.player1).to.deep.equal({ id: 'abc', win: 2, loss: 0, draw: 0 });
        expect(match.player2).to.deep.equal({ id: 'def', win: 0, loss: 2, draw: 0 });
    });

    it('merges partial paths', () => {
        const match = new Match('m1', 1, 1);
        match.values = { path: { win: 'm5' } };
        expect(match.path).to.deep.equal({ win: 'm5', loss: null });
    });
    it('leaves players and path untouched when values omits them', () => {
        const match = new Match('m1', 1, 1);
        match.values = { player1: { id: 'abc' }, path: { win: 'm5' } };
        match.values = { bye: true, meta: { table: 3 } };
        expect(match.bye).to.equal(true);
        expect(match.meta).to.deep.equal({ table: 3 });
        expect(match.player1.id).to.equal('abc');
        expect(match.path.win).to.equal('m5');
    });

    it('can clear a player back out of the match', () => {
        const match = new Match('m1', 1, 1);
        match.values = { active: true, player1: { id: 'abc', win: 1 } };
        match.values = { active: false, player1: { id: null, win: 0 } };
        expect(match.active).to.equal(false);
        expect(match.player1).to.deep.equal({ id: null, win: 0, loss: 0, draw: 0 });
    });
});
