import * as assert from 'assert';
import * as path from 'path';
import { CancellationTokenSource, ConfigurationTarget, Uri } from 'vscode';
import { ICommandManager } from '../../client/common/application/types';
import { IFileSystem } from '../../client/common/platform/types';
import { IProcessServiceFactory } from '../../client/common/process/types';
import { Generator } from '../../client/workspaceSymbols/generator';
import { WorkspaceSymbolProvider } from '../../client/workspaceSymbols/provider';
import { closeActiveWindows, initialize, initializeTest, IS_MULTI_ROOT_TEST } from '../initialize';
import { MockOutputChannel } from '../mockClasses';
import { UnitTestIocContainer } from '../unittests/serviceRegistry';
import { updateSetting } from './../common';

const multirootPath = path.join(__dirname, '..', '..', '..', 'src', 'testMultiRootWkspc');

suite('Multiroot Workspace Symbols', () => {
    let ioc: UnitTestIocContainer;
    let processServiceFactory: IProcessServiceFactory;
    suiteSetup(function () {
        if (!IS_MULTI_ROOT_TEST) {
            // tslint:disable-next-line:no-invalid-this
            this.skip();
        }
        return initialize();
    });
    setup(async () => {
        initializeDI();
        await initializeTest();
    });
    suiteTeardown(closeActiveWindows);
    teardown(async () => {
        ioc.dispose();
        await closeActiveWindows();
        await updateSetting('workspaceSymbols.enabled', false, Uri.file(path.join(multirootPath, 'parent', 'child')), ConfigurationTarget.WorkspaceFolder);
        await updateSetting('workspaceSymbols.enabled', false, Uri.file(path.join(multirootPath, 'workspace2')), ConfigurationTarget.WorkspaceFolder);
    });
    function initializeDI() {
        ioc = new UnitTestIocContainer();
        ioc.registerCommonTypes();
        ioc.registerVariableTypes();
        ioc.registerProcessTypes();
        processServiceFactory = ioc.serviceContainer.get<IProcessServiceFactory>(IProcessServiceFactory);
    }

    test('symbols should be returned when enabeld and vice versa', async () => {
        const childWorkspaceUri = Uri.file(path.join(multirootPath, 'parent', 'child'));
        const outputChannel = new MockOutputChannel('Output');

        await updateSetting('workspaceSymbols.enabled', false, childWorkspaceUri, ConfigurationTarget.WorkspaceFolder);

        let generator = new Generator(childWorkspaceUri, outputChannel, processServiceFactory);
        let provider = new WorkspaceSymbolProvider(
            ioc.serviceContainer.get<IFileSystem>(IFileSystem),
            ioc.serviceContainer.get<ICommandManager>(ICommandManager),
            [generator]);
        let symbols = await provider.provideWorkspaceSymbols('', new CancellationTokenSource().token);
        assert.equal(symbols.length, 0, 'Symbols returned even when workspace symbols are turned off');
        generator.dispose();

        await updateSetting('workspaceSymbols.enabled', true, childWorkspaceUri, ConfigurationTarget.WorkspaceFolder);

        generator = new Generator(childWorkspaceUri, outputChannel, processServiceFactory);
        provider = new WorkspaceSymbolProvider(
            ioc.serviceContainer.get<IFileSystem>(IFileSystem),
            ioc.serviceContainer.get<ICommandManager>(ICommandManager),
            [generator]);
        symbols = await provider.provideWorkspaceSymbols('', new CancellationTokenSource().token);
        assert.notEqual(symbols.length, 0, 'Symbols should be returned when workspace symbols are turned on');
    });
    test('symbols should be filtered correctly', async () => {
        const childWorkspaceUri = Uri.file(path.join(multirootPath, 'parent', 'child'));
        const workspace2Uri = Uri.file(path.join(multirootPath, 'workspace2'));
        const outputChannel = new MockOutputChannel('Output');

        await updateSetting('workspaceSymbols.enabled', true, childWorkspaceUri, ConfigurationTarget.WorkspaceFolder);
        await updateSetting('workspaceSymbols.enabled', true, workspace2Uri, ConfigurationTarget.WorkspaceFolder);

        const generators = [
            new Generator(childWorkspaceUri, outputChannel, processServiceFactory),
            new Generator(workspace2Uri, outputChannel, processServiceFactory)];
        const provider = new WorkspaceSymbolProvider(
            ioc.serviceContainer.get<IFileSystem>(IFileSystem),
            ioc.serviceContainer.get<ICommandManager>(ICommandManager),
            generators);
        const symbols = await provider.provideWorkspaceSymbols('meth1Of', new CancellationTokenSource().token);

        assert.equal(symbols.length, 2, 'Incorrect number of symbols returned');
        assert.notEqual(symbols.findIndex(sym => sym.location.uri.fsPath.endsWith('childFile.py')), -1, 'File with symbol not found in child workspace folder');
        assert.notEqual(symbols.findIndex(sym => sym.location.uri.fsPath.endsWith('workspace2File.py')), -1, 'File with symbol not found in child workspace folder');
    });
});
