// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as assert from 'assert';
import { EOL } from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { EXTENSION_ROOT_DIR } from '../../../../client/common/constants';
import { IS_WINDOWS } from '../../../../client/common/platform/constants';
import { closeActiveWindows, initialize } from '../../../initialize';
import { normalizeMarkedString } from '../../../textUtils';

const autoCompPath = path.join(EXTENSION_ROOT_DIR, 'src', 'test', 'pythonFiles', 'autocomp');
const fileOne = path.join(autoCompPath, 'one.py');

suite('Language Server: Code, Hover Definition and Intellisense (Jedi)', () => {
    suiteSetup(initialize);
    suiteTeardown(closeActiveWindows);
    teardown(closeActiveWindows);

    test('All three together', async () => {
        const textDocument = await vscode.workspace.openTextDocument(fileOne);

        let position = new vscode.Position(30, 5);
        const hoverDef = await vscode.commands.executeCommand<vscode.Hover[]>(
            'vscode.executeHoverProvider',
            textDocument.uri,
            position
        );
        const codeDef = await vscode.commands.executeCommand<vscode.Location[]>(
            'vscode.executeDefinitionProvider',
            textDocument.uri,
            position
        );
        position = new vscode.Position(3, 10);
        const list = await vscode.commands.executeCommand<vscode.CompletionList>(
            'vscode.executeCompletionItemProvider',
            textDocument.uri,
            position
        );

        assert.equal(list!.items.filter((item) => item.label === 'api_version').length, 1, 'api_version not found');

        assert.equal(codeDef!.length, 1, 'Definition length is incorrect');
        const expectedPath = IS_WINDOWS ? fileOne.toUpperCase() : fileOne;
        const actualPath = IS_WINDOWS ? codeDef![0].uri.fsPath.toUpperCase() : codeDef![0].uri.fsPath;
        assert.equal(actualPath, expectedPath, 'Incorrect file');
        assert.equal(
            `${codeDef![0].range!.start.line},${codeDef![0].range!.start.character}`,
            '17,4',
            'Start position is incorrect'
        );
        assert.equal(
            `${codeDef![0].range!.end.line},${codeDef![0].range!.end.character}`,
            '21,11',
            'End position is incorrect'
        );

        assert.equal(hoverDef!.length, 1, 'Definition length is incorrect');
        assert.equal(
            `${hoverDef![0].range!.start.line},${hoverDef![0].range!.start.character}`,
            '30,4',
            'Start position is incorrect'
        );
        assert.equal(
            `${hoverDef![0].range!.end.line},${hoverDef![0].range!.end.character}`,
            '30,11',
            'End position is incorrect'
        );
        assert.equal(hoverDef![0].contents.length, 1, 'Invalid content items');
        // tslint:disable-next-line:prefer-template
        const expectedContent = '```python' + EOL + 'def method1()' + EOL + '```' + EOL + 'This is method1';
        assert.equal(normalizeMarkedString(hoverDef![0].contents[0]), expectedContent, 'function signature incorrect');
    });
});
