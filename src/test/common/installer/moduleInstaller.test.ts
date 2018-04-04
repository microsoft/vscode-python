// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as path from 'path';
import * as TypeMoq from 'typemoq';
import { Disposable} from 'vscode';
import { CondaInstaller } from '../../../client/common/installer/condaInstaller';
import { PipInstaller } from '../../../client/common/installer/pipInstaller';
import { IInstallationChannelManager, IModuleInstaller } from '../../../client/common/installer/types';
import { ITerminalService, ITerminalServiceFactory } from '../../../client/common/terminal/types';
import { IConfigurationService, IDisposableRegistry, IPythonSettings } from '../../../client/common/types';
import { ICondaService, IInterpreterService } from '../../../client/interpreter/contracts';
import { IServiceContainer } from '../../../client/ioc/types';
import { initialize } from '../../initialize';

// tslint:disable-next-line:max-func-body-length
suite('Module Installer', () => {
    const pythonPath = path.join(__dirname, 'python');
    suiteSetup(initialize);
    [CondaInstaller, PipInstaller].forEach(installerClass => {
        let disposables: Disposable[] = [];
        let installer: IModuleInstaller;
        let installationChannel: TypeMoq.IMock<IInstallationChannelManager>;
        let serviceContainer: TypeMoq.IMock<IServiceContainer>;
        let terminalService: TypeMoq.IMock<ITerminalService>;
        let pythonSettings: TypeMoq.IMock<IPythonSettings>;
        let interpreterService: TypeMoq.IMock<IInterpreterService>;
        setup(() => {
            serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();

            disposables = [];
            serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IDisposableRegistry), TypeMoq.It.isAny())).returns(() => disposables);

            installationChannel = TypeMoq.Mock.ofType<IInstallationChannelManager>();
            serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IInstallationChannelManager), TypeMoq.It.isAny())).returns(() => installationChannel.object);

            const condaService = TypeMoq.Mock.ofType<ICondaService>();
            condaService.setup(c => c.getCondaFile()).returns(() => Promise.resolve('conda'));
            condaService.setup(c => c.getCondaEnvironment(TypeMoq.It.isAny())).returns(() => Promise.resolve(undefined));

            const configService = TypeMoq.Mock.ofType<IConfigurationService>();
            serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IConfigurationService), TypeMoq.It.isAny())).returns(() => configService);
            pythonSettings = TypeMoq.Mock.ofType<IPythonSettings>();
            pythonSettings.setup(p => p.pythonPath).returns(() => pythonPath);
            configService.setup(c => c.getSettings(TypeMoq.It.isAny())).returns(() => pythonSettings.object);

            terminalService = TypeMoq.Mock.ofType<ITerminalService>();
            const terminalServiceFactory = TypeMoq.Mock.ofType<ITerminalServiceFactory>();
            terminalServiceFactory.setup(f => f.getTerminalService(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => terminalService.object);
            serviceContainer.setup(c => c.get(TypeMoq.It.isValue(ITerminalServiceFactory), TypeMoq.It.isAny())).returns(() => terminalServiceFactory.object);

            interpreterService = TypeMoq.Mock.ofType<IInterpreterService>();
            serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IInterpreterService), TypeMoq.It.isAny())).returns(() => interpreterService.object);

            installer = new installerClass(serviceContainer.object);
        });
        teardown(() => {
            disposables.forEach(disposable => {
                if (disposable) {
                    disposable.dispose();
                }
            });
        });
        test(`Ensure getActiveInterperter is used (${installerClass.name})`, async () => {
            if (installer.displayName !== 'Pip') {
                return;
            }
            interpreterService.setup(i => i.getActiveInterpreter(TypeMoq.It.isAny())).returns(() => Promise.resolve(undefined)).verifiable();
            try {
                await installer.installModule('xyz');
                // tslint:disable-next-line:no-empty
            } catch { }
            interpreterService.verifyAll();
        });
    });
});
