// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { expect } from 'chai';
import { Container } from 'inversify';
import * as os from 'os';
import * as path from 'path';
import * as TypeMoq from 'typemoq';
import { CancellationTokenSource, OutputChannel, TextDocument, Uri, WorkspaceFolder } from 'vscode';
import { IWorkspaceService } from '../../client/common/application/types';
import { IFileSystem, IPlatformService } from '../../client/common/platform/types';
import { IPythonToolExecutionService } from '../../client/common/process/types';
import { ExecutionInfo, IConfigurationService, IInstaller, ILogger, IPythonSettings } from '../../client/common/types';
import { ServiceContainer } from '../../client/ioc/container';
import { ServiceManager } from '../../client/ioc/serviceManager';
import { LinterManager } from '../../client/linters/linterManager';
import { Pylint } from '../../client/linters/pylint';
import { ILinterManager } from '../../client/linters/types';
import { MockLintingSettings } from '../mockClasses';

// tslint:disable-next-line:max-func-body-length
suite('Linting - Pylintrc search', () => {
    const basePath = '/user/a/b/c/d';
    const pylintrc = 'pylintrc';
    const dotPylintrc = '.pylintrc';

    let fileSystem: TypeMoq.IMock<IFileSystem>;
    let platformService: TypeMoq.IMock<IPlatformService>;
    let workspace: TypeMoq.IMock<IWorkspaceService>;
    let execService: TypeMoq.IMock<IPythonToolExecutionService>;
    let config: TypeMoq.IMock<IConfigurationService>;
    let serviceContainer: ServiceContainer;

    setup(() => {
        fileSystem = TypeMoq.Mock.ofType<IFileSystem>();
        fileSystem
            .setup(x => x.arePathsSame(TypeMoq.It.isAnyString(), TypeMoq.It.isAnyString()))
            .returns((a, b) => a === b);

        platformService = TypeMoq.Mock.ofType<IPlatformService>();
        platformService.setup(x => x.isWindows).returns(() => false);

        workspace = TypeMoq.Mock.ofType<IWorkspaceService>();
        execService = TypeMoq.Mock.ofType<IPythonToolExecutionService>();

        const cont = new Container();
        const serviceManager = new ServiceManager(cont);
        serviceContainer = new ServiceContainer(cont);

        serviceManager.addSingletonInstance<IFileSystem>(IFileSystem, fileSystem.object);
        serviceManager.addSingletonInstance<IWorkspaceService>(IWorkspaceService, workspace.object);
        serviceManager.addSingletonInstance<IPythonToolExecutionService>(IPythonToolExecutionService, execService.object);
        serviceManager.addSingletonInstance<IPlatformService>(IPlatformService, platformService.object);

        config = TypeMoq.Mock.ofType<IConfigurationService>();
        serviceManager.addSingletonInstance<IConfigurationService>(IConfigurationService, config.object);
        const linterManager = new LinterManager(serviceContainer);
        serviceManager.addSingletonInstance<ILinterManager>(ILinterManager, linterManager);
        const logger = TypeMoq.Mock.ofType<ILogger>();
        serviceManager.addSingletonInstance<ILogger>(ILogger, logger.object);
        const installer = TypeMoq.Mock.ofType<IInstaller>();
        serviceManager.addSingletonInstance<IInstaller>(IInstaller, installer.object);
    });

    test('pylintrc in the file folder', async () => {
        fileSystem.setup(x => x.fileExistsAsync(path.join(basePath, pylintrc))).returns(() => Promise.resolve(true));
        let result = await Pylint.hasConfigurationFile(fileSystem.object, basePath, platformService.object);
        expect(result).to.be.equal(true, `'${pylintrc}' not detected in the file folder.`);

        fileSystem.setup(x => x.fileExistsAsync(path.join(basePath, dotPylintrc))).returns(() => Promise.resolve(true));
        result = await Pylint.hasConfigurationFile(fileSystem.object, basePath, platformService.object);
        expect(result).to.be.equal(true, `'${dotPylintrc}' not detected in the file folder.`);
    });
    test('pylintrc up the module tree', async () => {
        const module1 = path.join('/user/a/b/c/d', '__init__.py');
        const module2 = path.join('/user/a/b/c', '__init__.py');
        const module3 = path.join('/user/a/b', '__init__.py');
        const rc = path.join('/user/a/b/c', pylintrc);

        fileSystem.setup(x => x.fileExistsAsync(module1)).returns(() => Promise.resolve(true));
        fileSystem.setup(x => x.fileExistsAsync(module2)).returns(() => Promise.resolve(true));
        fileSystem.setup(x => x.fileExistsAsync(module3)).returns(() => Promise.resolve(true));
        fileSystem.setup(x => x.fileExistsAsync(rc)).returns(() => Promise.resolve(true));

        const result = await Pylint.hasConfigurationFile(fileSystem.object, basePath, platformService.object);
        expect(result).to.be.equal(true, `'${pylintrc}' not detected in the module tree.`);
    });
    test('.pylintrc up the module tree', async () => {
        // Don't use path.join since it will use / on Travis and Mac
        const module1 = path.join('/user/a/b/c/d', '__init__.py');
        const module2 = path.join('/user/a/b/c', '__init__.py');
        const module3 = path.join('/user/a/b', '__init__.py');
        const rc = path.join('/user/a/b/c', pylintrc);

        fileSystem.setup(x => x.fileExistsAsync(module1)).returns(() => Promise.resolve(true));
        fileSystem.setup(x => x.fileExistsAsync(module2)).returns(() => Promise.resolve(true));
        fileSystem.setup(x => x.fileExistsAsync(module3)).returns(() => Promise.resolve(true));
        fileSystem.setup(x => x.fileExistsAsync(rc)).returns(() => Promise.resolve(true));

        const result = await Pylint.hasConfigurationFile(fileSystem.object, basePath, platformService.object);
        expect(result).to.be.equal(true, `'${dotPylintrc}' not detected in the module tree.`);
    });
    test('.pylintrc up the ~ folder', async () => {
        const home = os.homedir();
        const rc = path.join(home, dotPylintrc);
        fileSystem.setup(x => x.fileExistsAsync(rc)).returns(() => Promise.resolve(true));

        const result = await Pylint.hasConfigurationFile(fileSystem.object, basePath, platformService.object);
        expect(result).to.be.equal(true, `'${dotPylintrc}' not detected in the ~ folder.`);
    });
    test('pylintrc up the ~/.config folder', async () => {
        const home = os.homedir();
        const rc = path.join(home, '.config', pylintrc);
        fileSystem.setup(x => x.fileExistsAsync(rc)).returns(() => Promise.resolve(true));

        const result = await Pylint.hasConfigurationFile(fileSystem.object, basePath, platformService.object);
        expect(result).to.be.equal(true, `'${pylintrc}' not detected in the  ~/.config folder.`);
    });
    test('pylintrc in the /etc folder', async () => {
        const rc = path.join('/etc', pylintrc);
        fileSystem.setup(x => x.fileExistsAsync(rc)).returns(() => Promise.resolve(true));

        const result = await Pylint.hasConfigurationFile(fileSystem.object, basePath, platformService.object);
        expect(result).to.be.equal(true, `'${pylintrc}' not detected in the /etc folder.`);
    });
    test('pylintrc between file and workspace root', async () => {
        const root = '/user/a';
        const midFolder = '/user/a/b';
        fileSystem
            .setup(x => x.fileExistsAsync(path.join(midFolder, pylintrc)))
            .returns(() => Promise.resolve(true));

        const result = await Pylint.hasConfigrationFileInWorkspace(fileSystem.object, basePath, root);
        expect(result).to.be.equal(true, `'${pylintrc}' not detected in the workspace tree.`);
    });

    test('minArgs - pylintrc between the file and the workspace root', async () => {
        fileSystem
            .setup(x => x.fileExistsAsync(path.join('/user/a/b', pylintrc)))
            .returns(() => Promise.resolve(true));

        await testPylintArguments('/user/a/b/c', '/user/a', false);
    });

    test('minArgs - no pylintrc between the file and the workspace root', async () => {
        await testPylintArguments('/user/a/b/c', '/user/a', true);
    });

    test('minArgs - pylintrc next to the file', async () => {
        const fileFolder = '/user/a/b/c';
        fileSystem
            .setup(x => x.fileExistsAsync(path.join(fileFolder, pylintrc)))
            .returns(() => Promise.resolve(true));

        await testPylintArguments(fileFolder, '/user/a', false);
    });

    test('minArgs - pylintrc at the workspace root', async () => {
        const root = '/user/a';
        fileSystem
            .setup(x => x.fileExistsAsync(path.join(root, pylintrc)))
            .returns(() => Promise.resolve(true));

        await testPylintArguments('/user/a/b/c', root, false);
    });

    async function testPylintArguments(fileFolder: string, wsRoot: string, expectedMinArgs: boolean): Promise<void> {
        const outputChannel = TypeMoq.Mock.ofType<OutputChannel>();
        const pylinter = new Pylint(outputChannel.object, serviceContainer);

        const document = TypeMoq.Mock.ofType<TextDocument>();
        document.setup(x => x.uri).returns(() => Uri.file(path.join(fileFolder, 'test.py')));

        const wsf = TypeMoq.Mock.ofType<WorkspaceFolder>();
        wsf.setup(x => x.uri).returns(() => Uri.file(wsRoot));

        workspace.setup(x => x.getWorkspaceFolder(TypeMoq.It.isAny())).returns(() => wsf.object);

        let execInfo: ExecutionInfo | undefined;
        execService
            .setup(x => x.exec(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .callback((e: ExecutionInfo, b, c) => {
                execInfo = e;
            })
            .returns(() => Promise.resolve({ stdout: '', stderr: '' }));

        const lintSettings = new MockLintingSettings();
        lintSettings.pylintUseMinimalCheckers = true;
        // tslint:disable-next-line:no-string-literal
        lintSettings['pylintPath'] = 'pyLint';
        // tslint:disable-next-line:no-string-literal
        lintSettings['pylintEnabled'] = true;

        const settings = TypeMoq.Mock.ofType<IPythonSettings>();
        settings.setup(x => x.linting).returns(() => lintSettings);
        config.setup(x => x.getSettings(TypeMoq.It.isAny())).returns(() => settings.object);

        await pylinter.lint(document.object, new CancellationTokenSource().token);
        expect(execInfo!.args.findIndex(x => x.indexOf('--disable=all') >= 0),
            'Minimal args passed to pylint while pylintrc exists.').to.be.eq(expectedMinArgs ? 0 : -1);
    }
});
