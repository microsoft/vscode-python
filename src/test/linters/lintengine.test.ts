// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as TypeMoq from 'typemoq';
import { OutputChannel, TextDocument, Uri } from 'vscode';
import { IDocumentManager, IWorkspaceService } from '../../client/common/application/types';
import { PythonLanguage, STANDARD_OUTPUT_CHANNEL } from '../../client/common/constants';
import '../../client/common/extensions';
import { IConfigurationService, ILintingSettings, IOutputChannel, IPythonSettings } from '../../client/common/types';
import { IServiceContainer } from '../../client/ioc/types';
import { LintingEngine } from '../../client/linters/lintingEngine';
import { ILinterManager, ILintingEngine } from '../../client/linters/types';
import { initialize } from '../initialize';

// tslint:disable-next-line:max-func-body-length
suite('Linting - LintingEngine', () => {
    let lintingEnging: ILintingEngine;
    let document: TextDocument;
    let lintManager: TypeMoq.IMock<ILinterManager>;
    suiteSetup(initialize);
    setup(async () => {
        const serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();

        const docManager = TypeMoq.Mock.ofType<IDocumentManager>();
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IDocumentManager), TypeMoq.It.isAny())).returns(() => docManager.object);

        const workspaceService = TypeMoq.Mock.ofType<IWorkspaceService>();
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IWorkspaceService), TypeMoq.It.isAny())).returns(() => workspaceService.object);

        const lintSettings = TypeMoq.Mock.ofType<ILintingSettings>();
        lintSettings.setup(l => l.ignorePatterns).returns(() => []);
        const settings = TypeMoq.Mock.ofType<IPythonSettings>();
        settings.setup(x => x.linting).returns(() => lintSettings.object);
        const configService = TypeMoq.Mock.ofType<IConfigurationService>();
        configService.setup(x => x.getSettings(TypeMoq.It.isAny())).returns(() => settings.object);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IConfigurationService), TypeMoq.It.isAny())).returns(() => configService.object);

        const outputChannel = TypeMoq.Mock.ofType<OutputChannel>();
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IOutputChannel), TypeMoq.It.isValue(STANDARD_OUTPUT_CHANNEL))).returns(() => outputChannel.object);

        lintManager = TypeMoq.Mock.ofType<ILinterManager>();
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(ILinterManager), TypeMoq.It.isAny())).returns(() => lintManager.object);

        const mockDocument = TypeMoq.Mock.ofType<TextDocument>();
        mockDocument.setup(d => d.uri).returns(() => Uri.file('a.py'));
        mockDocument.setup(d => d.languageId).returns(() => PythonLanguage.language);
        document = mockDocument.object;

        lintingEnging = new LintingEngine(serviceContainer.object);
    });

    test('Ensure document.uri is passed into isLintingEnabled', () => {
        try {
            lintingEnging.lintDocument(document, 'auto').ignoreErrors();
        } catch {
            lintManager.verify(l => l.isLintingEnabled(TypeMoq.It.isValue(document.uri)), TypeMoq.Times.once());
        }
    });
    test('Ensure document.uri is passed into createLinter', () => {
        try {
            lintingEnging.lintDocument(document, 'auto').ignoreErrors();
        } catch {
            lintManager.verify(l => l.createLinter(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isValue(document.uri)), TypeMoq.Times.atLeastOnce());
        }
    });
});
