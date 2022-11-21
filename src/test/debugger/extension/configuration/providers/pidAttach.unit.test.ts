// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import * as path from 'path';
import { Uri } from 'vscode';
import { DebugConfigStrings } from '../../../../../client/common/utils/localize';
import { MultiStepInput } from '../../../../../client/common/utils/multiStepInput';
import { DebuggerTypeName } from '../../../../../client/debugger/constants';
import { buildPidAttachConfiguration } from '../../../../../client/debugger/extension/configuration/providers/pidAttach';
import { DebugConfigurationState } from '../../../../../client/debugger/extension/types';

suite('Debugging - Configuration Provider File', () => {
    test('Launch JSON with default process id', async () => {
        const folder = { uri: Uri.parse(path.join('one', 'two')), name: '1', index: 0 };
        const state = { config: {}, folder };

        await buildPidAttachConfiguration((undefined as unknown) as MultiStepInput<DebugConfigurationState>, state);

        const config = {
            name: DebugConfigStrings.attachPid.snippet.name,
            type: DebuggerTypeName,
            request: 'attach',
            processId: '${command:pickProcess}',
            justMyCode: true,
        };

        expect(state.config).to.be.deep.equal(config);
    });
});
