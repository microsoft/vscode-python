import * as assert from 'assert';
import * as path from 'path';
import { CancellationTokenSource, ConfigurationTarget, Uri } from 'vscode';
import { ICommandManager } from '../../client/common/application/types';
import { PythonSettings } from '../../client/common/configSettings';
import { IFileSystem } from '../../client/common/platform/types';
import { IProcessServiceFactory } from '../../client/common/process/types';
import { Generator } from '../../client/workspaceSymbols/generator';
import { WorkspaceSymbolProvider } from '../../client/workspaceSymbols/provider';
import { closeActiveWindows, initialize, initializeTest, IS_MULTI_ROOT_TEST } from '../initialize';
import { MockOutputChannel } from '../mockClasses';
import { UnitTestIocContainer } from '../unittests/serviceRegistry';
import { updateSetting } from './../common';

const workspaceUri = Uri.file(path.join(__dirname, '..', '..', '..', 'src', 'test'));
const configUpdateTarget = IS_MULTI_ROOT_TEST ? ConfigurationTarget.WorkspaceFolder : ConfigurationTarget.Workspace;

suite('Workspace Symbols', () => {
    let ioc: UnitTestIocContainer;
    let processServiceFactory: IProcessServiceFactory;
    suiteSetup(initialize);
    suiteTeardown(closeActiveWindows);
    setup(async () => {
        initializeDI();
        await initializeTest();
    });
    teardown(async () => {
        ioc.dispose();
        await closeActiveWindows();
        await updateSetting('workspaceSymbols.enabled', false, workspaceUri, configUpdateTarget);
    });
    function initializeDI() {
        ioc = new UnitTestIocContainer();
        ioc.registerCommonTypes();
        ioc.registerVariableTypes();
        ioc.registerProcessTypes();
        processServiceFactory = ioc.serviceContainer.get<IProcessServiceFactory>(IProcessServiceFactory);
    }

    test('symbols should be returned when enabeld and vice versa', async () => {
        const outputChannel = new MockOutputChannel('Output');
        await updateSetting('workspaceSymbols.enabled', false, workspaceUri, configUpdateTarget);

        // The workspace will be in the output test folder
        // So lets modify the settings so it sees the source test folder
        let settings = PythonSettings.getInstance(workspaceUri);
        settings.workspaceSymbols!.tagFilePath = path.join(workspaceUri.fsPath, '.vscode', 'tags');

        let generator = new Generator(workspaceUri, outputChannel, processServiceFactory);
        let provider = new WorkspaceSymbolProvider(
            ioc.serviceContainer.get<IFileSystem>(IFileSystem),
            ioc.serviceContainer.get<ICommandManager>(ICommandManager),
            [generator]);
        let symbols = await provider.provideWorkspaceSymbols('', new CancellationTokenSource().token);
        assert.equal(symbols.length, 0, 'Symbols returned even when workspace symbols are turned off');
        generator.dispose();

        await updateSetting('workspaceSymbols.enabled', true, workspaceUri, configUpdateTarget);

        // The workspace will be in the output test folder
        // So lets modify the settings so it sees the source test folder
        settings = PythonSettings.getInstance(workspaceUri);
        settings.workspaceSymbols!.tagFilePath = path.join(workspaceUri.fsPath, '.vscode', 'tags');

        generator = new Generator(workspaceUri, outputChannel, processServiceFactory);
        provider = new WorkspaceSymbolProvider(
            ioc.serviceContainer.get<IFileSystem>(IFileSystem),
            ioc.serviceContainer.get<ICommandManager>(ICommandManager),
            [generator]);
        symbols = await provider.provideWorkspaceSymbols('', new CancellationTokenSource().token);
        assert.notEqual(symbols.length, 0, 'Symbols should be returned when workspace symbols are turned on');
    });
    test('symbols should be filtered correctly', async () => {
        const outputChannel = new MockOutputChannel('Output');

        await updateSetting('workspaceSymbols.enabled', true, workspaceUri, configUpdateTarget);

        // The workspace will be in the output test folder
        // So lets modify the settings so it sees the source test folder
        const settings = PythonSettings.getInstance(workspaceUri);
        settings.workspaceSymbols!.tagFilePath = path.join(workspaceUri.fsPath, '.vscode', 'tags');

        const generators = [new Generator(workspaceUri, outputChannel, processServiceFactory)];
        const provider = new WorkspaceSymbolProvider(
            ioc.serviceContainer.get<IFileSystem>(IFileSystem),
            ioc.serviceContainer.get<ICommandManager>(ICommandManager),
            generators);
        const symbols = await provider.provideWorkspaceSymbols('meth1Of', new CancellationTokenSource().token);

        assert.equal(symbols.length >= 2, true, 'Incorrect number of symbols returned');
        assert.notEqual(symbols.findIndex(sym => sym.location.uri.fsPath.endsWith('childFile.py')), -1, 'File with symbol not found in child workspace folder');
        assert.notEqual(symbols.findIndex(sym => sym.location.uri.fsPath.endsWith('workspace2File.py')), -1, 'File with symbol not found in child workspace folder');

        const symbolsForMeth = await provider.provideWorkspaceSymbols('meth', new CancellationTokenSource().token);
        assert.equal(symbolsForMeth.length >= 10, true, 'Incorrect number of symbols returned');
        assert.notEqual(symbolsForMeth.findIndex(sym => sym.location.uri.fsPath.endsWith('childFile.py')), -1, 'Symbols not returned for childFile.py');
        assert.notEqual(symbolsForMeth.findIndex(sym => sym.location.uri.fsPath.endsWith('workspace2File.py')), -1, 'Symbols not returned for workspace2File.py');
        assert.notEqual(symbolsForMeth.findIndex(sym => sym.location.uri.fsPath.endsWith('file.py')), -1, 'Symbols not returned for file.py');
    });
});
