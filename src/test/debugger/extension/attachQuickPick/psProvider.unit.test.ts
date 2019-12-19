// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as assert from 'assert';
import { expect } from 'chai';
import { anything, instance, mock, verify, when } from 'ts-mockito';
import { Disposable } from 'vscode';
import { ApplicationShell } from '../../../../client/common/application/applicationShell';
import { CommandManager } from '../../../../client/common/application/commandManager';
import { IApplicationShell, ICommandManager } from '../../../../client/common/application/types';
import { Commands } from '../../../../client/common/constants';
import { PlatformService } from '../../../../client/common/platform/platformService';
import { IPlatformService } from '../../../../client/common/platform/types';
import { ProcessService } from '../../../../client/common/process/proc';
import { ProcessServiceFactory } from '../../../../client/common/process/processFactory';
import { IProcessService, IProcessServiceFactory } from '../../../../client/common/process/types';
import { IDisposableRegistry } from '../../../../client/common/types';
import { OSType } from '../../../../client/common/utils/platform';
import { PsProcessParser } from '../../../../client/debugger/extension/attachQuickPick/psProcessParser';
import { PsAttachProcessProvider } from '../../../../client/debugger/extension/attachQuickPick/psProvider';
import { IAttachItem } from '../../../../client/debugger/extension/attachQuickPick/types';

// tslint:disable-next-line: max-func-body-length
suite('Attach to process - ps process provider', () => {
    let applicationShell: IApplicationShell;
    let commandManager: ICommandManager;
    let platformService: IPlatformService;
    let processService: IProcessService;
    let processServiceFactory: IProcessServiceFactory;
    let disposableRegistry: IDisposableRegistry;
    let disposable: Disposable;

    let provider: PsAttachProcessProvider;

    const psOutput = `
    aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n\
    1 launchd                                            launchd\n\
   41 syslogd                                            syslogd\n\
  146 kextd                                              kextd\n\
31896 python                                             python script.py\n\
`;

    setup(() => {
        disposable = mock(Disposable);
        applicationShell = mock(ApplicationShell);

        commandManager = mock(CommandManager);
        when(commandManager.registerCommand(Commands.PickLocalProcess, anything(), anything())).thenReturn(instance(disposable));

        platformService = mock(PlatformService);

        processService = mock(ProcessService);
        when(processService.exec(anything(), anything(), anything())).thenResolve({ stdout: psOutput });
        processServiceFactory = mock(ProcessServiceFactory);
        when(processServiceFactory.create()).thenResolve(instance(processService));

        disposableRegistry = [];

        provider = new PsAttachProcessProvider(instance(applicationShell), instance(commandManager), disposableRegistry, instance(platformService), instance(processServiceFactory));
    });

    teardown(() => {
        (disposableRegistry as Disposable[]).forEach(d => d.dispose());
    });

    test('registerCommands() should register the show quick pick command', () => {
        provider.registerCommands();

        verify(commandManager.registerCommand(Commands.PickLocalProcess, anything(), anything())).once();
        assert.equal((disposableRegistry as Disposable[]).length, 1);
    });

    test('The Linux process list command should be called if the platform is Linux', async () => {
        when(platformService.isMac).thenReturn(false);
        when(platformService.isLinux).thenReturn(true);
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

        const attachItems = await provider._getInternalProcessEntries();

        verify(processService.exec(PsProcessParser.psLinuxCommand.command, PsProcessParser.psLinuxCommand.args, anything())).once();
        assert.deepEqual(attachItems, expectedOutput);

    });

    test('The macOS process list command should be called if the platform is macOS', async () => {
        when(platformService.isMac).thenReturn(true);
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

        const attachItems = await provider._getInternalProcessEntries();

        verify(processService.exec(PsProcessParser.psDarwinCommand.command, PsProcessParser.psDarwinCommand.args, anything())).once();
        assert.deepEqual(attachItems, expectedOutput);
    });

    test('An error should be thrown if the platform is neither Linux nor macOS', async () => {
        when(platformService.isMac).thenReturn(false);
        when(platformService.isLinux).thenReturn(false);
        when(platformService.osType).thenReturn(OSType.Unknown);

        const promise = provider._getInternalProcessEntries();

        await expect(promise).to.eventually.be.rejectedWith(`Operating system '${OSType.Unknown}' not supported.`);
    });
});
