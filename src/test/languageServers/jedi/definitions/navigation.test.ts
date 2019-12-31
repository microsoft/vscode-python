// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import { EXTENSION_ROOT_DIR } from '../../../../client/common/constants';
import { rootWorkspaceUri } from '../../../common';
import { closeActiveWindows, initialize, initializeTest } from '../../../initialize';
import { UnitTestIocContainer } from '../../../testing/serviceRegistry';

const decoratorsPath = path.join(EXTENSION_ROOT_DIR, 'src', 'test', 'pythonFiles', 'definition', 'navigation');
const fileDefinitions = path.join(decoratorsPath, 'definitions.py');
const fileUsages = path.join(decoratorsPath, 'usages.py');

// tslint:disable-next-line:max-func-body-length
suite('Language Server: Definition Navigation', () => {
    let isPython2: boolean;
    let ioc: UnitTestIocContainer;

    suiteSetup(async () => {
        await initialize();
        initializeDI();
        isPython2 = (await ioc.getPythonMajorVersion(rootWorkspaceUri!)) === 2;
    });
    setup(initializeTest);
    suiteTeardown(closeActiveWindows);
    teardown(async () => {
        await closeActiveWindows();
        await ioc.dispose();
    });

    function initializeDI() {
        ioc = new UnitTestIocContainer();
        ioc.registerCommonTypes();
        ioc.registerVariableTypes();
        ioc.registerProcessTypes();
    }

    const assertFile = (expectedLocation: string, location: vscode.Uri) => {
        const relLocation = vscode.workspace.asRelativePath(location);
        const expectedRelLocation = vscode.workspace.asRelativePath(expectedLocation);
        assert.equal(expectedRelLocation, relLocation, 'Position is in wrong file');
    };

    const formatPosition = (position: vscode.Position) => {
        return `${position.line},${position.character}`;
    };

    const assertRange = (expectedRange: vscode.Range, range: vscode.Range) => {
        assert.equal(formatPosition(expectedRange.start), formatPosition(range.start), 'Start position is incorrect');
        assert.equal(formatPosition(expectedRange.end), formatPosition(range.end), 'End position is incorrect');
    };

    const buildTest = (startFile: string, startPosition: vscode.Position, expectedFiles: string[], expectedRanges: vscode.Range[]) => {
        return async () => {
            const textDocument = await vscode.workspace.openTextDocument(startFile);
            await vscode.window.showTextDocument(textDocument);
            assert(vscode.window.activeTextEditor, 'No active editor');

            const locations = await vscode.commands.executeCommand<vscode.Location[]>('vscode.executeDefinitionProvider', textDocument.uri, startPosition);
            assert.equal(locations!.length, expectedFiles.length, 'Wrong number of results');

            for (let i = 0; i < locations!.length; i += 1) {
                assertFile(expectedFiles[i], locations![i].uri);
                assertRange(expectedRanges[i], locations![i].range!);
            }
        };
    };

    test('From own definition', buildTest(fileDefinitions, new vscode.Position(2, 6), [fileDefinitions], [new vscode.Range(2, 0, 11, 17)]));

    test('Nested function', buildTest(fileDefinitions, new vscode.Position(11, 16), [fileDefinitions], [new vscode.Range(6, 4, 10, 16)]));

    test('Decorator usage', buildTest(fileDefinitions, new vscode.Position(13, 1), [fileDefinitions], [new vscode.Range(2, 0, 11, 17)]));

    test('Function decorated by stdlib', buildTest(fileDefinitions, new vscode.Position(29, 6), [fileDefinitions], [new vscode.Range(21, 0, 27, 17)]));

    test('Function decorated by local decorator', buildTest(fileDefinitions, new vscode.Position(30, 6), [fileDefinitions], [new vscode.Range(14, 0, 18, 7)]));

    test('Module imported decorator usage', buildTest(fileUsages, new vscode.Position(3, 15), [fileDefinitions], [new vscode.Range(2, 0, 11, 17)]));

    test('Module imported function decorated by stdlib', buildTest(fileUsages, new vscode.Position(11, 19), [fileDefinitions], [new vscode.Range(21, 0, 27, 17)]));

    test('Module imported function decorated by local decorator', buildTest(fileUsages, new vscode.Position(12, 19), [fileDefinitions], [new vscode.Range(14, 0, 18, 7)]));

    test('Specifically imported decorator usage', async () => {
        const navigationTest = buildTest(fileUsages, new vscode.Position(7, 1), isPython2 ? [] : [fileDefinitions], [new vscode.Range(2, 0, 11, 17)]);
        await navigationTest();
    });

    test('Specifically imported function decorated by stdlib', async () => {
        const navigationTest = buildTest(fileUsages, new vscode.Position(14, 6), isPython2 ? [] : [fileDefinitions], [new vscode.Range(21, 0, 27, 17)]);
        await navigationTest();
    });

    test('Specifically imported function decorated by local decorator', async () => {
        const navigationTest = buildTest(fileUsages, new vscode.Position(15, 6), isPython2 ? [] : [fileDefinitions], [new vscode.Range(14, 0, 18, 7)]);
        await navigationTest();
    });
});
