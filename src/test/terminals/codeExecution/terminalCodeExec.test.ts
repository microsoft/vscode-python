// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// tslint:disable:no-multiline-string no-trailing-whitespace

import { expect } from 'chai';
import * as path from 'path';
import * as TypeMoq from 'typemoq';
import { Disposable, Uri, WorkspaceFolder } from 'vscode';
import { IWorkspaceService } from '../../../client/common/application/types';
import { IPlatformService } from '../../../client/common/platform/types';
import { ITerminalService, ITerminalServiceFactory } from '../../../client/common/terminal/types';
import { IConfigurationService, IPythonSettings, ITerminalSettings } from '../../../client/common/types';
import { TerminalCodeExecutionProvider } from '../../../client/terminals/codeExecution/terminalCodeExecution';
import { ICodeExecutionService } from '../../../client/terminals/types';

// tslint:disable-next-line:max-func-body-length
suite('Terminal - Code Execution', () => {
    let executor: ICodeExecutionService;
    let terminalSettings: TypeMoq.IMock<ITerminalSettings>;
    let terminalService: TypeMoq.IMock<ITerminalService>;
    let workspace: TypeMoq.IMock<IWorkspaceService>;
    let platform: TypeMoq.IMock<IPlatformService>;
    let workspaceFolder: TypeMoq.IMock<WorkspaceFolder>;
    let settings: TypeMoq.IMock<IPythonSettings>;
    let disposables: Disposable[] = [];
    setup(() => {
        const terminalFactory = TypeMoq.Mock.ofType<ITerminalServiceFactory>();
        terminalSettings = TypeMoq.Mock.ofType<ITerminalSettings>();
        terminalService = TypeMoq.Mock.ofType<ITerminalService>();
        const configService = TypeMoq.Mock.ofType<IConfigurationService>();
        workspace = TypeMoq.Mock.ofType<IWorkspaceService>();
        platform = TypeMoq.Mock.ofType<IPlatformService>();
        executor = new TerminalCodeExecutionProvider(terminalFactory.object, configService.object, workspace.object, disposables, platform.object);
        workspaceFolder = TypeMoq.Mock.ofType<WorkspaceFolder>();

        terminalFactory.setup(f => f.getTerminalService(TypeMoq.It.isAny())).returns(() => terminalService.object);

        settings = TypeMoq.Mock.ofType<IPythonSettings>();
        settings.setup(s => s.terminal).returns(() => terminalSettings.object);
        configService.setup(c => c.getSettings(TypeMoq.It.isAny())).returns(() => settings.object);
    });
    teardown(() => {
        disposables.forEach(disposable => {
            if (disposable) {
                disposable.dispose();
            }
        });

        disposables = [];
    });
    test('Ensure we set current directory before executing file', async () => {
        const file = Uri.file(path.join('c', 'path', 'to', 'file', 'one.py'));
        terminalSettings.setup(t => t.executeInFileDir).returns(() => true);
        workspace.setup(w => w.getWorkspaceFolder(TypeMoq.It.isAny())).returns(() => workspaceFolder.object);
        workspaceFolder.setup(w => w.uri).returns(() => Uri.file(path.join('c', 'path', 'to')));

        executor.executeFile(file);

        terminalService.verify(t => t.sendText(TypeMoq.It.isValue(`cd ${path.dirname(file.path)}`)), TypeMoq.Times.once());
    });

    test('Ensure we set current directory (and quote it when containing spaces) before executing file', async () => {
        const file = Uri.file(path.join('c', 'path', 'to', 'file with spaces in path', 'one.py'));
        terminalSettings.setup(t => t.executeInFileDir).returns(() => true);
        workspace.setup(w => w.getWorkspaceFolder(TypeMoq.It.isAny())).returns(() => workspaceFolder.object);
        workspaceFolder.setup(w => w.uri).returns(() => Uri.file(path.join('c', 'path', 'to')));

        executor.executeFile(file);

        terminalService.verify(t => t.sendText(TypeMoq.It.isValue(`cd "${path.dirname(file.path)}"`)), TypeMoq.Times.once());
    });

    test('Ensure we do not set current directory before executing file if in the same directory', async () => {
        const file = Uri.file(path.join('c', 'path', 'to', 'file with spaces in path', 'one.py'));
        terminalSettings.setup(t => t.executeInFileDir).returns(() => true);
        workspace.setup(w => w.getWorkspaceFolder(TypeMoq.It.isAny())).returns(() => workspaceFolder.object);
        workspaceFolder.setup(w => w.uri).returns(() => Uri.file(path.join('c', 'path', 'to', 'file with spaces in path')));

        executor.executeFile(file);

        terminalService.verify(t => t.sendText(TypeMoq.It.isAny()), TypeMoq.Times.never());
    });

    test('Ensure we do not set current directory before executing file if file is not in a workspace', async () => {
        const file = Uri.file(path.join('c', 'path', 'to', 'file with spaces in path', 'one.py'));
        terminalSettings.setup(t => t.executeInFileDir).returns(() => true);
        workspace.setup(w => w.getWorkspaceFolder(TypeMoq.It.isAny())).returns(() => undefined);

        executor.executeFile(file);

        terminalService.verify(t => t.sendText(TypeMoq.It.isAny()), TypeMoq.Times.never());
    });

    async function testFileExecution(isWindows: boolean, pythonPath: string, terminalArgs: string[], file: Uri) {
        platform.setup(p => p.isWindows).returns(() => isWindows);
        settings.setup(s => s.pythonPath).returns(() => pythonPath);
        terminalSettings.setup(t => t.launchArgs).returns(() => terminalArgs);
        terminalSettings.setup(t => t.executeInFileDir).returns(() => false);
        workspace.setup(w => w.getWorkspaceFolder(TypeMoq.It.isAny())).returns(() => undefined);

        await executor.executeFile(file);
        const expectedPythonPath = isWindows ? pythonPath.replace(/\\/g, '/') : pythonPath;
        const expectedArgs = terminalArgs.concat(file.fsPath.indexOf(' ') > 0 ? `"${file.fsPath}"` : file.fsPath);
        terminalService.verify(t => t.sendCommand(TypeMoq.It.isValue(expectedPythonPath), TypeMoq.It.isValue(expectedArgs)), TypeMoq.Times.once());
    }

    test('Ensure python file execution script is sent to terminal on windows', async () => {
        const file = Uri.file(path.join('c', 'path', 'to', 'file with spaces in path', 'one.py'));
        testFileExecution(true, 'python', [], file);
    });

    test('Ensure python file execution script is sent to terminal on windows with fully qualified python path', async () => {
        const file = Uri.file(path.join('c', 'path', 'to', 'file with spaces in path', 'one.py'));
        testFileExecution(true, 'c:\\program files\\python', [], file);
    });

    test('Ensure python file execution script is not quoted when no spaces in file path', async () => {
        const file = Uri.file(path.join('c', 'path', 'to', 'file', 'one.py'));
        testFileExecution(true, 'python', [], file);
    });

    test('Ensure python file execution script supports custom python arguments', async () => {
        const file = Uri.file(path.join('c', 'path', 'to', 'file', 'one.py'));
        testFileExecution(false, 'python', ['-a', '-b', '-c'], file);
    });

    function testReplCommandArguments(isWindows: boolean, pythonPath: string, expectedPythonPath: string, terminalArgs: string[]) {
        platform.setup(p => p.isWindows).returns(() => isWindows);
        settings.setup(s => s.pythonPath).returns(() => pythonPath);
        terminalSettings.setup(t => t.launchArgs).returns(() => terminalArgs);

        const replCommandArgs = (executor as TerminalCodeExecutionProvider).getReplCommandArgs();
        expect(replCommandArgs).not.to.be.an('undefined', 'Command args is undefined');
        expect(replCommandArgs.command).to.be.equal(expectedPythonPath, 'Incorrect python path');
        expect(replCommandArgs.args).to.be.deep.equal(terminalArgs, 'Incorrect arguments');
    }

    test('Ensure fully qualified python path is escaped when building repl args on Windows', async () => {
        const pythonPath = 'c:\\program files\\python\\python.exe';
        const terminalArgs = ['-a', 'b', 'c'];

        testReplCommandArguments(true, pythonPath, 'c:/program files/python/python.exe', terminalArgs);
    });

    test('Ensure fully qualified python path is returned as is, when building repl args on Windows', async () => {
        const pythonPath = 'c:/program files/python/python.exe';
        const terminalArgs = ['-a', 'b', 'c'];

        testReplCommandArguments(true, pythonPath, pythonPath, terminalArgs);
    });

    test('Ensure python path is returned as is, when building repl args on Windows', async () => {
        const pythonPath = 'python';
        const terminalArgs = ['-a', 'b', 'c'];

        testReplCommandArguments(true, pythonPath, pythonPath, terminalArgs);
    });

    test('Ensure fully qualified python path is returned as is, on non Windows', async () => {
        const pythonPath = 'usr/bin/python';
        const terminalArgs = ['-a', 'b', 'c'];

        testReplCommandArguments(false, pythonPath, pythonPath, terminalArgs);
    });

    test('Ensure python path is returned as is, on non Windows', async () => {
        const pythonPath = 'python';
        const terminalArgs = ['-a', 'b', 'c'];

        testReplCommandArguments(false, pythonPath, pythonPath, terminalArgs);
    });

    test('Ensure nothing happens when blank text is sent to the terminal', async () => {
        await executor.execute('');
        await executor.execute('   ');
        // tslint:disable-next-line:no-any
        await executor.execute(undefined as any as string);

        terminalService.verify(t => t.sendCommand(TypeMoq.It.isAny(), TypeMoq.It.isAny()), TypeMoq.Times.never());
        terminalService.verify(t => t.sendText(TypeMoq.It.isAny()), TypeMoq.Times.never());
    });

    test('Ensure repl is initialized once before sending text to the repl', async () => {
        const pythonPath = 'usr/bin/python1234';
        const terminalArgs = ['-a', 'b', 'c'];
        platform.setup(p => p.isWindows).returns(() => false);
        settings.setup(s => s.pythonPath).returns(() => pythonPath);
        terminalSettings.setup(t => t.launchArgs).returns(() => terminalArgs);

        await executor.execute('cmd1');
        await executor.execute('cmd2');
        await executor.execute('cmd3');

        terminalService.verify(t => t.sendCommand(TypeMoq.It.isValue(pythonPath), TypeMoq.It.isValue(terminalArgs)), TypeMoq.Times.once());
    });

    test('Ensure repl is re-initialized when temrinal is closed', async () => {
        const pythonPath = 'usr/bin/python1234';
        const terminalArgs = ['-a', 'b', 'c'];
        platform.setup(p => p.isWindows).returns(() => false);
        settings.setup(s => s.pythonPath).returns(() => pythonPath);
        terminalSettings.setup(t => t.launchArgs).returns(() => terminalArgs);

        let closeTerminalCallback: undefined | (() => void);
        terminalService.setup(t => t.onDidCloseTerminal(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns((callback => {
            closeTerminalCallback = callback;
            return {
                // tslint:disable-next-line:no-empty
                dispose: () => void 0
            };
        }));

        await executor.execute('cmd1');
        await executor.execute('cmd2');
        await executor.execute('cmd3');

        expect(closeTerminalCallback).not.to.be.an('undefined', 'Callback not initialized');
        terminalService.verify(t => t.sendCommand(TypeMoq.It.isValue(pythonPath), TypeMoq.It.isValue(terminalArgs)), TypeMoq.Times.once());

        closeTerminalCallback!.call(terminalService.object);
        await executor.execute('cmd4');
        terminalService.verify(t => t.sendCommand(TypeMoq.It.isValue(pythonPath), TypeMoq.It.isValue(terminalArgs)), TypeMoq.Times.exactly(2));

        closeTerminalCallback!.call(terminalService.object);
        await executor.execute('cmd5');
        terminalService.verify(t => t.sendCommand(TypeMoq.It.isValue(pythonPath), TypeMoq.It.isValue(terminalArgs)), TypeMoq.Times.exactly(3));
    });

    test('Ensure code is sent to terminal', async () => {
        const pythonPath = 'usr/bin/python1234';
        const terminalArgs = ['-a', 'b', 'c'];
        platform.setup(p => p.isWindows).returns(() => false);
        settings.setup(s => s.pythonPath).returns(() => pythonPath);
        terminalSettings.setup(t => t.launchArgs).returns(() => terminalArgs);

        await executor.execute('cmd1');
        terminalService.verify(t => t.sendText('cmd1'), TypeMoq.Times.once());

        await executor.execute('cmd2');
        terminalService.verify(t => t.sendText('cmd2'), TypeMoq.Times.once());
    });
});
