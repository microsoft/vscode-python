// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import * as path from 'path';
import { Uri } from 'vscode';
import { DebugConfigStrings } from '../../../../../client/common/utils/localize';
import { DebuggerTypeName } from '../../../../../client/debugger/constants';
import { PidAttachDebugConfigurationProvider } from '../../../../../client/debugger/extension/configuration/providers/pidAttach';

suite('Debugging - Configuration Provider File', () => {
    let provider: PidAttachDebugConfigurationProvider;
    setup(() => {
        provider = new PidAttachDebugConfigurationProvider();
    });
    test('Launch JSON with default process id', async () => {
        const folder = { uri: Uri.parse(path.join('one', 'two')), name: '1', index: 0 };
        const state = { config: {}, folder };

        await provider.buildConfiguration(undefined as any, state);

        const config = {
            name: DebugConfigStrings.attachPid.snippet.name(),
            type: DebuggerTypeName,
            request: 'attach',
            processId: '${command:pickProcess}',
            justMyCode: true,
        };

        expect(state.config).to.be.deep.equal(config);
    });
});
