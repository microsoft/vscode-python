// Licensed under the MIT License.

'use strict';
import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import { isPythonAnalysisEngineTest } from '../../client/common/constants';
import { closeActiveWindows, initialize, initializeTest } from '../initialize';

const decoratorsPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'definition', 'navigation');
const fileDefinitions = path.join(decoratorsPath, 'definitions.py');
const fileUsages = path.join(decoratorsPath, 'usages.py');

// tslint:disable-next-line:max-func-body-length
suite('Definition Navigation', () => {
    suiteSetup(initialize);
    setup(initializeTest);
    suiteTeardown(closeActiveWindows);
    teardown(closeActiveWindows);

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

    const buildTest = (startFile: string, startPosition: vscode.Position, expectedFile: string, expectedRange: vscode.Range) => {
        return async () => {
            const textDocument = await vscode.workspace.openTextDocument(startFile);
            await vscode.window.showTextDocument(textDocument);
            assert(vscode.window.activeTextEditor, 'No active editor');

            const locations = await vscode.commands.executeCommand<vscode.Location[]>('vscode.executeDefinitionProvider', textDocument.uri, startPosition);
            assert.equal(1, locations!.length, 'Wrong number of results');

            const def = locations![0];
            assertFile(expectedFile, def.uri);
            assertRange(expectedRange, def.range!);
        };
    };

    test('From own definition', buildTest(
        fileDefinitions,
        new vscode.Position(2, 6),
        fileDefinitions,
        isPythonAnalysisEngineTest() ? new vscode.Range(2, 4, 2, 16) : new vscode.Range(2, 0, 11, 17)
    ));

    test('Nested function', buildTest(
        fileDefinitions,
        new vscode.Position(11, 16),
        fileDefinitions,
        isPythonAnalysisEngineTest() ? new vscode.Range(6, 8, 6, 15) : new vscode.Range(6, 4, 10, 16)
    ));

    test('Decorator usage', buildTest(
        fileDefinitions,
        new vscode.Position(13, 1),
        fileDefinitions,
        isPythonAnalysisEngineTest() ? new vscode.Range(2, 4, 2, 16) : new vscode.Range(2, 0, 11, 17)
    ));

    test('Function decorated by stdlib', buildTest(
        fileDefinitions,
        new vscode.Position(29, 6),
        fileDefinitions,
        isPythonAnalysisEngineTest() ? new vscode.Range(21, 4, 21, 22) : new vscode.Range(21, 0, 27, 17)
    ));

    test('Function decorated by local decorator', buildTest(
        fileDefinitions,
        new vscode.Position(30, 6),
        fileDefinitions,
        isPythonAnalysisEngineTest() ? new vscode.Range(14, 4, 14, 9) : new vscode.Range(14, 0, 18, 7)
    ));

    test('Module imported decorator usage', buildTest(
        fileUsages,
        new vscode.Position(3, 15),
        fileDefinitions,
        isPythonAnalysisEngineTest() ? new vscode.Range(2, 4, 2, 16) : new vscode.Range(2, 0, 11, 17)
    ));

    test('Module imported function decorated by stdlib', buildTest(
        fileUsages,
        new vscode.Position(11, 19),
        fileDefinitions,
        isPythonAnalysisEngineTest() ? new vscode.Range(21, 4, 21, 22) : new vscode.Range(21, 0, 27, 17)
    ));

    test('Module imported function decorated by local decorator', buildTest(
        fileUsages,
        new vscode.Position(12, 19),
        fileDefinitions,
        isPythonAnalysisEngineTest() ? new vscode.Range(14, 4, 14, 9) : new vscode.Range(14, 0, 18, 7)
    ));

    test('Specifically imported decorator usage', buildTest(
        fileUsages,
        new vscode.Position(7, 1),
        fileDefinitions,
        isPythonAnalysisEngineTest() ? new vscode.Range(2, 4, 2, 16) : new vscode.Range(2, 0, 11, 17)
    ));

    test('Specifically imported function decorated by stdlib', buildTest(
        fileUsages,
        new vscode.Position(14, 6),
        fileDefinitions,
        isPythonAnalysisEngineTest() ? new vscode.Range(21, 4, 21, 22) : new vscode.Range(21, 0, 27, 17)
    ));

    test('Specifically imported function decorated by local decorator', buildTest(
        fileUsages,
        new vscode.Position(15, 6),
        fileDefinitions,
        isPythonAnalysisEngineTest() ? new vscode.Range(14, 4, 14, 9) : new vscode.Range(14, 0, 18, 7)
    ));
});
