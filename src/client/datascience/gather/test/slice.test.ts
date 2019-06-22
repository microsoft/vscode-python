import { expect } from 'chai';
import { parse } from '../analysis/parse/python/python-parser';
import { LocationSet, slice } from '../analysis/slice/slice';

describe('slices', () => {
    it('statements including the def and use', () => {
        let ast = parse(['a = 1', 'b = a', ''].join('\n'));
        let locations = slice(
            ast,
            new LocationSet({
                first_line: 2,
                first_column: 0,
                last_line: 2,
                last_column: 5
            })
        );
        expect(locations.items).to.deep.include({
            first_line: 1,
            first_column: 0,
            last_line: 1,
            last_column: 5
        });
    });

    it('at least yields the statement for a seed', () => {
        let ast = parse(['c = 1', ''].join('\n'));
        let locations = slice(
            ast,
            new LocationSet({
                first_line: 1,
                first_column: 0,
                last_line: 1,
                last_column: 2
            })
        );

        expect(
            locations.contains({
                first_line: 1,
                first_column: 0,
                last_line: 1,
                last_column: 5
            })
        ).to.be.true;
    });
});
