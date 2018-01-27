
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import { LineFormatter } from '../../client/formatters/lineFormatter';

// https://www.python.org/dev/peps/pep-0008/#code-lay-out
suite('Formatting - line formatter', () => {
    const formatter = new LineFormatter();

    test('Operator spacing', () => {
        const actual = formatter.formatLine('( x  +1 )*y/ 3');
        assert.equal(actual, '(x + 1) * y / 3');
    });
    test('Braces spacing', () => {
        const actual = formatter.formatLine('foo =(0 ,)');
        assert.equal(actual, 'foo = (0,)');
    });
    test('Function arguments', () => {
        const actual = formatter.formatLine('foo (0 , x= 1, (3+7) , y , z )');
        assert.equal(actual, 'foo(0, x=1, (3 + 7), y, z)');
    });
    test('Colon regular', () => {
        const actual = formatter.formatLine('if x == 4 : print x,y; x,y= y, x');
        assert.equal(actual, 'if x == 4: print x, y; x, y = y, x');
    });
    test('Colon slices', () => {
        const actual = formatter.formatLine('x[1: 30]');
        assert.equal(actual, 'x[1:30]');
    });
    test('Colon slices in arguments', () => {
        const actual = formatter.formatLine('spam ( ham[ 1 :3], {eggs : 2})');
        assert.equal(actual, 'spam(ham[1:3], {eggs: 2})');
    });
    test('Colon slices with double colon', () => {
        const actual = formatter.formatLine('ham [1:9 ], ham[ 1: 9:   3], ham[: 9 :3], ham[1: :3], ham [ 1: 9:]');
        assert.equal(actual, 'ham[1:9], ham[1:9:3], ham[:9:3], ham[1::3], ham[1:9:]');
    });
    test('Colon slices with operators', () => {
        const actual = formatter.formatLine('ham [lower+ offset :upper+offset]');
        assert.equal(actual, 'ham[lower + offset:upper + offset]');
    });
    test('Colon slices with functions', () => {
        const actual = formatter.formatLine('ham[ : upper_fn ( x) : step_fn(x )], ham[ :: step_fn(x)]');
        assert.equal(actual, 'ham[:upper_fn(x):step_fn(x)], ham[::step_fn(x)]');
    });
    test('Colon in for loop', () => {
        const actual = formatter.formatLine('for index in  range( len(fruits) ): ');
        assert.equal(actual, 'for index in range(len(fruits)):');
    });
    test('Nested braces', () => {
        const actual = formatter.formatLine('[ 1 :[2: (x,),y]]{1}');
        assert.equal(actual, '[1:[2:(x,), y]]{1}');
    });
    test('Trailing comment', () => {
        const actual = formatter.formatLine('x=1  # comment');
        assert.equal(actual, 'x = 1 # comment');
    });
    test('Single comment', () => {
        const actual = formatter.formatLine('# comment');
        assert.equal(actual, '# comment');
    });
    test('Comment with leading whitespace', () => {
        const actual = formatter.formatLine('   # comment');
        assert.equal(actual, '   # comment');
    });
});
