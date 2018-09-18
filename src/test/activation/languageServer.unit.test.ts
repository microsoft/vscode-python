// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:max-func-body-length

import { expect } from 'chai';
import * as path from 'path';
import * as TypeMoq from 'typemoq';
import { LanguageServerExtensionActivator } from '../../client/activation/languageServer';
import { IApplicationShell, ICommandManager, IWorkspaceService } from '../../client/common/application/types';
import { IPlatformService } from '../../client/common/platform/types';
import { IConfigurationService, IDisposableRegistry, IExtensionContext, IFeatureDeprecationManager, IOutputChannel, IPathUtils, IPythonSettings } from '../../client/common/types';
import { IEnvironmentVariablesProvider } from '../../client/common/variables/types';
import { IServiceContainer } from '../../client/ioc/types';

suite('Language Server', () => {
    let serviceContainer: TypeMoq.IMock<IServiceContainer>;
    let pythonSettings: TypeMoq.IMock<IPythonSettings>;
    let appShell: TypeMoq.IMock<IApplicationShell>;
    let cmdManager: TypeMoq.IMock<ICommandManager>;
    let workspaceService: TypeMoq.IMock<IWorkspaceService>;
    let platformService: TypeMoq.IMock<IPlatformService>;
    let languageServer: LanguageServerExtensionActivator;
    let extensionContext: TypeMoq.IMock<IExtensionContext>;
    setup(() => {
        serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
        extensionContext = TypeMoq.Mock.ofType<IExtensionContext>();
        appShell = TypeMoq.Mock.ofType<IApplicationShell>();
        workspaceService = TypeMoq.Mock.ofType<IWorkspaceService>();
        cmdManager = TypeMoq.Mock.ofType<ICommandManager>();
        platformService = TypeMoq.Mock.ofType<IPlatformService>();
        const configService = TypeMoq.Mock.ofType<IConfigurationService>();
        pythonSettings = TypeMoq.Mock.ofType<IPythonSettings>();

        workspaceService.setup(w => w.hasWorkspaceFolders).returns(() => false);
        workspaceService.setup(w => w.workspaceFolders).returns(() => []);
        configService.setup(c => c.getSettings(TypeMoq.It.isAny())).returns(() => pythonSettings.object);

        const output = TypeMoq.Mock.ofType<IOutputChannel>();
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IOutputChannel), TypeMoq.It.isAny())).returns(() => output.object);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IWorkspaceService))).returns(() => workspaceService.object);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IApplicationShell))).returns(() => appShell.object);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IDisposableRegistry))).returns(() => []);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IConfigurationService))).returns(() => configService.object);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(ICommandManager))).returns(() => cmdManager.object);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IPlatformService))).returns(() => platformService.object);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IExtensionContext))).returns(() => extensionContext.object);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IFeatureDeprecationManager))).returns(() => TypeMoq.Mock.ofType<IFeatureDeprecationManager>().object);

        languageServer = new LanguageServerExtensionActivator(serviceContainer.object);
    });

    test('Must get PYTHONPATH from env vars provider', async () => {
        const pathDelimiter = 'x';
        const pythonPathVar = ['A', 'B', '1'];
        const envVarsProvider = TypeMoq.Mock.ofType<IEnvironmentVariablesProvider>();
        const pathUtils = TypeMoq.Mock.ofType<IPathUtils>();
        extensionContext.setup(e => e.extensionPath).returns(() => path.join('a', 'b', 'c'));
        pathUtils.setup(p => p.delimiter).returns(() => pathDelimiter);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IEnvironmentVariablesProvider))).returns(() => envVarsProvider.object);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IPathUtils))).returns(() => pathUtils.object);
        envVarsProvider
            .setup(p => p.getEnvironmentVariables())
            .returns(() => { return Promise.resolve({ PYTHONPATH: pythonPathVar.join(pathDelimiter) }); })
            .verifiable(TypeMoq.Times.once());

        // tslint:disable-next-line:no-any
        (languageServer as any).languageServerFolder = '';
        const options = await languageServer.getAnalysisOptions();

        expect(options!).not.to.equal(undefined, 'options cannot be undefined');
        expect(options!.initializationOptions).not.to.equal(undefined, 'initializationOptions cannot be undefined');
        expect(options!.initializationOptions!.searchPaths).to.include.members(pythonPathVar);
    });
});
