
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as TypeMoq from 'typemoq';
import { TextDocument, TextLine } from 'vscode';
import '../../client/common/extensions';
import { LineFormatter } from '../../client/formatters/lineFormatter';

const formatFilesPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'formatting');
const grammarFile = path.join(formatFilesPath, 'pythonGrammar.py');

// https://www.python.org/dev/peps/pep-0008/#code-lay-out
// tslint:disable-next-line:max-func-body-length
suite('Formatting - line formatter', () => {
    const formatter = new LineFormatter();

    test('Operator spacing', () => {
        testFormatLine('( x  +1 )*y/ 3', '(x + 1) * y / 3');
    });
    test('Braces spacing', () => {
        testFormatLine('foo =(0 ,)', 'foo = (0,)');
    });
    test('Function arguments', () => {
        testFormatLine('z=foo (0 , x= 1, (3+7) , y , z )',
            'z = foo(0, x=1, (3 + 7), y, z)');
    });
    test('Colon regular', () => {
        testFormatLine('if x == 4 : print x,y; x,y= y, x',
            'if x == 4: print x, y; x, y = y, x');
    });
    test('Colon slices', () => {
        testFormatLine('x[1: 30]', 'x[1:30]');
    });
    test('Colon slices in arguments', () => {
        testFormatLine('spam ( ham[ 1 :3], {eggs : 2})',
            'spam(ham[1:3], {eggs: 2})');
    });
    test('Colon slices with double colon', () => {
        testFormatLine('ham [1:9 ], ham[ 1: 9:   3], ham[: 9 :3], ham[1: :3], ham [ 1: 9:]',
            'ham[1:9], ham[1:9:3], ham[:9:3], ham[1::3], ham[1:9:]');
    });
    test('Colon slices with operators', () => {
        testFormatLine('ham [lower+ offset :upper+offset]',
            'ham[lower + offset:upper + offset]');
    });
    test('Colon slices with functions', () => {
        testFormatLine('ham[ : upper_fn ( x) : step_fn(x )], ham[ :: step_fn(x)]',
            'ham[:upper_fn(x):step_fn(x)], ham[::step_fn(x)]');
    });
    test('Colon in for loop', () => {
        testFormatLine('for index in  range( len(fruits) ): ',
            'for index in range(len(fruits)):');
    });
    test('Nested braces', () => {
        testFormatLine('[ 1 :[2: (x,),y]]{1}', '[1:[2:(x,), y]]{1}');
    });
    test('Trailing comment', () => {
        testFormatLine('x=1  # comment', 'x = 1 # comment');
    });
    test('Single comment', () => {
        testFormatLine('# comment', '# comment');
    });
    test('Comment with leading whitespace', () => {
        testFormatLine('   # comment', '   # comment');
    });
    test('Equals in first argument', () => {
        testFormatLine('foo(x =0)', 'foo(x=0)');
    });
    test('Equals in second argument', () => {
        testFormatLine('foo(x,y= \"a\",', 'foo(x, y=\"a\",');
    });
    test('Equals in multiline arguments', () => {
        testFormatLine2('foo(a,', 'x = 1,y =-2)', 'x=1, y=-2)');
    });
    test('Equals in multiline arguments starting comma', () => {
        testFormatLine(',x = 1,y =m)', ', x=1, y=m)');
    });
    test('Equals in multiline arguments ending comma', () => {
        testFormatLine('x = 1,y =m,', 'x=1, y=m,');
    });
    test('Operators without following space', () => {
        testFormatLine('foo( *a, ** b, ! c)', 'foo(*a, **b, !c)');
    });
    test('Brace after keyword', () => {
        testFormatLine('for x in(1,2,3)', 'for x in (1, 2, 3)');
    });
    test('Dot operator', () => {
        testFormatLine('x.y', 'x.y');
    });
    test('Unknown tokens no space', () => {
        testFormatLine('abc\\n\\', 'abc\\n\\');
    });
    test('Unknown tokens with space', () => {
        testFormatLine('abc \\n \\', 'abc \\n \\');
    });
    test('Double asterisk', () => {
        testFormatLine('a**2, ** k', 'a ** 2, **k');
    });
    test('Lambda', () => {
        testFormatLine('lambda * args, :0', 'lambda *args,: 0');
    });
    test('Comma expression', () => {
        testFormatLine('x=1,2,3', 'x = 1, 2, 3');
    });
    test('is exression', () => {
        testFormatLine('a( (False is  2)  is 3)', 'a((False is 2) is 3)');
    });
    test('Function returning tuple', () => {
        testFormatLine('x,y=f(a)', 'x, y = f(a)');
    });
    test('from. import A', () => {
        testFormatLine('from. import A', 'from . import A');
    });
    test('from .. import', () => {
        testFormatLine('from ..import', 'from .. import');
    });
    test('from..x import', () => {
        testFormatLine('from..x import', 'from ..x import');
    });
    test('Grammar file', () => {
        const content = fs.readFileSync(grammarFile).toString('utf8');
        const lines = content.splitLines({ trim: false, removeEmptyEntries: false });
        let prevLine = '';
        for (let i = 0; i < lines.length; i += 1) {
            const line = lines[i];
            const actual = formatLine2(prevLine, line);
            assert.equal(actual, line, `Line ${i + 1} changed: '${line.trim()}' to '${actual.trim()}'`);
            prevLine = line;
        }
    });

    function testFormatLine(text: string, expected: string): void {
        const actual = formatLine(text);
        assert.equal(actual, expected);
    }

    function formatLine(text: string): string {
        const line = TypeMoq.Mock.ofType<TextLine>();
        line.setup(x => x.text).returns(() => text);

        const document = TypeMoq.Mock.ofType<TextDocument>();
        document.setup(x => x.lineAt(TypeMoq.It.isAnyNumber())).returns(() => line.object);

        return formatter.formatLine(document.object, 0);
    }

    function formatLine2(prevLineText: string, lineText: string): string {
        const thisLine = TypeMoq.Mock.ofType<TextLine>();
        thisLine.setup(x => x.text).returns(() => lineText);

        const prevLine = TypeMoq.Mock.ofType<TextLine>();
        prevLine.setup(x => x.text).returns(() => prevLineText);

        const document = TypeMoq.Mock.ofType<TextDocument>();
        document.setup(x => x.lineAt(0)).returns(() => prevLine.object);
        document.setup(x => x.lineAt(1)).returns(() => thisLine.object);

        return formatter.formatLine(document.object, 1);
    }

    function testFormatLine2(prevLineText: string, lineText: string, expected: string): void {
        const actual = formatLine2(prevLineText, lineText);
        assert.equal(actual, expected);
    }
});
