// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as TypeMoq from 'typemoq';
import { TextDocument, Uri } from 'vscode';
import { IDocumentManager, IWorkspaceService } from '../../client/common/application/types';
import { PYTHON_LANGUAGE } from '../../client/common/constants';
import '../../client/common/extensions';
import { IFileSystem } from '../../client/common/platform/types';
import { IConfigurationService, ILintingSettings, ILogOutputChannel, IPythonSettings } from '../../client/common/types';
import { IInterpreterService } from '../../client/interpreter/contracts';
import { IServiceContainer } from '../../client/ioc/types';
import { LintingEngine } from '../../client/linters/lintingEngine';
import { ILinterManager, ILintingEngine } from '../../client/linters/types';
import { PythonEnvironment } from '../../client/pythonEnvironments/info';
import { initialize } from '../initialize';

suite('Linting - LintingEngine', () => {
    let serviceContainer: TypeMoq.IMock<IServiceContainer>;
    let lintManager: TypeMoq.IMock<ILinterManager>;
    let settings: TypeMoq.IMock<IPythonSettings>;
    let lintSettings: TypeMoq.IMock<ILintingSettings>;
    let fileSystem: TypeMoq.IMock<IFileSystem>;
    let lintingEngine: ILintingEngine;

    suiteSetup(initialize);
    setup(async () => {
        serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();

        const docManager = TypeMoq.Mock.ofType<IDocumentManager>();
        serviceContainer
            .setup((c) => c.get(TypeMoq.It.isValue(IDocumentManager), TypeMoq.It.isAny()))
            .returns(() => docManager.object);

        const workspaceService = TypeMoq.Mock.ofType<IWorkspaceService>();
        serviceContainer
            .setup((c) => c.get(TypeMoq.It.isValue(IWorkspaceService), TypeMoq.It.isAny()))
            .returns(() => workspaceService.object);

        fileSystem = TypeMoq.Mock.ofType<IFileSystem>();
        serviceContainer
            .setup((c) => c.get(TypeMoq.It.isValue(IFileSystem), TypeMoq.It.isAny()))
            .returns(() => fileSystem.object);

        lintSettings = TypeMoq.Mock.ofType<ILintingSettings>();
        settings = TypeMoq.Mock.ofType<IPythonSettings>();

        const configService = TypeMoq.Mock.ofType<IConfigurationService>();
        configService.setup((x) => x.getSettings(TypeMoq.It.isAny())).returns(() => settings.object);
        configService.setup((x) => x.isTestExecution()).returns(() => true);
        serviceContainer
            .setup((c) => c.get(TypeMoq.It.isValue(IConfigurationService), TypeMoq.It.isAny()))
            .returns(() => configService.object);

        const outputChannel = TypeMoq.Mock.ofType<ILogOutputChannel>();
        serviceContainer.setup((c) => c.get(TypeMoq.It.isValue(ILogOutputChannel))).returns(() => outputChannel.object);

        lintManager = TypeMoq.Mock.ofType<ILinterManager>();
        lintManager.setup((x) => x.isLintingEnabled(TypeMoq.It.isAny())).returns(async () => true);
        serviceContainer
            .setup((c) => c.get(TypeMoq.It.isValue(ILinterManager), TypeMoq.It.isAny()))
            .returns(() => lintManager.object);

        lintingEngine = new LintingEngine(serviceContainer.object);
        serviceContainer
            .setup((c) => c.get(TypeMoq.It.isValue(ILintingEngine), TypeMoq.It.isAny()))
            .returns(() => lintingEngine);

        const interpreterService = TypeMoq.Mock.ofType<IInterpreterService>();
        interpreterService
            .setup((i) => i.getActiveInterpreter(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(({ path: 'ps' } as unknown) as PythonEnvironment));
        serviceContainer.setup((c) => c.get(IInterpreterService)).returns(() => interpreterService.object);
    });

    test('Ensure document.uri is passed into isLintingEnabled', () => {
        const doc = mockTextDocument('a.py', PYTHON_LANGUAGE, true);
        try {
            lintingEngine.lintDocument(doc, 'auto').ignoreErrors();
        } catch {
            lintManager.verify((l) => l.isLintingEnabled(TypeMoq.It.isValue(doc.uri)), TypeMoq.Times.once());
        }
    });
    test('Ensure document.uri is passed into createLinter', () => {
        const doc = mockTextDocument('a.py', PYTHON_LANGUAGE, true);
        try {
            lintingEngine.lintDocument(doc, 'auto').ignoreErrors();
        } catch {
            lintManager.verify(
                (l) =>
                    l.createLinter(
                        TypeMoq.It.isAny(),

                        TypeMoq.It.isAny(),
                        TypeMoq.It.isValue(doc.uri),
                    ),
                TypeMoq.Times.atLeastOnce(),
            );
        }
    });

    test('Verify files that match ignore pattern are not linted', async () => {
        const doc = mockTextDocument('a1.py', PYTHON_LANGUAGE, true, ['a*.py']);
        await lintingEngine.lintDocument(doc, 'auto');
        lintManager.verify(
            (l) => l.createLinter(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()),
            TypeMoq.Times.never(),
        );
    });

    test('Ensure non-Python files are not linted', async () => {
        const doc = mockTextDocument('a.ts', 'typescript', true);
        await lintingEngine.lintDocument(doc, 'auto');
        lintManager.verify(
            (l) => l.createLinter(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()),
            TypeMoq.Times.never(),
        );
    });

    test('Ensure files with git scheme are not linted', async () => {
        const doc = mockTextDocument('a1.py', PYTHON_LANGUAGE, false, [], 'git');
        await lintingEngine.lintDocument(doc, 'auto');
        lintManager.verify(
            (l) => l.createLinter(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()),
            TypeMoq.Times.never(),
        );
    });
    test('Ensure files with showModifications scheme are not linted', async () => {
        const doc = mockTextDocument('a1.py', PYTHON_LANGUAGE, false, [], 'showModifications');
        await lintingEngine.lintDocument(doc, 'auto');
        lintManager.verify(
            (l) => l.createLinter(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()),
            TypeMoq.Times.never(),
        );
    });
    test('Ensure files with svn scheme are not linted', async () => {
        const doc = mockTextDocument('a1.py', PYTHON_LANGUAGE, false, [], 'svn');
        await lintingEngine.lintDocument(doc, 'auto');
        lintManager.verify(
            (l) => l.createLinter(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()),
            TypeMoq.Times.never(),
        );
    });

    test('Ensure non-existing files are not linted', async () => {
        const doc = mockTextDocument('file.py', PYTHON_LANGUAGE, false, []);
        await lintingEngine.lintDocument(doc, 'auto');
        lintManager.verify(
            (l) => l.createLinter(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()),
            TypeMoq.Times.never(),
        );
    });

    function mockTextDocument(
        fileName: string,
        language: string,
        exists: boolean,
        ignorePattern: string[] = [],
        scheme?: string,
    ): TextDocument {
        fileSystem.setup((x) => x.fileExists(TypeMoq.It.isAnyString())).returns(() => Promise.resolve(exists));

        lintSettings.setup((l) => l.ignorePatterns).returns(() => ignorePattern);
        settings.setup((x) => x.linting).returns(() => lintSettings.object);

        const doc = TypeMoq.Mock.ofType<TextDocument>();
        if (scheme) {
            doc.setup((d) => d.uri).returns(() => Uri.parse(`${scheme}:${fileName}`));
        } else {
            doc.setup((d) => d.uri).returns(() => Uri.file(fileName));
        }
        doc.setup((d) => d.fileName).returns(() => fileName);
        doc.setup((d) => d.languageId).returns(() => language);
        return doc.object;
    }
});
