// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';
import { noop } from 'lodash';
import * as path from 'path';
import { Uri } from 'vscode';
import { ICommandManager } from '../../client/common/application/types';
import { IDataScienceSettings } from '../../client/common/types';
import { Commands } from '../../client/datascience/constants';
import {
    AskForSaveResult,
    NativeEditorOldWebView
} from '../../client/datascience/interactive-ipynb/nativeEditorOldWebView';
import { INotebookEditorProvider } from '../../client/datascience/types';
import { IServiceContainer } from '../../client/ioc/types';
import { CommandSource } from '../../client/testing/common/constants';
import { waitForCondition } from '../common';

// The default base set of data science settings to use
export function defaultDataScienceSettings(): IDataScienceSettings {
    return {
        allowImportFromNotebook: true,
        alwaysTrustNotebooks: true,
        jupyterLaunchTimeout: 10,
        jupyterLaunchRetries: 3,
        enabled: true,
        jupyterServerURI: 'local',
        // tslint:disable-next-line: no-invalid-template-strings
        notebookFileRoot: '${fileDirname}',
        changeDirOnImportExport: false,
        useDefaultConfigForJupyter: true,
        jupyterInterruptTimeout: 10000,
        searchForJupyter: true,
        showCellInputCode: true,
        collapseCellInputCodeByDefault: true,
        allowInput: true,
        maxOutputSize: 400,
        enableScrollingForCellOutputs: true,
        errorBackgroundColor: '#FFFFFF',
        sendSelectionToInteractiveWindow: false,
        variableExplorerExclude: 'module;function;builtin_function_or_method',
        codeRegularExpression: '^(#\\s*%%|#\\s*\\<codecell\\>|#\\s*In\\[\\d*?\\]|#\\s*In\\[ \\])',
        markdownRegularExpression: '^(#\\s*%%\\s*\\[markdown\\]|#\\s*\\<markdowncell\\>)',
        enablePlotViewer: true,
        runStartupCommands: '',
        debugJustMyCode: true,
        variableQueries: [],
        jupyterCommandLineArguments: [],
        widgetScriptSources: [],
        interactiveWindowMode: 'single'
    };
}

export function takeSnapshot() {
    // If you're investigating memory leaks in the tests, using the node-memwatch
    // code below can be helpful. It will at least write out what objects are taking up the most
    // memory.
    // Alternatively, using the test:functional:memleak task and sticking breakpoints here and in
    // writeDiffSnapshot can be used as convenient locations to create heap snapshots and diff them.
    // tslint:disable-next-line: no-require-imports
    //const memwatch = require('@raghb1/node-memwatch');
    return {}; //new memwatch.HeapDiff();
}

//let snapshotCounter = 1;
// tslint:disable-next-line: no-any
export function writeDiffSnapshot(_snapshot: any, _prefix: string) {
    noop(); // Stick breakpoint here when generating heap snapshots
    // const diff = snapshot.end();
    // const file = path.join(EXTENSION_ROOT_DIR, 'tmp', `SD-${snapshotCounter}-${prefix}.json`);
    // snapshotCounter += 1;
    // fs.writeFile(file, JSON.stringify(diff), { encoding: 'utf-8' }).ignoreErrors();
}

export async function openNotebook(serviceContainer: IServiceContainer, ipynbFile: string, ignoreSaving = true) {
    const cmd = serviceContainer.get<ICommandManager>(ICommandManager);
    await cmd.executeCommand(Commands.OpenNotebook, Uri.file(ipynbFile), CommandSource.commandPalette);
    const editorProvider = serviceContainer.get<INotebookEditorProvider>(INotebookEditorProvider);
    await waitForCondition(
        async () =>
            editorProvider.editors.length > 0 &&
            !!editorProvider.activeEditor &&
            editorProvider.activeEditor.file.fsPath.endsWith(path.basename(ipynbFile)),
        30_000,
        'Notebook not opened'
    );

    if (ignoreSaving && editorProvider.activeEditor && editorProvider.activeEditor instanceof NativeEditorOldWebView) {
        // We don't care about changes, no need to save them.
        // tslint:disable-next-line: no-any
        (editorProvider.activeEditor as any).askForSave = () => Promise.resolve(AskForSaveResult.No);
    }
}
