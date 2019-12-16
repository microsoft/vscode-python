// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import { instance, mock } from 'ts-mockito';
import { ApplicationShell } from '../../../../client/common/application/applicationShell';
import { CommandManager } from '../../../../client/common/application/commandManager';
import { IApplicationShell, ICommandManager } from '../../../../client/common/application/types';
import { PlatformService } from '../../../../client/common/platform/platformService';
import { IPlatformService } from '../../../../client/common/platform/types';
import { ProcessServiceFactory } from '../../../../client/common/process/processFactory';
import { IProcessServiceFactory } from '../../../../client/common/process/types';
import { IDisposableRegistry } from '../../../../client/common/types';
import { AttachProcessProviderFactory } from '../../../../client/debugger/extension/attachQuickPick/factory';
import { PsAttachProcessProvider } from '../../../../client/debugger/extension/attachQuickPick/psProvider';

suite('Attach to process - attach process provider factory', () => {
    let applicationShell: IApplicationShell;
    let commandManager: ICommandManager;
    let platformService: IPlatformService;
    let processServiceFactory: IProcessServiceFactory;
    let disposableRegistry: IDisposableRegistry;

    let factory: AttachProcessProviderFactory;

    setup(() => {
        applicationShell = mock(ApplicationShell);
        commandManager = mock(CommandManager);
        platformService = mock(PlatformService);
        processServiceFactory = mock(ProcessServiceFactory);
        disposableRegistry = [];

        factory = new AttachProcessProviderFactory(instance(applicationShell), instance(commandManager), instance(platformService), instance(processServiceFactory), disposableRegistry);
    });

    test('getProvider should return a PsAttachProcessProvider instance (until the PR that adds Windows support lands)', () => {
        const provider = factory.getProvider();

        expect(provider).to.be.instanceOf(PsAttachProcessProvider);
    });
});
