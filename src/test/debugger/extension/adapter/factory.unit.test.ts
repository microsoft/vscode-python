// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as assert from 'assert';
import { expect, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as path from 'path';
import { anything, instance, mock, when } from 'ts-mockito';
import { DebugConfiguration, WorkspaceFolder } from 'vscode';
import { ApplicationShell } from '../../../../client/common/application/applicationShell';
import { IApplicationShell } from '../../../../client/common/application/types';
import { DebugAdapterPtvsdGroups } from '../../../../client/common/experimentGroups';
import { ExperimentsManager } from '../../../../client/common/experiments';
import { IExperimentsManager } from '../../../../client/common/types';
import { Architecture } from '../../../../client/common/utils/platform';
import { DebugAdapterDescriptorFactory } from '../../../../client/debugger/extension/adapter/factory';
import { IInterpreterService, InterpreterType, PythonInterpreter } from '../../../../client/interpreter/contracts';
import { InterpreterService } from '../../../../client/interpreter/interpreterService';
use(chaiAsPromised);

suite('Debugging - Adapter Factory', () => {
    let factory: DebugAdapterDescriptorFactory;
    let interpreterService: IInterpreterService;
    let appShell: IApplicationShell;
    let experimentsManager: IExperimentsManager;
    const nodeExecutable = { command: 'node', args: [] };
    setup(() => {
        interpreterService = mock(InterpreterService);
        const interpreter: PythonInterpreter = {
            path: path.join('path', 'to', 'interpreter'),
            sysVersion: '',
            sysPrefix: '',
            architecture: Architecture.Unknown,
            type: InterpreterType.Unknown
        };
        when(interpreterService.getInterpreters(anything())).thenResolve([interpreter]);
        appShell = mock(ApplicationShell);
        appShell = mock(ApplicationShell);
        experimentsManager = mock(ExperimentsManager);
        factory = new DebugAdapterDescriptorFactory(instance(interpreterService), instance(appShell), instance(experimentsManager));
    });
    function createSession(config: Partial<DebugConfiguration>, workspaceFolder?: WorkspaceFolder) {
        return {
            configuration: { name: '', request: 'launch', type: 'python', ...config },
            id: '',
            name: 'python',
            type: 'python',
            workspaceFolder,
            customRequest: () => Promise.resolve()
        };
    }
    test('Return old node debugger (when not in an experiment)', async () => {
        const session = createSession({});
        const descriptor = await factory.createDebugAdapterDescriptor(session, nodeExecutable);

        assert.deepEqual(descriptor, nodeExecutable);
    });
    test('Return old node debugger (when in the experiment)', async () => {
        // will be updated when we support the new debug adapter
        const session = createSession({ experiment: false });
        when(experimentsManager.inExperiment(DebugAdapterPtvsdGroups.experiment)).thenReturn(true);
        const descriptor = await factory.createDebugAdapterDescriptor(session, nodeExecutable);

        assert.deepEqual(descriptor, nodeExecutable);
    });
    test('Throw an error if the executable has not been defined', async () => {
        const session = createSession({});
        const promise = factory.createDebugAdapterDescriptor(session, undefined).catch();

        await expect(promise).to.eventually.be.rejectedWith('Debug Adapter Executable not provided');
    });
});
