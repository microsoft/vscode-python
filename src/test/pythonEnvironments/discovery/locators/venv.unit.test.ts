// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { expect } from 'chai';
import { Container } from 'inversify';
import * as os from 'os';
import * as path from 'path';
import * as TypeMoq from 'typemoq';
import { Uri, WorkspaceFolder } from 'vscode';
import { IWorkspaceService } from '../../../../client/common/application/types';
import { PlatformService } from '../../../../client/common/platform/platformService';
import { IConfigurationService, ICurrentProcess, IPythonSettings } from '../../../../client/common/types';
import {
    IInterpreterAutoSelectionService,
    IInterpreterAutoSeletionProxyService
} from '../../../../client/interpreter/autoSelection/types';
import { IVirtualEnvironmentManager } from '../../../../client/interpreter/virtualEnvs/types';
import { ServiceContainer } from '../../../../client/ioc/container';
import { ServiceManager } from '../../../../client/ioc/serviceManager';
import { GlobalVirtualEnvironmentsSearchPathProvider } from '../../../../client/pythonEnvironments/discovery/locators/services/globalVirtualEnvService';
import { WorkspaceVirtualEnvironmentsSearchPathProvider } from '../../../../client/pythonEnvironments/discovery/locators/services/workspaceVirtualEnvService';
import { MockAutoSelectionService } from '../../../mocks/autoSelector';

// tslint:disable-next-line:no-require-imports no-var-requires
const untildify: (value: string) => string = require('untildify');

// tslint:disable-next-line: max-func-body-length
suite('Virtual environments', () => {
    let serviceManager: ServiceManager;
    let serviceContainer: ServiceContainer;
    let settings: TypeMoq.IMock<IPythonSettings>;
    let config: TypeMoq.IMock<IConfigurationService>;
    let workspace: TypeMoq.IMock<IWorkspaceService>;
    let process: TypeMoq.IMock<ICurrentProcess>;
    let virtualEnvMgr: TypeMoq.IMock<IVirtualEnvironmentManager>;

    setup(() => {
        const cont = new Container();
        serviceManager = new ServiceManager(cont);
        serviceContainer = new ServiceContainer(cont);

        settings = TypeMoq.Mock.ofType<IPythonSettings>();
        config = TypeMoq.Mock.ofType<IConfigurationService>();
        workspace = TypeMoq.Mock.ofType<IWorkspaceService>();
        process = TypeMoq.Mock.ofType<ICurrentProcess>();
        virtualEnvMgr = TypeMoq.Mock.ofType<IVirtualEnvironmentManager>();

        config.setup((x) => x.getSettings(TypeMoq.It.isAny())).returns(() => settings.object);

        serviceManager.addSingletonInstance<IConfigurationService>(IConfigurationService, config.object);
        serviceManager.addSingletonInstance<IWorkspaceService>(IWorkspaceService, workspace.object);
        serviceManager.addSingletonInstance<ICurrentProcess>(ICurrentProcess, process.object);
        serviceManager.addSingletonInstance<IVirtualEnvironmentManager>(
            IVirtualEnvironmentManager,
            virtualEnvMgr.object
        );
        serviceManager.addSingleton<IInterpreterAutoSelectionService>(
            IInterpreterAutoSelectionService,
            MockAutoSelectionService
        );
        serviceManager.addSingleton<IInterpreterAutoSeletionProxyService>(
            IInterpreterAutoSeletionProxyService,
            MockAutoSelectionService
        );
    });

    test('Global search paths', async () => {
        const pathProvider = new GlobalVirtualEnvironmentsSearchPathProvider(serviceContainer);

        const homedir = os.homedir();
        const folders = ['Envs', 'testpath'];
        settings.setup((x) => x.venvFolders).returns(() => folders);
        virtualEnvMgr.setup((v) => v.getPyEnvRoot(TypeMoq.It.isAny())).returns(() => Promise.resolve(undefined));
        let paths = await pathProvider.getSearchPaths();
        let expected = ['envs', '.pyenv', '.direnv', '.virtualenvs', ...folders].map((item) =>
            path.join(homedir, item)
        );

        virtualEnvMgr.verifyAll();
        expect(paths).to.deep.equal(expected, 'Global search folder list is incorrect.');

        virtualEnvMgr.reset();
        virtualEnvMgr.setup((v) => v.getPyEnvRoot(TypeMoq.It.isAny())).returns(() => Promise.resolve('pyenv_path'));
        paths = await pathProvider.getSearchPaths();

        virtualEnvMgr.verifyAll();
        expected = expected.concat(['pyenv_path', path.join('pyenv_path', 'versions')]);
        expect(paths).to.deep.equal(expected, 'pyenv path not resolved correctly.');
    });

    test('Global search paths with duplicates', async () => {
        const pathProvider = new GlobalVirtualEnvironmentsSearchPathProvider(serviceContainer);

        const folders = ['.virtualenvs', '.direnv'];
        settings.setup((x) => x.venvFolders).returns(() => folders);
        const paths = await pathProvider.getSearchPaths();

        expect([...new Set(paths)]).to.deep.equal(
            paths,
            'Duplicates are not removed from the list of global search paths'
        );
    });

    test('Global search paths with tilde path in the WORKON_HOME environment variable', async () => {
        const pathProvider = new GlobalVirtualEnvironmentsSearchPathProvider(serviceContainer);

        const homedir = os.homedir();
        const workonFolder = path.join('~', '.workonFolder');
        process
            .setup((p) => p.env)
            .returns(() => {
                return { WORKON_HOME: workonFolder };
            });
        settings.setup((x) => x.venvFolders).returns(() => []);

        const paths = await pathProvider.getSearchPaths();
        const expected = ['envs', '.pyenv', '.direnv', '.virtualenvs'].map((item) => path.join(homedir, item));
        expected.push(untildify(workonFolder));

        expect(paths).to.deep.equal(expected, 'WORKON_HOME environment variable not read.');
    });

    test('Global search paths with absolute path in the WORKON_HOME environment variable', async () => {
        const pathProvider = new GlobalVirtualEnvironmentsSearchPathProvider(serviceContainer);

        const homedir = os.homedir();
        const workonFolder = path.join('path', 'to', '.workonFolder');
        process
            .setup((p) => p.env)
            .returns(() => {
                return { WORKON_HOME: workonFolder };
            });
        settings.setup((x) => x.venvFolders).returns(() => []);

        const paths = await pathProvider.getSearchPaths();
        const expected = ['envs', '.pyenv', '.direnv', '.virtualenvs'].map((item) => path.join(homedir, item));
        expected.push(workonFolder);

        expect(paths).to.deep.equal(expected, 'WORKON_HOME environment variable not read.');
    });

    test('Workspace search paths', async () => {
        settings.setup((x) => x.venvPath).returns(() => path.join('~', 'foo'));

        const wsRoot = TypeMoq.Mock.ofType<WorkspaceFolder>();
        wsRoot.setup((x) => x.uri).returns(() => Uri.file('root'));

        const folder1 = TypeMoq.Mock.ofType<WorkspaceFolder>();
        folder1.setup((x) => x.uri).returns(() => Uri.file('dir1'));

        workspace.setup((x) => x.getWorkspaceFolder(TypeMoq.It.isAny())).returns(() => wsRoot.object);
        workspace.setup((x) => x.workspaceFolders).returns(() => [wsRoot.object, folder1.object]);

        const pathProvider = new WorkspaceVirtualEnvironmentsSearchPathProvider(serviceContainer);
        const paths = await pathProvider.getSearchPaths(Uri.file(''));

        const homedir = os.homedir();
        const isWindows = new PlatformService();
        const fixCase = (item: string) => (isWindows ? item.toUpperCase() : item);
        const expected = [path.join(homedir, 'foo'), 'root', path.join('root', '.direnv')]
            .map((item) => Uri.file(item).fsPath)
            .map(fixCase);
        expect(paths.map(fixCase)).to.deep.equal(expected, 'Workspace venv folder search list does not match.');
    });
});
