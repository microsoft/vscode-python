
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import '../../client/common/extensions';
import { LineFormatter } from '../../client/formatters/lineFormatter';

const formatFilesPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'formatting');
const grammarFile = path.join(formatFilesPath, 'pythonGrammar.py');

// https://www.python.org/dev/peps/pep-0008/#code-lay-out
// tslint:disable-next-line:max-func-body-length
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
    test('Equals in first argument', () => {
        const actual = formatter.formatLine('foo(x =0)');
        assert.equal(actual, 'foo(x=0)');
    });
    test('Equals in second argument', () => {
        const actual = formatter.formatLine('foo(x,y= \"a\",');
        assert.equal(actual, 'foo(x, y=\"a\",');
    });
    test('Equals in multiline arguments', () => {
        const actual = formatter.formatLine('x = 1,y =-2)');
        assert.equal(actual, 'x=1, y=-2)');
    });
    test('Equals in multiline arguments starting comma', () => {
        const actual = formatter.formatLine(',x = 1,y =m)');
        assert.equal(actual, ', x=1, y=m)');
    });
    test('Equals in multiline arguments ending comma', () => {
        const actual = formatter.formatLine('x = 1,y =m,');
        assert.equal(actual, 'x=1, y=m,');
    });
    test('Operators without following space', () => {
        const actual = formatter.formatLine('foo( *a, ** b, ! c)');
        assert.equal(actual, 'foo(*a, **b, !c)');
    });
    test('Brace after keyword', () => {
        const actual = formatter.formatLine('for x in(1,2,3)');
        assert.equal(actual, 'for x in (1, 2, 3)');
    });
    test('Dot operator', () => {
        const actual = formatter.formatLine('x.y');
        assert.equal(actual, 'x.y');
    });
    test('Unknown tokens no space', () => {
        const actual = formatter.formatLine('abc\\n\\');
        assert.equal(actual, 'abc\\n\\');
    });
    test('Unknown tokens with space', () => {
        const actual = formatter.formatLine('abc \\n \\');
        assert.equal(actual, 'abc \\n \\');
    });
    test('Double asterisk', () => {
        const actual = formatter.formatLine('a**2, ** k');
        assert.equal(actual, 'a ** 2, **k');
    });
    test('Lambda', () => {
        const actual = formatter.formatLine('lambda * args, :0');
        assert.equal(actual, 'lambda *args,: 0');
    });
    test('Comma expression', () => {
        const actual = formatter.formatLine('x=1,2,3');
        assert.equal(actual, 'x = 1, 2, 3');
    });
    test('is exression', () => {
        const actual = formatter.formatLine('a( (False is  2)  is 3)');
        assert.equal(actual, 'a((False is 2) is 3)');
    });
    test('Grammar file', () => {
        const content = fs.readFileSync(grammarFile).toString('utf8');
        const lines = content.splitLines({ trim: false, removeEmptyEntries: false });
        for (let i = 0; i < lines.length; i += 1) {
            const line = lines[i];
            const actual = formatter.formatLine(line);
            assert.equal(actual, line, `Line ${i + 1} changed: '${line}' to '${actual}'`);
        }
    });
});
