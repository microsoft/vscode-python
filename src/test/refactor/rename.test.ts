// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import { EOL } from 'os';
import * as path from 'path';
import { instance, mock } from 'ts-mockito';
import * as typeMoq from 'typemoq';
import {
    Range,
    TextEditorCursorStyle,
    TextEditorLineNumbersStyle,
    TextEditorOptions,
    Uri,
    window,
    workspace
} from 'vscode';
import { EXTENSION_ROOT_DIR } from '../../client/common/constants';
import '../../client/common/extensions';
import { BufferDecoder } from '../../client/common/process/decoder';
import { ProcessService } from '../../client/common/process/proc';
import { PythonExecutionFactory } from '../../client/common/process/pythonExecutionFactory';
import {
    IProcessLogger,
    IProcessServiceFactory,
    IPythonExecutionFactory,
    IPythonExecutionService
} from '../../client/common/process/types';
import { IConfigurationService, IPythonSettings } from '../../client/common/types';
import { IEnvironmentActivationService } from '../../client/interpreter/activation/types';
import { ICondaService, IInterpreterService } from '../../client/interpreter/contracts';
import { WindowsStoreInterpreter } from '../../client/interpreter/locators/services/windowsStoreInterpreter';
import { IServiceContainer } from '../../client/ioc/types';
import { RefactorProxy } from '../../client/refactor/proxy';
import { PYTHON_PATH } from '../common';
import { closeActiveWindows, initialize, initializeTest } from './../initialize';

// tslint:disable:no-any
// tslint:disable: max-func-body-length

type RenameResponse = {
    results: [{ diff: string }];
};

suite('Refactor Rename', () => {
    const options: TextEditorOptions = {
        cursorStyle: TextEditorCursorStyle.Line,
        insertSpaces: true,
        lineNumbers: TextEditorLineNumbersStyle.Off,
        tabSize: 4
    };
    let pythonSettings: typeMoq.IMock<IPythonSettings>;
    let serviceContainer: typeMoq.IMock<IServiceContainer>;
    suiteSetup(initialize);
    setup(async () => {
        pythonSettings = typeMoq.Mock.ofType<IPythonSettings>();
        pythonSettings.setup((p) => p.pythonPath).returns(() => PYTHON_PATH);
        const configService = typeMoq.Mock.ofType<IConfigurationService>();
        configService.setup((c) => c.getSettings(typeMoq.It.isAny())).returns(() => pythonSettings.object);
        const condaService = typeMoq.Mock.ofType<ICondaService>();
        const processServiceFactory = typeMoq.Mock.ofType<IProcessServiceFactory>();
        processServiceFactory
            .setup((p) => p.create(typeMoq.It.isAny()))
            .returns(() => Promise.resolve(new ProcessService(new BufferDecoder())));
        const interpreterService = typeMoq.Mock.ofType<IInterpreterService>();
        interpreterService.setup((i) => i.hasInterpreters).returns(() => Promise.resolve(true));
        const envActivationService = typeMoq.Mock.ofType<IEnvironmentActivationService>();
        envActivationService
            .setup((e) => e.getActivatedEnvironmentVariables(typeMoq.It.isAny()))
            .returns(() => Promise.resolve(undefined));
        envActivationService
            .setup((e) => e.getActivatedEnvironmentVariables(typeMoq.It.isAny(), typeMoq.It.isAny()))
            .returns(() => Promise.resolve(undefined));
        envActivationService
            .setup((e) =>
                e.getActivatedEnvironmentVariables(typeMoq.It.isAny(), typeMoq.It.isAny(), typeMoq.It.isAny())
            )
            .returns(() => Promise.resolve(undefined));
        serviceContainer = typeMoq.Mock.ofType<IServiceContainer>();
        serviceContainer
            .setup((s) => s.get(typeMoq.It.isValue(IConfigurationService), typeMoq.It.isAny()))
            .returns(() => configService.object);
        serviceContainer
            .setup((s) => s.get(typeMoq.It.isValue(IProcessServiceFactory), typeMoq.It.isAny()))
            .returns(() => processServiceFactory.object);
        serviceContainer
            .setup((s) => s.get(typeMoq.It.isValue(IInterpreterService), typeMoq.It.isAny()))
            .returns(() => interpreterService.object);
        serviceContainer
            .setup((s) => s.get(typeMoq.It.isValue(IEnvironmentActivationService), typeMoq.It.isAny()))
            .returns(() => envActivationService.object);
        const windowsStoreInterpreter = mock(WindowsStoreInterpreter);
        serviceContainer
            .setup((s) => s.get(typeMoq.It.isValue(IPythonExecutionFactory), typeMoq.It.isAny()))
            .returns(
                () =>
                    new PythonExecutionFactory(
                        serviceContainer.object,
                        undefined as any,
                        processServiceFactory.object,
                        configService.object,
                        condaService.object,
                        undefined as any,
                        instance(windowsStoreInterpreter)
                    )
            );
        const processLogger = typeMoq.Mock.ofType<IProcessLogger>();
        processLogger
            .setup((p) => p.logProcess(typeMoq.It.isAny(), typeMoq.It.isAny(), typeMoq.It.isAny()))
            .returns(() => {
                return;
            });
        serviceContainer
            .setup((s) => s.get(typeMoq.It.isValue(IProcessLogger), typeMoq.It.isAny()))
            .returns(() => processLogger.object);
        await initializeTest();
    });
    teardown(closeActiveWindows);
    suiteTeardown(closeActiveWindows);
    function createPythonExecGetter(workspaceRoot: string): () => Promise<IPythonExecutionService> {
        return async () => {
            const factory = serviceContainer.object.get<IPythonExecutionFactory>(IPythonExecutionFactory);
            return factory.create({ resource: Uri.file(workspaceRoot) });
        };
    }

    test('Rename function in source without a trailing empty line', async () => {
        const sourceFile = path.join(
            EXTENSION_ROOT_DIR,
            'src',
            'test',
            'pythonFiles',
            'refactoring',
            'source folder',
            'without empty line.py'
        );
        const expectedDiff = `--- a/${path.basename(sourceFile)}${EOL}+++ b/${path.basename(
            sourceFile
        )}${EOL}@@ -1,8 +1,8 @@${EOL} import os${EOL} ${EOL}-def one():${EOL}+def three():${EOL}     return True${EOL} ${EOL} def two():${EOL}-    if one():${EOL}-        print(\"A\" + one())${EOL}+    if three():${EOL}+        print(\"A\" + three())${EOL}`.splitLines(
            { removeEmptyEntries: false, trim: false }
        );
        const workspaceRoot = path.dirname(sourceFile);

        const proxy = new RefactorProxy(workspaceRoot, createPythonExecGetter(workspaceRoot));
        const textDocument = await workspace.openTextDocument(sourceFile);
        await window.showTextDocument(textDocument);

        const response = await proxy.rename<RenameResponse>(
            textDocument,
            'three',
            sourceFile,
            new Range(7, 20, 7, 23),
            options
        );
        expect(response.results).to.be.lengthOf(1);
        expect(response.results[0].diff.splitLines({ removeEmptyEntries: false, trim: false })).to.be.deep.equal(
            expectedDiff
        );
    });
    test('Rename function in source with a trailing empty line', async () => {
        const sourceFile = path.join(
            EXTENSION_ROOT_DIR,
            'src',
            'test',
            'pythonFiles',
            'refactoring',
            'source folder',
            'with empty line.py'
        );
        const expectedDiff = `--- a/${path.basename(sourceFile)}${EOL}+++ b/${path.basename(
            sourceFile
        )}${EOL}@@ -1,8 +1,8 @@${EOL} import os${EOL} ${EOL}-def one():${EOL}+def three():${EOL}     return True${EOL} ${EOL} def two():${EOL}-    if one():${EOL}-        print(\"A\" + one())${EOL}+    if three():${EOL}+        print(\"A\" + three())${EOL}`.splitLines(
            { removeEmptyEntries: false, trim: false }
        );
        const workspaceRoot = path.dirname(sourceFile);

        const proxy = new RefactorProxy(workspaceRoot, createPythonExecGetter(workspaceRoot));
        const textDocument = await workspace.openTextDocument(sourceFile);
        await window.showTextDocument(textDocument);

        const response = await proxy.rename<RenameResponse>(
            textDocument,
            'three',
            sourceFile,
            new Range(7, 20, 7, 23),
            options
        );
        expect(response.results).to.be.lengthOf(1);
        expect(response.results[0].diff.splitLines({ removeEmptyEntries: false, trim: false })).to.be.deep.equal(
            expectedDiff
        );
    });
});
