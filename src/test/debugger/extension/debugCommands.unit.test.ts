// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import * as typemoq from 'typemoq';
import * as sinon from 'sinon';
import { Uri } from 'vscode';
import { IExtensionSingleActivationService } from '../../../client/activation/types';
import { ICommandManager, IDebugService } from '../../../client/common/application/types';
import { Commands } from '../../../client/common/constants';
import { IDisposableRegistry } from '../../../client/common/types';
import { DebugCommands } from '../../../client/debugger/extension/debugCommands';
import { EXTENSION_ROOT_DIR_FOR_TESTS } from '../../constants';
import * as telemetry from '../../../client/telemetry';

suite('Debugging - commands', () => {
    let commandManager: typemoq.IMock<ICommandManager>;
    let debugService: typemoq.IMock<IDebugService>;
    let disposables: typemoq.IMock<IDisposableRegistry>;
    let debugCommands: IExtensionSingleActivationService;

    setup(() => {
        commandManager = typemoq.Mock.ofType<ICommandManager>();
        debugService = typemoq.Mock.ofType<IDebugService>();

        disposables = typemoq.Mock.ofType<IDisposableRegistry>();
        sinon.stub(telemetry, 'sendTelemetryEvent').callsFake(() => {
            /** noop */
        });
    });
    teardown(() => {
        sinon.restore();
    });
    test('Test registering debug file command', async () => {
        commandManager
            .setup((c) => c.registerCommand(Commands.Debug_In_Terminal, typemoq.It.isAny()))
            .returns(() => ({
                dispose: () => {
                    /* noop */
                },
            }))
            .verifiable(typemoq.Times.once());

        debugCommands = new DebugCommands(commandManager.object, debugService.object, disposables.object);
        await debugCommands.activate();
        commandManager.verifyAll();
    });
    test('Test running debug file command', async () => {
        let callback: (f: Uri) => Promise<void> = (_f: Uri) => Promise.resolve();
        commandManager
            .setup((c) => c.registerCommand(Commands.Debug_In_Terminal, typemoq.It.isAny()))
            .callback((_name, cb) => {
                callback = cb;
            });
        debugService
            .setup((d) => d.startDebugging(undefined, typemoq.It.isAny()))
            .returns(() => Promise.resolve(true))
            .verifiable(typemoq.Times.once());

        debugCommands = new DebugCommands(commandManager.object, debugService.object, disposables.object);
        await debugCommands.activate();

        await callback(Uri.file(path.join(EXTENSION_ROOT_DIR_FOR_TESTS, 'test.py')));
        commandManager.verifyAll();
        debugService.verifyAll();
    });
});
