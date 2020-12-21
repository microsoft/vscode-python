// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any no-invalid-template-strings max-func-body-length

import { expect } from 'chai';
import * as path from 'path';
import { anything, instance, mock, when } from 'ts-mockito';
import { Uri } from 'vscode';
import { DebugConfigStrings } from '../../../../../client/common/utils/localize';
import { MultiStepInput } from '../../../../../client/common/utils/multiStepInput';
import { DebuggerTypeName } from '../../../../../client/debugger/constants';
import { ModuleLaunchDebugConfigurationProvider } from '../../../../../client/debugger/extension/configuration/providers/moduleLaunch';
import { DebugConfigurationState } from '../../../../../client/debugger/extension/types';

suite('Debugging - Configuration Provider Module', () => {
    let provider: ModuleLaunchDebugConfigurationProvider;
    setup(() => {
        provider = new ModuleLaunchDebugConfigurationProvider();
    });
    test('Launch JSON with default module name', async () => {
        const folder = { uri: Uri.parse(path.join('one', 'two')), name: '1', index: 0 };
        const state = { config: {}, folder };
        const input = mock<MultiStepInput<DebugConfigurationState>>(MultiStepInput);

        when(input.showInputBox(anything())).thenResolve();

        await provider.buildConfiguration(instance(input), state);

        const config = {
            name: DebugConfigStrings.module.snippet.name(),
            type: DebuggerTypeName,
            request: 'launch',
            module: DebugConfigStrings.module.snippet.default(),
        };

        expect(state.config).to.be.deep.equal(config);
    });
    test('Launch JSON with selected module name', async () => {
        const folder = { uri: Uri.parse(path.join('one', 'two')), name: '1', index: 0 };
        const state = { config: {}, folder };
        const input = mock<MultiStepInput<DebugConfigurationState>>(MultiStepInput);

        when(input.showInputBox(anything())).thenResolve('hello');

        await provider.buildConfiguration(instance(input), state);

        const config = {
            name: DebugConfigStrings.module.snippet.name(),
            type: DebuggerTypeName,
            request: 'launch',
            module: 'hello',
        };

        expect(state.config).to.be.deep.equal(config);
    });
});
