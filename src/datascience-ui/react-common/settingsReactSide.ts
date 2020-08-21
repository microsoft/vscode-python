// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import type * as monacoEditor from 'monaco-editor/esm/vs/editor/editor.api';

import { IDataScienceExtraSettings } from '../../client/datascience/types';

export function getDefaultSettings() {
    // Default settings for tests
    // tslint:disable-next-line: no-unnecessary-local-variable
    const result: IDataScienceExtraSettings = {
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
        allowInput: true,
        showCellInputCode: true,
        collapseCellInputCodeByDefault: true,
        maxOutputSize: 400,
        enableScrollingForCellOutputs: true,
        errorBackgroundColor: '#FFFFFF',
        sendSelectionToInteractiveWindow: false,
        markdownRegularExpression: '^(#\\s*%%\\s*\\[markdown\\]|#\\s*\\<markdowncell\\>)',
        codeRegularExpression: '^(#\\s*%%|#\\s*\\<codecell\\>|#\\s*In\\[\\d*?\\]|#\\s*In\\[ \\])',
        variableExplorerExclude: 'module;function;builtin_function_or_method',
        enablePlotViewer: true,
        interactiveWindowMode: 'multiple',
        extraSettings: {
            editor: {
                cursor: 'line',
                cursorBlink: 'blink',
                autoClosingBrackets: 'languageDefined',
                autoClosingQuotes: 'languageDefined',
                autoSurround: 'languageDefined',
                autoIndent: false,
                fontLigatures: false,
                scrollBeyondLastLine: true,
                // VS Code puts a value for this, but it's 10 (the explorer bar size) not 14 the editor size for vert
                verticalScrollbarSize: 14,
                horizontalScrollbarSize: 14,
                fontSize: 14,
                fontFamily: "Consolas, 'Courier New', monospace"
            },
            theme: 'Default Dark+',
            useCustomEditorApi: false
        },
        intellisenseOptions: {
            quickSuggestions: {
                other: true,
                comments: false,
                strings: false
            },
            acceptSuggestionOnEnter: 'on',
            quickSuggestionsDelay: 10,
            suggestOnTriggerCharacters: true,
            tabCompletion: 'on',
            suggestLocalityBonus: true,
            suggestSelection: 'recentlyUsed',
            wordBasedSuggestions: true,
            parameterHintsEnabled: true
        },
        variableOptions: {
            enableDuringDebugger: false
        },
        webviewExperiments: {
            removeKernelToolbarInInteractiveWindow: false
        },
        gatherIsInstalled: false,
        runStartupCommands: '',
        debugJustMyCode: true,
        variableQueries: [],
        jupyterCommandLineArguments: [],
        widgetScriptSources: []
    };

    return result;
}

//tslint:disable:no-any
export function computeEditorOptions(settings: IDataScienceExtraSettings): monacoEditor.editor.IEditorOptions {
    const intellisenseOptions = settings.intellisenseOptions;
    const extraSettings = settings.extraSettings;
    if (intellisenseOptions && extraSettings) {
        return {
            quickSuggestions: {
                other: intellisenseOptions.quickSuggestions.other,
                comments: intellisenseOptions.quickSuggestions.comments,
                strings: intellisenseOptions.quickSuggestions.strings
            },
            acceptSuggestionOnEnter: intellisenseOptions.acceptSuggestionOnEnter,
            quickSuggestionsDelay: intellisenseOptions.quickSuggestionsDelay,
            suggestOnTriggerCharacters: intellisenseOptions.suggestOnTriggerCharacters,
            tabCompletion: intellisenseOptions.tabCompletion,
            suggest: {
                localityBonus: intellisenseOptions.suggestLocalityBonus
            },
            suggestSelection: intellisenseOptions.suggestSelection,
            wordBasedSuggestions: intellisenseOptions.wordBasedSuggestions,
            parameterHints: {
                enabled: intellisenseOptions.parameterHintsEnabled
            },
            cursorStyle: extraSettings.editor.cursor,
            cursorBlinking: extraSettings.editor.cursorBlink,
            autoClosingBrackets: extraSettings.editor.autoClosingBrackets as any,
            autoClosingQuotes: extraSettings.editor.autoClosingQuotes as any,
            autoIndent: extraSettings.editor.autoIndent as any,
            autoSurround: extraSettings.editor.autoSurround as any,
            fontLigatures: extraSettings.editor.fontLigatures
        };
    }

    return {};
}
