// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import * as TypeMoq from 'typemoq';
import { WorkspaceConfiguration } from 'vscode';
import {
    PythonSettings
} from '../../client/common/configSettings';
import {
    IAnalysisSettings,
    IAutoCompleteSettings,
    IFormattingSettings,
    ILintingSettings,
    ISortImportSettings,
    ITerminalSettings,
    IUnitTestSettings,
    IWorkspaceSymbolSettings
} from '../../client/common/types';

// tslint:disable-next-line:max-func-body-length
suite('Python Settings', () => {
    let config: TypeMoq.IMock<WorkspaceConfiguration>;

    setup(() => {
        config = TypeMoq.Mock.ofType<WorkspaceConfiguration>(undefined, TypeMoq.MockBehavior.Strict);
    });

    function initializeConfig(settings: PythonSettings) {
        // string settings
        for (const name of ['pythonPath', 'venvPath', 'condaPath', 'envFile']) {
            config.setup(c => c.get<string>(name))
                .returns(() => settings[name]);
        }
        if (settings.jediEnabled) {
            config.setup(c => c.get<string>('jediPath'))
                .returns(() => settings.jediPath);
        }
        for (const name of ['venvFolders']) {
            config.setup(c => c.get<string[]>(name))
                .returns(() => settings[name]);
        }

        // boolean settings
        for (const name of ['downloadLanguageServer', 'jediEnabled', 'autoUpdateLanguageServer']) {
            config.setup(c => c.get<boolean>(name, true))
                .returns(() => settings[name]);
        }
        for (const name of ['disableInstallationCheck', 'globalModuleInstallation']) {
            config.setup(c => c.get<boolean>(name))
                .returns(() => settings[name]);
        }

        // number settings
        if (settings.jediEnabled) {
            config.setup(c => c.get<number>('jediMemoryLimit'))
                .returns(() => settings.jediMemoryLimit);
        }

        // "any" settings
        // tslint:disable-next-line:no-any
        config.setup(c => c.get<any[]>('devOptions'))
            .returns(() => settings.devOptions);

        // complex settings
        config.setup(c => c.get<ILintingSettings>('linting'))
            .returns(() => settings.linting);
        config.setup(c => c.get<IAnalysisSettings>('analysis'))
            .returns(() => settings.analysis);
        config.setup(c => c.get<ISortImportSettings>('sortImports'))
            .returns(() => settings.sortImports);
        config.setup(c => c.get<IFormattingSettings>('formatting'))
            .returns(() => settings.formatting);
        config.setup(c => c.get<IAutoCompleteSettings>('autoComplete'))
            .returns(() => settings.autoComplete);
        config.setup(c => c.get<IWorkspaceSymbolSettings>('workspaceSymbols'))
            .returns(() => settings.workspaceSymbols);
        config.setup(c => c.get<IUnitTestSettings>('unitTest'))
            .returns(() => settings.unitTest);
        config.setup(c => c.get<ITerminalSettings>('terminal'))
            .returns(() => settings.terminal);
    }

    test('condaPath updated', () => {
        const expected = new PythonSettings(undefined, false);
        expected.pythonPath = 'python3';
        expected.condaPath = 'spam';
        initializeConfig(expected);
        config.setup(c => c.get<string>('condaPath'))
            .returns(() => expected.condaPath)
            .verifiable(TypeMoq.Times.once());

        const settings = new PythonSettings(undefined, false);
        settings.update(config.object);

        expect(settings.condaPath).to.be.equal(expected.condaPath);
        config.verifyAll();
    });
});
