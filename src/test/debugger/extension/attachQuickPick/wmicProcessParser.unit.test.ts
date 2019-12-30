// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as assert from 'assert';
import { IAttachItem } from '../../../../client/debugger/extension/attachQuickPick/types';
import { WmicProcessParser } from '../../../../client/debugger/extension/attachQuickPick/wmicProcessParser';

// tslint:disable-next-line: max-func-body-length
suite('Attach to process - wmic process parser (Windows)', () => {
    test('Processes should be parsed correctly if it is valid input', () => {
        const input = `\
      TODO \
`;
        const expectedOutput: IAttachItem[] = [
            {
                label: 'launchd',
                description: '1',
                detail: 'launchd',
                id: '1'
            },
            {
                label: 'syslogd',
                description: '41',
                detail: 'syslogd',
                id: '41'
            },
            {
                label: 'UserEventAgent',
                description: '42',
                detail: 'UserEventAgent (System)',
                id: '42'
            },
            {
                label: 'uninstalld',
                description: '45',
                detail: 'uninstalld',
                id: '45'
            },
            {
                label: 'kextd',
                description: '146',
                detail: 'kextd',
                id: '146'
            },
            {
                label: 'python',
                description: '31896',
                detail: 'python script.py',
                id: '31896'
            }
        ];

        const output = WmicProcessParser.parseProcesses(input);

        assert.deepEqual(output, expectedOutput);
    });

    test('Empty lines should be skipped when parsing process list input', () => {
        const input = `\
        TODO \
`;
        const expectedOutput: IAttachItem[] = [
            {
                label: 'launchd',
                description: '1',
                detail: 'launchd',
                id: '1'
            },
            {
                label: 'syslogd',
                description: '41',
                detail: 'syslogd',
                id: '41'
            },
            {
                label: 'UserEventAgent',
                description: '42',
                detail: 'UserEventAgent (System)',
                id: '42'
            },
            {
                label: 'kextd',
                description: '146',
                detail: 'kextd',
                id: '146'
            },
            {
                label: 'python',
                description: '31896',
                detail: 'python script.py',
                id: '31896'
            }
        ];

        const output = WmicProcessParser.parseProcesses(input);

        assert.deepEqual(output, expectedOutput);
    });

    test('Incorrectly formatted lines should be skipped when parsing process list input', () => {
        const input = `\
        TODO\
`;
        const expectedOutput: IAttachItem[] = [
            {
                label: 'launchd',
                description: '1',
                detail: 'launchd',
                id: '1'
            },
            {
                label: 'syslogd',
                description: '41',
                detail: 'syslogd',
                id: '41'
            },
            {
                label: 'UserEventAgent',
                description: '42',
                detail: 'UserEventAgent (System)',
                id: '42'
            },
            {
                label: 'kextd',
                description: '146',
                detail: 'kextd',
                id: '146'
            },
            {
                label: 'python',
                description: '31896',
                detail: 'python script.py',
                id: '31896'
            }
        ];

        const output = WmicProcessParser.parseProcesses(input);

        assert.deepEqual(output, expectedOutput);
    });
});
