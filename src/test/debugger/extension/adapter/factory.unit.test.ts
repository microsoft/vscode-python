// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as assert from 'assert';
import { expect, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as path from 'path';
import { instance, mock } from 'ts-mockito';
import { DebugAdapterExecutable, DebugConfiguration, WorkspaceFolder } from 'vscode';
import { ApplicationShell } from '../../../../client/common/application/applicationShell';
import { IApplicationShell } from '../../../../client/common/application/types';
import { EXTENSION_ROOT_DIR } from '../../../../client/constants';
import { DebugAdapterDescriptorFactory } from '../../../../client/debugger/extension/adapter/factory';
import { IInterpreterService } from '../../../../client/interpreter/contracts';
import { InterpreterService } from '../../../../client/interpreter/interpreterService';
use(chaiAsPromised);

const pathToScript = path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'lib', 'python', 'ptvsd', 'adapter');

suite('xDebugging - Adapter Factory', () => {
    let factory: DebugAdapterDescriptorFactory;
    let interpreterService: IInterpreterService;
    let appShell: IApplicationShell;
    const nodeExecutable = { command: 'node', args: [] };
    setup(() => {
        interpreterService = mock(InterpreterService);
        appShell = mock(ApplicationShell);
        factory = new DebugAdapterDescriptorFactory(instance(interpreterService), instance(appShell));
    });
    function createSession(config: Partial<DebugConfiguration>, workspaceFolder?: WorkspaceFolder) {
        return {
            configuration: { name: '', request: 'launch', type: 'python', ...config },
            id: '',
            name: 'python',
            type: 'python',
            workspaceFolder,
            // tslint:disable-next-line: no-any
            customRequest: () => Promise.resolve()
        };
    }
    test('Return old node debugger (when not an experiment)', async () => {
        const session = createSession({});
        const descriptor = await factory.createDebugAdapterDescriptor(session, nodeExecutable);

        assert.deepEqual(descriptor, nodeExecutable);
    });
    test('Return old node debugger (when experiment=false)', async () => {
        const session = createSession({ experiment: false });
        const descriptor = await factory.createDebugAdapterDescriptor(session, nodeExecutable);

        assert.deepEqual(descriptor, nodeExecutable);
    });
    test('Throw an error if the executable has not been defined', async () => {
        const session = createSession({});
        const promise = factory.createDebugAdapterDescriptor(session, undefined).catch();

        await expect(promise).to.eventually.be.rejectedWith('Debug Adapter Executable not provided');
    });
    test('Return Python DA executable when experiment=true in launch.json', async () => {
        const pythonPath = 'python.exe';
        const expectedExecutable = new DebugAdapterExecutable(pythonPath, [pathToScript]);

        const session = createSession({ pythonPath: pythonPath, experiment: true });
        const descriptor = await factory.createDebugAdapterDescriptor(session, nodeExecutable);

        assert.deepEqual(descriptor, expectedExecutable);
    });
    test('Return Python DA executable with logging enabled, when experiment=true in launch.json', async () => {
        const pythonPath = 'python.exe';
        const expectedExecutable = new DebugAdapterExecutable(pythonPath, [pathToScript, '--log-dir', EXTENSION_ROOT_DIR]);

        const session = createSession({ pythonPath: pythonPath, experiment: true, logToFile: true });
        const descriptor = await factory.createDebugAdapterDescriptor(session, nodeExecutable);

        assert.deepEqual(descriptor, expectedExecutable);
    });
});
