// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { expect } from 'chai';
import { Container } from 'inversify';
import * as os from 'os';
import * as path from 'path';
import * as TypeMoq from 'typemoq';
import { Uri, WorkspaceFolder } from 'vscode';
import { IWorkspaceService } from '../../client/common/application/types';
import { IConfigurationService, ICurrentProcess, IPythonSettings } from '../../client/common/types';
import { EnvironmentVariables } from '../../client/common/variables/types';
import { GlobalVirtualEnvironmentsSearchPathProvider } from '../../client/interpreter/locators/services/globalVirtualEnvService';
import { WorkspaceVirtualEnvironmentsSearchPathProvider } from '../../client/interpreter/locators/services/workspaceVirtualEnvService';
import { ServiceContainer } from '../../client/ioc/container';
import { ServiceManager } from '../../client/ioc/serviceManager';

suite('Virtual environments', () => {
    let serviceManager: ServiceManager;
    let serviceContainer: ServiceContainer;
    let settings: TypeMoq.IMock<IPythonSettings>;
    let config: TypeMoq.IMock<IConfigurationService>;
    let workspace: TypeMoq.IMock<IWorkspaceService>;
    let process: TypeMoq.IMock<ICurrentProcess>;

    setup(async () => {
        const cont = new Container();
        serviceManager = new ServiceManager(cont);
        serviceContainer = new ServiceContainer(cont);

        settings = TypeMoq.Mock.ofType<IPythonSettings>();
        config = TypeMoq.Mock.ofType<IConfigurationService>();
        workspace = TypeMoq.Mock.ofType<IWorkspaceService>();
        process = TypeMoq.Mock.ofType<ICurrentProcess>();

        config.setup(x => x.getSettings(TypeMoq.It.isAny())).returns(() => settings.object);

        serviceManager.addSingletonInstance<IConfigurationService>(IConfigurationService, config.object);
        serviceManager.addSingletonInstance<IWorkspaceService>(IWorkspaceService, workspace.object);
        serviceManager.addSingletonInstance<ICurrentProcess>(ICurrentProcess, process.object);
    });

    test('Global search paths', async () => {
        const pathProvider = new GlobalVirtualEnvironmentsSearchPathProvider(serviceContainer);

        const homedir = os.homedir();
        const folders = ['Envs', '.virtualenvs', '.pyenv'];
        settings.setup(x => x.venvFolders).returns(() => folders);

        let paths = pathProvider.getSearchPaths();
        let expected = folders.map(item => path.join(homedir, item));
        expected.push(path.join(homedir, '.pyenv', 'versions'));

        expect(paths).to.deep.equal(expected, 'Global search folder list is incorrect.');

        const envMap: EnvironmentVariables = {};
        process.setup(x => x.env).returns(() => envMap);

        const customFolder = path.join(homedir, 'some_folder');
        // tslint:disable-next-line:no-string-literal
        envMap['PYENV_ROOT'] = customFolder;
        paths = pathProvider.getSearchPaths();

        expected = folders.map(item => path.join(homedir, item));
        expected.push(customFolder);
        expected.push(path.join(customFolder, 'versions'));
        expect(paths).to.deep.equal(expected, 'PYENV_ROOT not resolved correctly.');
    });

    test('Workspace search paths', async () => {
        settings.setup(x => x.venvPath).returns(() => `~${path.sep}foo`);

        const wsRoot = TypeMoq.Mock.ofType<WorkspaceFolder>();
        wsRoot.setup(x => x.uri).returns(() => Uri.file('root'));

        const folder1 = TypeMoq.Mock.ofType<WorkspaceFolder>();
        folder1.setup(x => x.uri).returns(() => Uri.file('dir1'));

        workspace.setup(x => x.getWorkspaceFolder(TypeMoq.It.isAny())).returns(() => wsRoot.object);
        workspace.setup(x => x.workspaceFolders).returns(() => [wsRoot.object, folder1.object]);

        const pathProvider = new WorkspaceVirtualEnvironmentsSearchPathProvider(serviceContainer);
        const paths = pathProvider.getSearchPaths(Uri.file(''));

        const homedir = os.homedir();
        const expected = [path.join(homedir, 'foo'), `${path.sep}root`, `${path.sep}root${path.sep}.direnv`];
        expect(paths).to.deep.equal(expected, 'Workspace venv folder search list does not match.');
    });
});
