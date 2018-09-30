// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:max-func-body-length

import { SemVer } from 'semver';
import * as TypeMoq from 'typemoq';
import {
    ExtensionActivationService
} from '../../client/activation/activationService';
import {
    FolderVersionPair, IExtensionActivator, ILanguageServerFolderService
} from '../../client/activation/types';
import {
    IApplicationShell, IWorkspaceService
} from '../../client/common/application/types';
import { IPlatformInfo, IPlatformService } from '../../client/common/platform/types';
import {
    IDisposableRegistry, ILogger, IOutputChannel
} from '../../client/common/types';
import { IServiceContainer } from '../../client/ioc/types';
import { OSDistro, OSType } from '../../utils/platform';

suite('ActivationService - Microsoft Python language service', () => {

    function setupMocks(): [
        TypeMoq.IMock<IServiceContainer>,
        TypeMoq.IMock<ILanguageServerFolderService>,
        TypeMoq.IMock<IOutputChannel>,
        TypeMoq.IMock<ILogger>
    ] {
        const serviceContainerMock = TypeMoq.Mock.ofType<IServiceContainer>();

        const workspaceServiceMock = TypeMoq.Mock.ofType<IWorkspaceService>();
        workspaceServiceMock.setup(w => w.workspaceFolders).returns(() => []);

        serviceContainerMock.setup(scm => scm.get(
            TypeMoq.It.isValue(IWorkspaceService),
            TypeMoq.It.isAny())
        ).returns(() => workspaceServiceMock.object);

        const platformInfoMock = TypeMoq.Mock.ofType<IPlatformInfo>();
        platformInfoMock.setup(pim => pim.type).returns(() => OSType.Windows);
        platformInfoMock.setup(pim => pim.version).returns(() => new SemVer('10.0.0'));
        platformInfoMock.setup(pim => pim.distro).returns(() => OSDistro.Unknown);

        const platformServiceMock = TypeMoq.Mock.ofType<IPlatformService>();
        platformServiceMock.setup(psm => psm.info).returns(() => platformInfoMock.object);
        serviceContainerMock.setup(scm => scm.get(
            TypeMoq.It.isValue(IPlatformService),
            TypeMoq.It.isAny())
        ).returns(() => platformServiceMock.object);

        const outputMock = TypeMoq.Mock.ofType<IOutputChannel>();
        serviceContainerMock.setup(scm => scm.get(
            TypeMoq.It.isValue(IOutputChannel),
            TypeMoq.It.isAny())
        ).returns(() => outputMock.object);

        const loggerMock = TypeMoq.Mock.ofType<ILogger>();
        serviceContainerMock.setup(scm => scm.get(
            TypeMoq.It.isValue(ILogger),
            TypeMoq.It.isAny())
        ).returns(() => loggerMock.object);

        const appShellMock = TypeMoq.Mock.ofType<IApplicationShell>();
        serviceContainerMock.setup(scm => scm.get(
            TypeMoq.It.isValue(IApplicationShell),
            TypeMoq.It.isAny())
        ).returns(() => appShellMock.object);

        const disposableRegistryMock = TypeMoq.Mock.ofType<IDisposableRegistry>();
        serviceContainerMock.setup(scm => scm.get(
            TypeMoq.It.isValue(IDisposableRegistry),
            TypeMoq.It.isAny())
        ).returns(() => disposableRegistryMock.object);

        const extensionActivatorMock = TypeMoq.Mock.ofType<IExtensionActivator>();
        extensionActivatorMock.setup(eam => eam.activate())
            .returns(() => Promise.resolve(true));
        serviceContainerMock.setup(scm => scm.get(
            TypeMoq.It.isValue(IExtensionActivator),
            TypeMoq.It.isAny())
        ).returns(() => extensionActivatorMock.object);

        const langFolderServiceMock = TypeMoq.Mock.ofType<ILanguageServerFolderService>();
        serviceContainerMock.setup(scm => scm.get(
            TypeMoq.It.isValue(ILanguageServerFolderService),
            TypeMoq.It.isAny())
        ).returns(() => langFolderServiceMock.object);

        return [serviceContainerMock, langFolderServiceMock, outputMock, loggerMock];
    }

    test('MPLS issues the version correctly when it is present', async () => {
        // Set expectations:
        const testVer: string = '1.2.3';
        const testSemVer: SemVer = new SemVer(testVer);
        const expectedString: string = `Starting Microsoft Python language server (${testVer}).`;

        // Arrange/setup mocks:
        const [serviceContainerMock, langFolderServiceMock, outputMock] = setupMocks();
        langFolderServiceMock.setup(lfsm => lfsm.getCurrentLanguageServerDirectory())
            .returns(() => {
                const mplsFolderVer: FolderVersionPair = {
                    path: '',
                    version: testSemVer
                };
                return Promise.resolve(mplsFolderVer);
            });
        outputMock.setup(om => om.appendLine(TypeMoq.It.isValue(expectedString)))
            .verifiable(TypeMoq.Times.once());

        // Verify: ensure we actually logged the expected line.
        const activationServiceMock = new ExtensionActivationService(serviceContainerMock.object);
        await activationServiceMock.activate();
        outputMock.verifyAll();
    });

    test('MPLS issues no version correctly when it is not present', async () => {
        // Set expectations:
        const expectedString: string = 'Starting Microsoft Python language server.';

        // Arrange/setup mocks:
        const [serviceContainerMock, langFolderServiceMock, outputMock] = setupMocks();
        langFolderServiceMock.setup(lfsm => lfsm.getCurrentLanguageServerDirectory())
            .returns(() => Promise.resolve(undefined));
        outputMock.setup(om => om.appendLine(TypeMoq.It.isValue(expectedString)))
            .verifiable(TypeMoq.Times.once());

        // Verify: ensure we actually logged the expected line.
        const activationService = new ExtensionActivationService(serviceContainerMock.object);
        await activationService.activate();
        outputMock.verifyAll();
    });

    test('Does not throw when errors occur getting the current MPLS version', async () => {
        // Set expectations:
        const expectedString: string = 'Starting Microsoft Python language server.';
        const expectedLogMsg: string = 'Failed to obtain current MPLS version during activation.';

        // Arrange/setup mocks:
        const [serviceContainerMock, langFolderServiceMock, outputMock, loggerMock] = setupMocks();
        langFolderServiceMock.setup(lfsm => lfsm.getCurrentLanguageServerDirectory())
            .returns(() =>
                Promise.reject('Test for handling unknown errors.')
            );
        loggerMock.setup(lm => lm.logInformation(
            TypeMoq.It.isValue(expectedLogMsg),
            TypeMoq.It.isAny()
        )).verifiable(TypeMoq.Times.once());
        outputMock.setup(om => om.appendLine(TypeMoq.It.isValue(expectedString)))
            .verifiable(TypeMoq.Times.once());

        // Verify: ensure we actually logged the expected line.
        const activationService = new ExtensionActivationService(serviceContainerMock.object);
        await activationService.activate();
        outputMock.verifyAll();
        loggerMock.verifyAll();
    });

});
