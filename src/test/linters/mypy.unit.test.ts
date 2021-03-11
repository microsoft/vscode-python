// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import { parseLine } from '../../client/linters/baseLinter';
import { getRegex } from '../../client/linters/mypy';
import { ILintMessage, LinterId } from '../../client/linters/types';

// This following is a real-world example. See gh=2380.

const output = `
provider.pyi:10: error: Incompatible types in assignment (expression has type "str", variable has type "int")
provider.pyi:11: error: Name 'not_declared_var' is not defined
provider.pyi:12:21: error: Expression has type "Any"
`;

suite('Linting - MyPy', () => {
    test('regex', async () => {
        const lines = output.split('\n');
        const tests: [string, ILintMessage][] = [
            [
                lines[1],
                {
                    code: undefined,
                    message: 'Incompatible types in assignment (expression has type "str", variable has type "int")',
                    column: 0,
                    line: 10,
                    type: 'error',
                    provider: 'mypy',
                } as ILintMessage,
            ],
            [
                lines[2],
                {
                    code: undefined,
                    message: "Name 'not_declared_var' is not defined",
                    column: 0,
                    line: 11,
                    type: 'error',
                    provider: 'mypy',
                } as ILintMessage,
            ],
            [
                lines[3],
                {
                    code: undefined,
                    message: 'Expression has type "Any"',
                    column: 20,
                    line: 12,
                    type: 'error',
                    provider: 'mypy',
                } as ILintMessage,
            ],
        ];
        for (const [line, expected] of tests) {
            const msg = parseLine(line, getRegex('provider.pyi'), LinterId.MyPy, 1);

            expect(msg).to.deep.equal(expected);
        }
    });
    test('regex excludes unexpected files', () => {
        // mypy run against `foo/bar.py` returning errors for foo/__init__.py
        const outputWithUnexpectedFile = `\
foo/__init__.py:4:5: error: Statement is unreachable  [unreachable]
foo/bar.py:2:14: error: Incompatible types in assignment (expression has type "str", variable has type "int")  [assignment]
Found 2 errors in 2 files (checked 1 source file)
`;

        const lines = outputWithUnexpectedFile.split('\n');
        const tests: [string, ILintMessage | undefined][] = [
            [lines[0], undefined],
            [
                lines[1],
                {
                    code: undefined,
                    message:
                        'Incompatible types in assignment (expression has type "str", variable has type "int")  [assignment]',
                    column: 13,
                    line: 2,
                    type: 'error',
                    provider: 'mypy',
                },
            ],
            [lines[2], undefined],
        ];
        for (const [line, expected] of tests) {
            const msg = parseLine(line, getRegex('foo/bar.py'), LinterId.MyPy, 1);

            expect(msg).to.deep.equal(expected);
        }
    });
    test('getRegex escapes filename correctly', () => {
        expect(getRegex('foo/bar.py')).to.eql(
            String.raw`foo/bar\.py:(?<line>\d+)(:(?<column>\d+))?: (?<type>\w+): (?<message>.*)\r?(\n|$)`,
        );
    });
});
