// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-object-literal-type-assertion

import { expect } from 'chai';
import { parseLine } from '../../client/linters/baseLinter';
import { REGEX } from '../../client/linters/mypy';
import { ILintMessage, LinterId } from '../../client/linters/types';

// This following is a real-world example. See gh=2380.
// tslint:disable-next-line:no-multiline-string
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
                    provider: 'mypy'
                } as ILintMessage
            ],
            [
                lines[2],
                {
                    code: undefined,
                    message: "Name 'not_declared_var' is not defined",
                    column: 0,
                    line: 11,
                    type: 'error',
                    provider: 'mypy'
                } as ILintMessage
            ],
            [
                lines[3],
                {
                    code: undefined,
                    message: 'Expression has type "Any"',
                    column: 21,
                    line: 12,
                    type: 'error',
                    provider: 'mypy'
                } as ILintMessage
            ]
        ];
        for (const [line, expected] of tests) {
            const msg = parseLine(line, REGEX, LinterId.MyPy);

            expect(msg).to.deep.equal(expected);
        }
    });
});
