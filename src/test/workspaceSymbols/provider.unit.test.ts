// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as assert from 'assert';
import { expect, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as path from 'path';
import { anything, instance, mock, verify, when } from 'ts-mockito';
import { CancellationTokenSource, Uri } from 'vscode';
import { CommandManager } from '../../client/common/application/commandManager';
import { ICommandManager } from '../../client/common/application/types';
import { Commands } from '../../client/common/constants';
import { FileSystem } from '../../client/common/platform/fileSystem';
import { IFileSystem } from '../../client/common/platform/types';
import { Generator } from '../../client/workspaceSymbols/generator';
import { WorkspaceSymbolProvider } from '../../client/workspaceSymbols/provider';
use(chaiAsPromised);

const workspaceUri = Uri.file(path.join(__dirname, '..', '..', '..', 'src', 'test'));

suite('Workspace Symbols Provider', () => {
    let generator: Generator;
    let fs: IFileSystem;
    let commandManager: ICommandManager;
    setup(() => {
        fs = mock(FileSystem);
        commandManager = mock(CommandManager);
        generator = mock(Generator);
    });
    test('Returns 0 tags without any generators', async () => {
        const provider = new WorkspaceSymbolProvider(instance(fs), instance(commandManager), []);

        const tags = await provider.provideWorkspaceSymbols('', new CancellationTokenSource().token);

        expect(tags).to.be.lengthOf(0);
    });
    test("Builds tags when a tag file doesn't exist", async () => {
        const provider = new WorkspaceSymbolProvider(instance(fs), instance(commandManager), [instance(generator)]);
        const tagFilePath = 'No existing tagFilePath';
        when(generator.tagFilePath).thenReturn(tagFilePath);
        when(fs.fileExists(tagFilePath)).thenResolve(false);
        when(commandManager.executeCommand(Commands.Build_Workspace_Symbols, true, anything())).thenResolve();

        const tags = await provider.provideWorkspaceSymbols('', new CancellationTokenSource().token);

        expect(tags).to.be.lengthOf(0);
        verify(commandManager.executeCommand(Commands.Build_Workspace_Symbols, true, anything())).once();
    });
    test("Builds tags when a tag file doesn't exist", async () => {
        const provider = new WorkspaceSymbolProvider(instance(fs), instance(commandManager), [instance(generator)]);
        const tagFilePath = 'No existing tagFilePath';
        when(generator.tagFilePath).thenReturn(tagFilePath);
        when(fs.fileExists(tagFilePath)).thenResolve(false);
        when(commandManager.executeCommand(Commands.Build_Workspace_Symbols, true, anything())).thenResolve();

        const tags = await provider.provideWorkspaceSymbols('', new CancellationTokenSource().token);

        expect(tags).to.be.lengthOf(0);
        verify(commandManager.executeCommand(Commands.Build_Workspace_Symbols, true, anything())).once();
    });
    test('Symbols should not be returned when disabled', async () => {
        const provider = new WorkspaceSymbolProvider(instance(fs), instance(commandManager), [instance(generator)]);
        const tagFilePath = 'existing tagFilePath';
        when(generator.tagFilePath).thenReturn(tagFilePath);
        when(generator.enabled).thenReturn(false);
        when(fs.fileExists(tagFilePath)).thenResolve(true);
        when(commandManager.executeCommand(Commands.Build_Workspace_Symbols, true, anything())).thenResolve();

        const tags = await provider.provideWorkspaceSymbols('', new CancellationTokenSource().token);

        expect(tags).to.be.lengthOf(0);
        verify(commandManager.executeCommand(Commands.Build_Workspace_Symbols, true, anything())).never();
    });
    test('symbols should be returned when enabled and vice versa', async () => {
        const provider = new WorkspaceSymbolProvider(instance(fs), instance(commandManager), [instance(generator)]);
        const tagFilePath = path.join(workspaceUri.fsPath, '.vscode', 'tags');
        when(generator.tagFilePath).thenReturn(tagFilePath);
        when(generator.workspaceFolder).thenReturn(workspaceUri);
        when(generator.enabled).thenReturn(true);
        when(fs.fileExists(tagFilePath)).thenResolve(true);
        when(commandManager.executeCommand(Commands.Build_Workspace_Symbols, true, anything())).thenResolve();

        const tags = await provider.provideWorkspaceSymbols('', new CancellationTokenSource().token);

        expect(tags.length).to.be.greaterThan(99);
        verify(commandManager.executeCommand(Commands.Build_Workspace_Symbols, true, anything())).never();
    });
    test('symbols should be filtered correctly', async () => {
        const provider = new WorkspaceSymbolProvider(instance(fs), instance(commandManager), [instance(generator)]);
        const tagFilePath = path.join(workspaceUri.fsPath, '.vscode', 'tags');
        when(generator.tagFilePath).thenReturn(tagFilePath);
        when(generator.workspaceFolder).thenReturn(workspaceUri);
        when(generator.enabled).thenReturn(true);
        when(fs.fileExists(tagFilePath)).thenResolve(true);
        when(commandManager.executeCommand(Commands.Build_Workspace_Symbols, true, anything())).thenResolve();

        const symbols = await provider.provideWorkspaceSymbols('meth1Of', new CancellationTokenSource().token);

        expect(symbols).to.be.length.greaterThan(0);
        verify(commandManager.executeCommand(Commands.Build_Workspace_Symbols, true, anything())).never();

        assert.equal(symbols.length >= 2, true, 'Incorrect number of symbols returned');
        assert.notEqual(
            symbols.findIndex((sym) => sym.location.uri.fsPath.endsWith('childFile.py')),
            -1,
            'File with symbol not found in child workspace folder',
        );
        assert.notEqual(
            symbols.findIndex((sym) => sym.location.uri.fsPath.endsWith('workspace2File.py')),
            -1,
            'File with symbol not found in child workspace folder',
        );

        const symbolsForMeth = await provider.provideWorkspaceSymbols('meth', new CancellationTokenSource().token);
        assert.equal(symbolsForMeth.length >= 10, true, 'Incorrect number of symbols returned');
        assert.notEqual(
            symbolsForMeth.findIndex((sym) => sym.location.uri.fsPath.endsWith('childFile.py')),
            -1,
            'Symbols not returned for childFile.py',
        );
        assert.notEqual(
            symbolsForMeth.findIndex((sym) => sym.location.uri.fsPath.endsWith('workspace2File.py')),
            -1,
            'Symbols not returned for workspace2File.py',
        );
        assert.notEqual(
            symbolsForMeth.findIndex((sym) => sym.location.uri.fsPath.endsWith('file.py')),
            -1,
            'Symbols not returned for file.py',
        );
    });
});
