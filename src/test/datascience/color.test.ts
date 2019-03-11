// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { assert } from 'chai';
import * as TypeMoq from 'typemoq';
import { WorkspaceConfiguration } from 'vscode';

import { Extensions } from '../../client/common/application/extensions';
import { IWorkspaceService } from '../../client/common/application/types';
import { Logger } from '../../client/common/logger';
import { CurrentProcess } from '../../client/common/process/currentProcess';
import { CodeCssGenerator } from '../../client/datascience/codeCssGenerator';
import { ThemeFinder } from '../../client/datascience/themeFinder';

suite('Theme colors', () => {
    let themeFinder: ThemeFinder;
    let extensions : Extensions;
    let currentProcess : CurrentProcess;
    let logger : Logger;
    let workspaceService : TypeMoq.IMock<IWorkspaceService>;
    let workspaceConfig : TypeMoq.IMock<WorkspaceConfiguration>;
    let cssGenerator: CodeCssGenerator;

    setup(() => {
        extensions = new Extensions();
        currentProcess = new CurrentProcess();
        logger = new Logger();
        themeFinder = new ThemeFinder(extensions, currentProcess, logger);

        workspaceConfig = TypeMoq.Mock.ofType<WorkspaceConfiguration>();
        workspaceConfig.setup(ws => ws.has(TypeMoq.It.isAnyString()))
            .returns(() => {
                return false;
            });
        workspaceConfig.setup(ws => ws.get(TypeMoq.It.isAnyString()))
            .returns(() => {
                return undefined;
            });
        workspaceConfig.setup(ws => ws.get(TypeMoq.It.isAnyString(), TypeMoq.It.isAny()))
            .returns((s, d) => {
                return d;
            });

        workspaceService = TypeMoq.Mock.ofType<IWorkspaceService>();
        workspaceService.setup(c => c.getConfiguration(TypeMoq.It.isAny())).returns(() => workspaceConfig.object);
        workspaceService.setup(c => c.getConfiguration(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => workspaceConfig.object);

        cssGenerator = new CodeCssGenerator(workspaceService.object, themeFinder, logger);
    });

    function runTest(themeName: string, isDark: boolean, shouldExist: boolean) {
        test(themeName, async () => {
            const json = await themeFinder.findThemeRootJson(themeName);
            if (shouldExist) {
                assert.ok(json, `Cannot find theme ${themeName}`);
                const actuallyDark = await themeFinder.isThemeDark(themeName);
                assert.equal(actuallyDark, isDark, `Theme ${themeName} darkness is not ${isDark}`);
                workspaceConfig.reset();
                workspaceConfig.setup(ws => ws.get<string>(TypeMoq.It.isValue('colorTheme'))).returns(() => {
                    return themeName;
                });
                workspaceConfig.setup(ws => ws.get<string>(TypeMoq.It.isValue('fontFamily'))).returns(() => {
                    return 'Arial';
                });
                workspaceConfig.setup(ws => ws.get<number>(TypeMoq.It.isValue('fontSize'))).returns(() => {
                    return 16;
                });
                workspaceConfig.setup(ws => ws.get(TypeMoq.It.isAnyString(), TypeMoq.It.isAny()))
                .returns((s, d) => {
                    return d;
                });
                const colors = await cssGenerator.generateThemeCss();
                assert.ok(colors, `Cannot find theme colors for ${themeName}`);

                // Make sure we have a string value that is not set to a variable
                // (that would be the default and all themes have a string color)
                const matches = /span\.cm-string\s\{color\:\s(.*?);/gm.exec(colors);
                assert.ok(matches, 'No matches found for string color');
                assert.equal(matches!.length, 2, 'Wrong number of matches for for string color');
                assert.ok(matches![1].includes('#'), 'String color not found');
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
});
