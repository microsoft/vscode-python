// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import * as path from 'path';
import * as typeMoq from 'typemoq';
import { Range, TextEditorCursorStyle, TextEditorLineNumbersStyle, TextEditorOptions, window, workspace } from 'vscode';
import { EXTENSION_ROOT_DIR } from '../../client/common/constants';
import { BufferDecoder } from '../../client/common/process/decoder';
import { ProcessService } from '../../client/common/process/proc';
import { PythonExecutionFactory } from '../../client/common/process/pythonExecutionFactory';
import { IProcessServiceFactory, IPythonExecutionFactory } from '../../client/common/process/types';
import { IConfigurationService, IPythonSettings } from '../../client/common/types';
import { IServiceContainer } from '../../client/ioc/types';
import { RefactorProxy } from '../../client/refactor/proxy';
import { PYTHON_PATH } from '../common';
import { closeActiveWindows, initialize, initializeTest } from './../initialize';

type RenameResponse = {
    results: [{ diff: string }];
};

suite('Refactor Rename', () => {
    const options: TextEditorOptions = { cursorStyle: TextEditorCursorStyle.Line, insertSpaces: true, lineNumbers: TextEditorLineNumbersStyle.Off, tabSize: 4 };
    let pythonSettings: typeMoq.IMock<IPythonSettings>;
    let serviceContainer: typeMoq.IMock<IServiceContainer>;
    const EOLUsedByRoped = '\n';
    suiteSetup(initialize);
    setup(async () => {
        pythonSettings = typeMoq.Mock.ofType<IPythonSettings>();
        pythonSettings.setup(p => p.pythonPath).returns(() => PYTHON_PATH);
        const configService = typeMoq.Mock.ofType<IConfigurationService>();
        configService.setup(c => c.getSettings(typeMoq.It.isAny())).returns(() => pythonSettings.object);
        const processServiceFactory = typeMoq.Mock.ofType<IProcessServiceFactory>();
        processServiceFactory.setup(p => p.create(typeMoq.It.isAny())).returns(() => Promise.resolve(new ProcessService(new BufferDecoder())));

        serviceContainer = typeMoq.Mock.ofType<IServiceContainer>();
        serviceContainer.setup(s => s.get(typeMoq.It.isValue(IConfigurationService), typeMoq.It.isAny())).returns(() => configService.object);
        serviceContainer.setup(s => s.get(typeMoq.It.isValue(IProcessServiceFactory), typeMoq.It.isAny())).returns(() => processServiceFactory.object);
        serviceContainer.setup(s => s.get(typeMoq.It.isValue(IPythonExecutionFactory), typeMoq.It.isAny())).returns(() => new PythonExecutionFactory(serviceContainer.object));
        await initializeTest();
    });
    teardown(closeActiveWindows);
    suiteTeardown(closeActiveWindows);

    test('Rename function in source without a trailing empty line', async () => {
        const sourceFile = path.join(EXTENSION_ROOT_DIR, 'src', 'test', 'pythonFiles', 'refactoring', 'source folder', 'without empty line.py');
        const expectedDiff = `--- a/${path.basename(sourceFile)}${EOLUsedByRoped}+++ b/${path.basename(sourceFile)}${EOLUsedByRoped}@@ -1,8 +1,8 @@${EOLUsedByRoped} import os${EOLUsedByRoped} ${EOLUsedByRoped}-def one():${EOLUsedByRoped}+def three():${EOLUsedByRoped}     return True${EOLUsedByRoped} ${EOLUsedByRoped} def two():${EOLUsedByRoped}-    if one():${EOLUsedByRoped}-        print(\"A\" + one())${EOLUsedByRoped}+    if three():${EOLUsedByRoped}+        print(\"A\" + three())${EOLUsedByRoped}`;

        const proxy = new RefactorProxy(EXTENSION_ROOT_DIR, pythonSettings.object, path.dirname(sourceFile), serviceContainer.object);
        const textDocument = await workspace.openTextDocument(sourceFile);
        await window.showTextDocument(textDocument);

        const response = await proxy.rename<RenameResponse>(textDocument, 'three', sourceFile, new Range(7, 20, 7, 23), options);
        expect(response.results).to.be.lengthOf(1);
        expect(response.results[0].diff).to.be.equal(expectedDiff);
    });
    test('Rename function in source with a trailing empty line', async () => {
        const sourceFile = path.join(EXTENSION_ROOT_DIR, 'src', 'test', 'pythonFiles', 'refactoring', 'source folder', 'with empty line.py');
        const expectedDiff = `--- a/${path.basename(sourceFile)}${EOLUsedByRoped}+++ b/${path.basename(sourceFile)}${EOLUsedByRoped}@@ -1,8 +1,8 @@${EOLUsedByRoped} import os${EOLUsedByRoped} ${EOLUsedByRoped}-def one():${EOLUsedByRoped}+def three():${EOLUsedByRoped}     return True${EOLUsedByRoped} ${EOLUsedByRoped} def two():${EOLUsedByRoped}-    if one():${EOLUsedByRoped}-        print(\"A\" + one())${EOLUsedByRoped}+    if three():${EOLUsedByRoped}+        print(\"A\" + three())${EOLUsedByRoped}`;

        const proxy = new RefactorProxy(EXTENSION_ROOT_DIR, pythonSettings.object, path.dirname(sourceFile), serviceContainer.object);
        const textDocument = await workspace.openTextDocument(sourceFile);
        await window.showTextDocument(textDocument);

        const response = await proxy.rename<RenameResponse>(textDocument, 'three', sourceFile, new Range(7, 20, 7, 23), options);
        expect(response.results).to.be.lengthOf(1);
        expect(response.results[0].diff).to.be.equal(expectedDiff);
    });
});
