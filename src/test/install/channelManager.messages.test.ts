// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import { Container } from 'inversify';
import { SemVer } from 'semver';
import * as TypeMoq from 'typemoq';
import { IApplicationShell } from '../../client/common/application/types';
import { InstallationChannelManager } from '../../client/common/installer/channelManager';
import { IModuleInstaller } from '../../client/common/installer/types';
import { IPlatformService } from '../../client/common/platform/types';
import { Product } from '../../client/common/types';
import { Architecture } from '../../client/common/utils/platform';
import {
    IInterpreterAutoSelectionService,
    IInterpreterAutoSeletionProxyService
} from '../../client/interpreter/autoSelection/types';
import { IInterpreterService } from '../../client/interpreter/contracts';
import { ServiceContainer } from '../../client/ioc/container';
import { ServiceManager } from '../../client/ioc/serviceManager';
import { IServiceContainer } from '../../client/ioc/types';
import { InterpreterType, PythonInterpreter } from '../../client/pythonEnvironments/discovery/types';
import { MockAutoSelectionService } from '../mocks/autoSelector';

const info: PythonInterpreter = {
    architecture: Architecture.Unknown,
    companyDisplayName: '',
    displayName: '',
    envName: '',
    path: '',
    type: InterpreterType.Unknown,
    version: new SemVer('0.0.0-alpha'),
    sysPrefix: '',
    sysVersion: ''
};

// tslint:disable-next-line:max-func-body-length
suite('Installation - channel messages', () => {
    let serviceContainer: IServiceContainer;
    let platform: TypeMoq.IMock<IPlatformService>;
    let appShell: TypeMoq.IMock<IApplicationShell>;
    let interpreters: TypeMoq.IMock<IInterpreterService>;

    setup(() => {
        const cont = new Container();
        const serviceManager = new ServiceManager(cont);
        serviceContainer = new ServiceContainer(cont);

        platform = TypeMoq.Mock.ofType<IPlatformService>();
        serviceManager.addSingletonInstance<IPlatformService>(IPlatformService, platform.object);

        appShell = TypeMoq.Mock.ofType<IApplicationShell>();
        serviceManager.addSingletonInstance<IApplicationShell>(IApplicationShell, appShell.object);

        interpreters = TypeMoq.Mock.ofType<IInterpreterService>();
        serviceManager.addSingletonInstance<IInterpreterService>(IInterpreterService, interpreters.object);

        const moduleInstaller = TypeMoq.Mock.ofType<IModuleInstaller>();
        serviceManager.addSingletonInstance<IModuleInstaller>(IModuleInstaller, moduleInstaller.object);
        serviceManager.addSingleton<IInterpreterAutoSelectionService>(
            IInterpreterAutoSelectionService,
            MockAutoSelectionService
        );
        serviceManager.addSingleton<IInterpreterAutoSeletionProxyService>(
            IInterpreterAutoSeletionProxyService,
            MockAutoSelectionService
        );
    });

    test('No installers message: Unknown/Windows', async () => {
        platform.setup((x) => x.isWindows).returns(() => true);
        await testInstallerMissingMessage(InterpreterType.Unknown, async (message: string, url: string) => {
            verifyMessage(message, ['Pip'], ['Conda']);
            verifyUrl(url, ['Windows', 'Pip']);
        });
    });

    test('No installers message: Conda/Windows', async () => {
        platform.setup((x) => x.isWindows).returns(() => true);
        await testInstallerMissingMessage(InterpreterType.Conda, async (message: string, url: string) => {
            verifyMessage(message, ['Pip', 'Conda'], []);
            verifyUrl(url, ['Windows', 'Pip', 'Conda']);
        });
    });

    test('No installers message: Unknown/Mac', async () => {
        platform.setup((x) => x.isWindows).returns(() => false);
        platform.setup((x) => x.isMac).returns(() => true);
        await testInstallerMissingMessage(InterpreterType.Unknown, async (message: string, url: string) => {
            verifyMessage(message, ['Pip'], ['Conda']);
            verifyUrl(url, ['Mac', 'Pip']);
        });
    });

    test('No installers message: Conda/Mac', async () => {
        platform.setup((x) => x.isWindows).returns(() => false);
        platform.setup((x) => x.isMac).returns(() => true);
        await testInstallerMissingMessage(InterpreterType.Conda, async (message: string, url: string) => {
            verifyMessage(message, ['Pip', 'Conda'], []);
            verifyUrl(url, ['Mac', 'Pip', 'Conda']);
        });
    });

    test('No installers message: Unknown/Linux', async () => {
        platform.setup((x) => x.isWindows).returns(() => false);
        platform.setup((x) => x.isMac).returns(() => false);
        platform.setup((x) => x.isLinux).returns(() => true);
        await testInstallerMissingMessage(InterpreterType.Unknown, async (message: string, url: string) => {
            verifyMessage(message, ['Pip'], ['Conda']);
            verifyUrl(url, ['Linux', 'Pip']);
        });
    });

    test('No installers message: Conda/Linux', async () => {
        platform.setup((x) => x.isWindows).returns(() => false);
        platform.setup((x) => x.isMac).returns(() => false);
        platform.setup((x) => x.isLinux).returns(() => true);
        await testInstallerMissingMessage(InterpreterType.Conda, async (message: string, url: string) => {
            verifyMessage(message, ['Pip', 'Conda'], []);
            verifyUrl(url, ['Linux', 'Pip', 'Conda']);
        });
    });

    test('No channels message', async () => {
        platform.setup((x) => x.isWindows).returns(() => true);
        await testInstallerMissingMessage(
            InterpreterType.Unknown,
            async (message: string, url: string) => {
                verifyMessage(message, ['Pip'], ['Conda']);
                verifyUrl(url, ['Windows', 'Pip']);
            },
            'getInstallationChannel'
        );
    });

    function verifyMessage(message: string, present: string[], missing: string[]) {
        for (const p of present) {
            assert.equal(message.indexOf(p) >= 0, true, `Message does not contain ${p}.`);
        }
        for (const m of missing) {
            assert.equal(message.indexOf(m) < 0, true, `Message incorrectly contains ${m}.`);
        }
    }

    function verifyUrl(url: string, terms: string[]) {
        assert.equal(url.indexOf('https://') >= 0, true, 'Search Url must be https.');
        for (const term of terms) {
            assert.equal(url.indexOf(term) >= 0, true, `Search Url does not contain ${term}.`);
        }
    }

    async function testInstallerMissingMessage(
        interpreterType: InterpreterType,
        verify: (m: string, u: string) => Promise<void>,
        methodType: 'showNoInstallersMessage' | 'getInstallationChannel' = 'showNoInstallersMessage'
    ): Promise<void> {
        const activeInterpreter: PythonInterpreter = {
            ...info,
            type: interpreterType,
            path: ''
        };
        interpreters
            .setup((x) => x.getActiveInterpreter(TypeMoq.It.isAny()))
            .returns(
                () => new Promise<PythonInterpreter>((resolve, _reject) => resolve(activeInterpreter))
            );
        const channels = new InstallationChannelManager(serviceContainer);

        let url: string = '';
        let message: string = '';
        let search: string = '';
        appShell
            .setup((x) => x.showErrorMessage(TypeMoq.It.isAnyString(), TypeMoq.It.isAnyString()))
            .callback((m: string, s: string) => {
                message = m;
                search = s;
            })
            .returns(
                () => new Promise<string>((resolve, _reject) => resolve(search))
            );
        appShell
            .setup((x) => x.openUrl(TypeMoq.It.isAnyString()))
            .callback((s: string) => {
                url = s;
            });
        if (methodType === 'showNoInstallersMessage') {
            await channels.showNoInstallersMessage();
        } else {
            await channels.getInstallationChannel(Product.pylint);
        }
        await verify(message, url);
    }
});
