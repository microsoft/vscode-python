// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { assert } from 'chai';
import * as TypeMoq from 'typemoq';
import { WorkspaceConfiguration } from 'vscode';

import { Extensions } from '../../client/common/application/extensions';
import { IWorkspaceService } from '../../client/common/application/types';
import { PythonSettings } from '../../client/common/configSettings';
import { FileSystem } from '../../client/common/platform/fileSystem';
import { CurrentProcess } from '../../client/common/process/currentProcess';
import { IConfigurationService } from '../../client/common/types';
import { CodeCssGenerator } from '../../client/datascience/codeCssGenerator';
import { ThemeFinder } from '../../client/datascience/themeFinder';
import { IThemeFinder } from '../../client/datascience/types';
import { MockAutoSelectionService } from '../mocks/autoSelector';

// tslint:disable:max-func-body-length
suite('Theme colors', () => {
    let themeFinder: ThemeFinder;
    let extensions: Extensions;
    let currentProcess: CurrentProcess;
    let workspaceService: TypeMoq.IMock<IWorkspaceService>;
    let workspaceConfig: TypeMoq.IMock<WorkspaceConfiguration>;
    let cssGenerator: CodeCssGenerator;
    let configService: TypeMoq.IMock<IConfigurationService>;
    const settings: PythonSettings = new PythonSettings(undefined, new MockAutoSelectionService());

    setup(() => {
        extensions = new Extensions();
        currentProcess = new CurrentProcess();
        const fs = new FileSystem();
        themeFinder = new ThemeFinder(extensions, currentProcess, fs);

        workspaceConfig = TypeMoq.Mock.ofType<WorkspaceConfiguration>();
        workspaceConfig
            .setup((ws) => ws.has(TypeMoq.It.isAnyString()))
            .returns(() => {
                return false;
            });
        workspaceConfig
            .setup((ws) => ws.get(TypeMoq.It.isAnyString()))
            .returns(() => {
                return undefined;
            });
        workspaceConfig
            .setup((ws) => ws.get(TypeMoq.It.isAnyString(), TypeMoq.It.isAny()))
            .returns((_s, d) => {
                return d;
            });

        settings.datascience = {
            allowImportFromNotebook: true,
            alwaysTrustNotebooks: true,
            jupyterLaunchTimeout: 20000,
            jupyterLaunchRetries: 3,
            enabled: true,
            jupyterServerURI: 'local',
            notebookFileRoot: 'WORKSPACE',
            changeDirOnImportExport: true,
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
            widgetScriptSources: []
        };
        configService = TypeMoq.Mock.ofType<IConfigurationService>();
        configService.setup((x) => x.getSettings(TypeMoq.It.isAny())).returns(() => settings);

        workspaceService = TypeMoq.Mock.ofType<IWorkspaceService>();
        workspaceService.setup((c) => c.getConfiguration(TypeMoq.It.isAny())).returns(() => workspaceConfig.object);
        workspaceService
            .setup((c) => c.getConfiguration(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns(() => workspaceConfig.object);

        cssGenerator = new CodeCssGenerator(workspaceService.object, themeFinder, configService.object, fs);
    });

    function runTest(themeName: string, isDark: boolean, shouldExist: boolean) {
        test(themeName, async () => {
            const json = await themeFinder.findThemeRootJson(themeName);
            if (shouldExist) {
                assert.ok(json, `Cannot find theme ${themeName}`);
                const actuallyDark = await themeFinder.isThemeDark(themeName);
                assert.equal(actuallyDark, isDark, `Theme ${themeName} darkness is not ${isDark}`);
                workspaceConfig.reset();
                workspaceConfig
                    .setup((ws) => ws.get<string>(TypeMoq.It.isValue('colorTheme')))
                    .returns(() => {
                        return themeName;
                    });
                workspaceConfig
                    .setup((ws) => ws.get<string>(TypeMoq.It.isValue('fontFamily')))
                    .returns(() => {
                        return 'Arial';
                    });
                workspaceConfig
                    .setup((ws) => ws.get<number>(TypeMoq.It.isValue('fontSize')))
                    .returns(() => {
                        return 16;
                    });
                workspaceConfig
                    .setup((ws) => ws.get(TypeMoq.It.isAnyString(), TypeMoq.It.isAny()))
                    .returns((_s, d) => {
                        return d;
                    });
                const theme = await cssGenerator.generateMonacoTheme(undefined, isDark, themeName);
                assert.ok(theme, `Cannot find monaco theme for ${themeName}`);
                const colors = await cssGenerator.generateThemeCss(undefined, isDark, themeName);
                assert.ok(colors, 'Cannot find theme colors for Kimbie Dark');

                // Make sure we have a string value that is not set to a variable
                // (that would be the default and all themes have a string color)
                assert.ok(theme.rules, 'No rules found in monaco theme');
                // tslint:disable-next-line: no-any
                const commentPunctuation = (theme.rules as any[]).findIndex(
                    (r) => r.token === 'punctuation.definition.comment'
                );
                assert.ok(commentPunctuation >= 0, 'No punctuation.comment found');
            } else {
                assert.notOk(json, `Found ${themeName} when not expected`);
            }
        });
    }

    // One test per known theme
    runTest('Light (Visual Studio)', false, true);
    runTest('Light+ (default light)', false, true);
    runTest('Quiet Light', false, true);
    runTest('Solarized Light', false, true);
    runTest('Abyss', true, true);
    runTest('Dark (Visual Studio)', true, true);
    runTest('Dark+ (default dark)', true, true);
    runTest('Kimbie Dark', true, true);
    runTest('Monokai', true, true);
    runTest('Monokai Dimmed', true, true);
    runTest('Red', true, true);
    runTest('Solarized Dark', true, true);
    runTest('Tomorrow Night Blue', true, true);

    // One test to make sure unknown themes don't return a value.
    runTest('Knight Rider', true, false);

    // Test for when theme's json can't be found.
    test('Missing json theme', async () => {
        const mockThemeFinder = TypeMoq.Mock.ofType<IThemeFinder>();
        mockThemeFinder.setup((m) => m.isThemeDark(TypeMoq.It.isAnyString())).returns(() => Promise.resolve(false));
        mockThemeFinder
            .setup((m) => m.findThemeRootJson(TypeMoq.It.isAnyString()))
            .returns(() => Promise.resolve(undefined));

        const fs = new FileSystem();
        cssGenerator = new CodeCssGenerator(workspaceService.object, mockThemeFinder.object, configService.object, fs);

        const colors = await cssGenerator.generateThemeCss(undefined, false, 'Kimbie Dark');
        assert.ok(colors, 'Cannot find theme colors for Kimbie Dark');

        // Make sure we have a string value that is not set to a variable
        // (that would be the default and all themes have a string color)
        const matches = /--code-string-color\:\s(.*?);/gm.exec(colors);
        assert.ok(matches, 'No matches found for string color');
        assert.equal(matches!.length, 2, 'Wrong number of matches for for string color');
        assert.ok(matches![1].includes('#'), 'String color not found');
    });
});
