// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any no-invalid-template-strings max-func-body-length

import { expect } from 'chai';
import * as path from 'path';
import { anything, instance, mock, verify, when } from 'ts-mockito';
import { Uri } from 'vscode';
import { DebugConfigStrings } from '../../../../../client/common/utils/localize';
import { MultiStepInput } from '../../../../../client/common/utils/multiStepInput';
import { DebuggerTypeName } from '../../../../../client/debugger/constants';
import { RemoteAttachDebugConfigurationProvider } from '../../../../../client/debugger/extension/configuration/providers/remoteAttach';
import { DebugConfigurationState } from '../../../../../client/debugger/extension/types';
import { AttachRequestArguments } from '../../../../../client/debugger/types';

suite('Debugging - Configuration Provider Remote Attach', () => {
    let provider: TestRemoteAttachDebugConfigurationProvider;
    let input: MultiStepInput<DebugConfigurationState>;
    class TestRemoteAttachDebugConfigurationProvider extends RemoteAttachDebugConfigurationProvider {
        // tslint:disable-next-line:no-unnecessary-override
        public async configurePort(
            i: MultiStepInput<DebugConfigurationState>,
            config: Partial<AttachRequestArguments>
        ) {
            return super.configurePort(i, config);
        }
    }
    setup(() => {
        input = mock<MultiStepInput<DebugConfigurationState>>(MultiStepInput);
        provider = new TestRemoteAttachDebugConfigurationProvider();
    });
    test('Configure port will display prompt', async () => {
        when(input.showInputBox(anything())).thenResolve();

        await provider.configurePort(instance(input), {});

        verify(input.showInputBox(anything())).once();
    });
    test('Configure port will default to 5678 if entered value is not a number', async () => {
        const config: { connect?: { port?: number } } = {};
        when(input.showInputBox(anything())).thenResolve('xyz');

        await provider.configurePort(instance(input), config);

        verify(input.showInputBox(anything())).once();
        expect(config).to.be.deep.equal({ connect: { port: 5678 } });
    });
    test('Configure port will default to 5678', async () => {
        const config: { connect?: { port?: number } } = {};
        when(input.showInputBox(anything())).thenResolve();

        await provider.configurePort(instance(input), config);

        verify(input.showInputBox(anything())).once();
        expect(config).to.be.deep.equal({ connect: { port: 5678 } });
    });
    test('Configure port will use user selected value', async () => {
        const config: { connect?: { port?: number } } = {};
        when(input.showInputBox(anything())).thenResolve('1234');

        await provider.configurePort(instance(input), config);

        verify(input.showInputBox(anything())).once();
        expect(config).to.be.deep.equal({ connect: { port: 1234 } });
    });
    test('Launch JSON with default host name', async () => {
        const folder = { uri: Uri.parse(path.join('one', 'two')), name: '1', index: 0 };
        const state = { config: {}, folder };
        let portConfigured = false;
        when(input.showInputBox(anything())).thenResolve();
        provider.configurePort = () => {
            portConfigured = true;
            return Promise.resolve();
        };

        const configurePort = await provider.buildConfiguration(instance(input), state);
        if (configurePort) {
            await configurePort!(input, state);
        }

        const config = {
            name: DebugConfigStrings.attach.snippet.name(),
            type: DebuggerTypeName,
            request: 'attach',
            connect: {
                host: 'localhost',
                port: 5678
            },
            pathMappings: [
                {
                    localRoot: '${workspaceFolder}',
                    remoteRoot: '.'
                }
            ]
        };

        expect(state.config).to.be.deep.equal(config);
        expect(portConfigured).to.be.equal(true, 'Port not configured');
    });
    test('Launch JSON with user defined host name', async () => {
        const folder = { uri: Uri.parse(path.join('one', 'two')), name: '1', index: 0 };
        const state = { config: {}, folder };
        let portConfigured = false;
        when(input.showInputBox(anything())).thenResolve('Hello');
        provider.configurePort = (_, cfg) => {
            portConfigured = true;
            cfg.connect!.port = 9999;
            return Promise.resolve();
        };

        const configurePort = await provider.buildConfiguration(instance(input), state);
        if (configurePort) {
            await configurePort(input, state);
        }

        const config = {
            name: DebugConfigStrings.attach.snippet.name(),
            type: DebuggerTypeName,
            request: 'attach',
            connect: {
                host: 'Hello',
                port: 9999
            },
            pathMappings: [
                {
                    localRoot: '${workspaceFolder}',
                    remoteRoot: '.'
                }
            ]
        };

        expect(state.config).to.be.deep.equal(config);
        expect(portConfigured).to.be.equal(true, 'Port not configured');
    });
});
