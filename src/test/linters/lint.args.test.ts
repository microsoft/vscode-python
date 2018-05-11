// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any

import { expect } from 'chai';
import { Container } from 'inversify';
import * as path from 'path';
import * as TypeMoq from 'typemoq';
import { CancellationTokenSource, OutputChannel, TextDocument, Uri } from 'vscode';
import { IDocumentManager, IWorkspaceService } from '../../client/common/application/types';
import '../../client/common/extensions';
import { IFileSystem, IPlatformService } from '../../client/common/platform/types';
import { IConfigurationService, IInstaller, ILintingSettings, ILogger, IOutputChannel, IPythonSettings } from '../../client/common/types';
import { IInterpreterService } from '../../client/interpreter/contracts';
import { ServiceContainer } from '../../client/ioc/container';
import { ServiceManager } from '../../client/ioc/serviceManager';
import { BaseLinter } from '../../client/linters/baseLinter';
import { Flake8 } from '../../client/linters/flake8';
import { LinterManager } from '../../client/linters/linterManager';
import { MyPy } from '../../client/linters/mypy';
import { Pep8 } from '../../client/linters/pep8';
import { Prospector } from '../../client/linters/prospector';
import { PyDocStyle } from '../../client/linters/pydocstyle';
import { PyLama } from '../../client/linters/pylama';
import { Pylint } from '../../client/linters/pylint';
import { ILinterManager, ILintingEngine } from '../../client/linters/types';
import { initialize } from '../initialize';

// tslint:disable-next-line:max-func-body-length
suite('Linting - Arguments', () => {
    let interpreterService: TypeMoq.IMock<IInterpreterService>;
    let engine: TypeMoq.IMock<ILintingEngine>;
    let configService: TypeMoq.IMock<IConfigurationService>;
    let docManager: TypeMoq.IMock<IDocumentManager>;
    let settings: TypeMoq.IMock<IPythonSettings>;
    let lm: ILinterManager;
    let serviceContainer: ServiceContainer;
    let document: TypeMoq.IMock<TextDocument>;
    let outputChannel: TypeMoq.IMock<OutputChannel>;
    let workspaceService: TypeMoq.IMock<IWorkspaceService>;
    const cancellationToken = new CancellationTokenSource().token;

    suiteSetup(initialize);
    setup(async () => {
        const cont = new Container();
        const serviceManager = new ServiceManager(cont);

        serviceContainer = new ServiceContainer(cont);
        outputChannel = TypeMoq.Mock.ofType<OutputChannel>();

        const fs = TypeMoq.Mock.ofType<IFileSystem>();
        fs.setup(x => x.fileExists(TypeMoq.It.isAny())).returns(() => new Promise<boolean>((resolve, reject) => resolve(true)));
        fs.setup(x => x.arePathsSame(TypeMoq.It.isAnyString(), TypeMoq.It.isAnyString())).returns(() => true);
        serviceManager.addSingletonInstance<IFileSystem>(IFileSystem, fs.object);

        serviceManager.addSingletonInstance(IOutputChannel, outputChannel.object);

        interpreterService = TypeMoq.Mock.ofType<IInterpreterService>();
        serviceManager.addSingletonInstance<IInterpreterService>(IInterpreterService, interpreterService.object);

        engine = TypeMoq.Mock.ofType<ILintingEngine>();
        serviceManager.addSingletonInstance<ILintingEngine>(ILintingEngine, engine.object);

        docManager = TypeMoq.Mock.ofType<IDocumentManager>();
        serviceManager.addSingletonInstance<IDocumentManager>(IDocumentManager, docManager.object);

        const lintSettings = TypeMoq.Mock.ofType<ILintingSettings>();
        lintSettings.setup(x => x.enabled).returns(() => true);
        lintSettings.setup(x => x.lintOnSave).returns(() => true);

        settings = TypeMoq.Mock.ofType<IPythonSettings>();
        settings.setup(x => x.linting).returns(() => lintSettings.object);

        configService = TypeMoq.Mock.ofType<IConfigurationService>();
        configService.setup(x => x.getSettings(TypeMoq.It.isAny())).returns(() => settings.object);
        serviceManager.addSingletonInstance<IConfigurationService>(IConfigurationService, configService.object);

        workspaceService = TypeMoq.Mock.ofType<IWorkspaceService>();
        serviceManager.addSingletonInstance<IWorkspaceService>(IWorkspaceService, workspaceService.object);

        const logger = TypeMoq.Mock.ofType<ILogger>();
        serviceManager.addSingletonInstance<ILogger>(ILogger, logger.object);

        const installer = TypeMoq.Mock.ofType<IInstaller>();
        serviceManager.addSingletonInstance<IInstaller>(IInstaller, installer.object);

        const platformService = TypeMoq.Mock.ofType<IPlatformService>();
        serviceManager.addSingletonInstance<IPlatformService>(IPlatformService, platformService.object);

        lm = new LinterManager(serviceContainer);
        serviceManager.addSingletonInstance<ILinterManager>(ILinterManager, lm);
        document = TypeMoq.Mock.ofType<TextDocument>();
    });

    async function testLinter(linter: BaseLinter, fileUri: Uri, expectedArgs: string[]) {
        document.setup(d => d.uri).returns(() => fileUri);

        let invoked = false;
        (linter as any).run = (args, doc, token) => {
            expect(args).to.deep.equal(expectedArgs);
            invoked = true;
            return Promise.resolve([]);
        };
        await linter.lint(document.object, cancellationToken);
        expect(invoked).to.be.equal(true, 'method not invoked');
    }
    [Uri.file(path.join('users', 'development path to', 'one.py')), Uri.file(path.join('users', 'development', 'one.py'))].forEach(fileUri => {
        test(`Flake8 (${fileUri.fsPath.indexOf(' ') > 0 ? 'with spaces' : 'without spaces'})`, async () => {
            const linter = new Flake8(outputChannel.object, serviceContainer);
            const expectedArgs = ['--format=%(row)d,%(col)d,%(code).1s,%(code)s:%(text)s', fileUri.fsPath];
            await testLinter(linter, fileUri, expectedArgs);
        });
        test(`Pep8 (${fileUri.fsPath.indexOf(' ') > 0 ? 'with spaces' : 'without spaces'})`, async () => {
            const linter = new Pep8(outputChannel.object, serviceContainer);
            const expectedArgs = ['--format=%(row)d,%(col)d,%(code).1s,%(code)s:%(text)s', fileUri.fsPath];
            await testLinter(linter, fileUri, expectedArgs);
        });
        test(`Prospector (${fileUri.fsPath.indexOf(' ') > 0 ? 'with spaces' : 'without spaces'})`, async () => {
            const linter = new Prospector(outputChannel.object, serviceContainer);
            const expectedArgs = ['--absolute-paths', '--output-format=json', fileUri.fsPath];
            await testLinter(linter, fileUri, expectedArgs);
        });
        test(`Pylama (${fileUri.fsPath.indexOf(' ') > 0 ? 'with spaces' : 'without spaces'})`, async () => {
            const linter = new PyLama(outputChannel.object, serviceContainer);
            const expectedArgs = ['--format=parsable', fileUri.fsPath];
            await testLinter(linter, fileUri, expectedArgs);
        });
        test(`MyPy (${fileUri.fsPath.indexOf(' ') > 0 ? 'with spaces' : 'without spaces'})`, async () => {
            const linter = new MyPy(outputChannel.object, serviceContainer);
            const expectedArgs = [fileUri.fsPath];
            await testLinter(linter, fileUri, expectedArgs);
        });
        test(`Pydocstyle (${fileUri.fsPath.indexOf(' ') > 0 ? 'with spaces' : 'without spaces'})`, async () => {
            const linter = new PyDocStyle(outputChannel.object, serviceContainer);
            const expectedArgs = [fileUri.fsPath];
            await testLinter(linter, fileUri, expectedArgs);
        });
        test(`Pylint (${fileUri.fsPath.indexOf(' ') > 0 ? 'with spaces' : 'without spaces'})`, async () => {
            const linter = new Pylint(outputChannel.object, serviceContainer);
            document.setup(d => d.uri).returns(() => fileUri);

            let invoked = false;
            (linter as any).run = (args, doc, token) => {
                expect(args[args.length - 1]).to.equal(fileUri.fsPath);
                invoked = true;
                return Promise.resolve([]);
            };
            await linter.lint(document.object, cancellationToken);
            expect(invoked).to.be.equal(true, 'method not invoked');
        });
    });
});
