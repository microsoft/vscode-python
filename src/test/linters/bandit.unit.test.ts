// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import { parseLine } from '../../client/linters/baseLinter';
import { BANDIT_REGEX } from '../../client/linters/bandit';

import { ILintMessage, LinterId } from '../../client/linters/types';

suite('Linting - Bandit', () => {
    test('parsing new bandit with col', () => {
        const newOutput = `\
1,0,LOW,B404:Consider possible security implications associated with subprocess module.
19,4,HIGH,B602:subprocess call with shell=True identified, security issue.
`;

        const lines = newOutput.split('\n');
        const tests: [string, ILintMessage | undefined][] = [
            [
                lines[0],
                {
                    code: 'B404',
                    message: 'Consider possible security implications associated with subprocess module.',
                    column: 0,
                    line: 1,
                    type: 'LOW',
                    provider: 'bandit',
                },
            ],
            [
                lines[1],
                {
                    code: 'B602',
                    message: 'subprocess call with shell=True identified, security issue.',
                    column: 3,
                    line: 19,
                    type: 'HIGH',
                    provider: 'bandit',
                },
            ],
        ];
        for (const [line, expected] of tests) {
            const msg = parseLine(line, BANDIT_REGEX, LinterId.Bandit, 1);

            expect(msg).to.deep.equal(expected);
        }
    });
    test('parsing old bandit with no col', () => {
        const newOutput = `\
1,col,LOW,B404:Consider possible security implications associated with subprocess module.
19,col,HIGH,B602:subprocess call with shell=True identified, security issue.
`;

        const lines = newOutput.split('\n');
        const tests: [string, ILintMessage | undefined][] = [
            [
                lines[0],
                {
                    code: 'B404',
                    message: 'Consider possible security implications associated with subprocess module.',
                    column: 0,
                    line: 1,
                    type: 'LOW',
                    provider: 'bandit',
                },
            ],
            [
                lines[1],
                {
                    code: 'B602',
                    message: 'subprocess call with shell=True identified, security issue.',
                    column: 0,
                    line: 19,
                    type: 'HIGH',
                    provider: 'bandit',
                },
            ],
        ];
        for (const [line, expected] of tests) {
            const msg = parseLine(line, BANDIT_REGEX, LinterId.Bandit, 1);

            expect(msg).to.deep.equal(expected);
        }
    });
});
