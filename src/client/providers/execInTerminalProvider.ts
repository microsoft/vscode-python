'use strict';
import * as fs from 'fs-extra';
import { EOL } from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { Disposable, workspace } from 'vscode';
import * as settings from '../common/configSettings';
import { Commands, PythonLanguage } from '../common/constants';
import { ContextKey } from '../common/contextKey';
import { sendTelemetryEvent } from '../common/telemetry';
import { EXECUTION_CODE, EXECUTION_DJANGO } from '../common/telemetry/constants';
import { IS_WINDOWS } from '../common/utils';

let terminal: vscode.Terminal;
export function activateExecInTerminalProvider(): vscode.Disposable[] {
    const disposables: vscode.Disposable[] = [];
    disposables.push(vscode.commands.registerCommand(Commands.Exec_In_Terminal, execInTerminal));
    disposables.push(vscode.commands.registerCommand(Commands.Exec_Selection_In_Terminal, execSelectionInTerminal));
    disposables.push(vscode.commands.registerCommand(Commands.Exec_Selection_In_Django_Shell, execSelectionInDjangoShell));
    disposables.push(vscode.window.onDidCloseTerminal((closedTermina: vscode.Terminal) => {
        if (terminal === closedTermina) {
            terminal = null;
        }
    }));
    disposables.push(new DjangoContextInitializer());
    return disposables;
}

function removeBlankLines(code: string): string {
    const codeLines = code.split(/\r?\n/g);
    const codeLinesWithoutEmptyLines = codeLines.filter(line => line.trim().length > 0);
    const lastLineIsEmpty = codeLines.length > 0 && codeLines[codeLines.length - 1].trim().length === 0;
    if (lastLineIsEmpty) {
        codeLinesWithoutEmptyLines.unshift('');
    }
    return codeLinesWithoutEmptyLines.join(EOL);
}
function execInTerminal(fileUri?: vscode.Uri) {
    const terminalShellSettings = vscode.workspace.getConfiguration('terminal.integrated.shell');
    // tslint:disable-next-line:no-backbone-get-set-outside-model
    const IS_POWERSHELL = /powershell/.test(terminalShellSettings.get<string>('windows'));

    const pythonSettings = settings.PythonSettings.getInstance(fileUri);
    let filePath: string;

    let currentPythonPath = pythonSettings.pythonPath;
    if (currentPythonPath.indexOf(' ') > 0) {
        currentPythonPath = `"${currentPythonPath}"`;
    }

    if (fileUri === undefined || fileUri === null || typeof fileUri.fsPath !== 'string') {
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor !== undefined) {
            if (!activeEditor.document.isUntitled) {
                if (activeEditor.document.languageId === PythonLanguage.language) {
                    filePath = activeEditor.document.fileName;
                } else {
                    vscode.window.showErrorMessage('The active file is not a Python source file');
                    return;
                }
            } else {
                vscode.window.showErrorMessage('The active file needs to be saved before it can be run');
                return;
            }
        } else {
            vscode.window.showErrorMessage('No open file to run in terminal');
            return;
        }
    } else {
        filePath = fileUri.fsPath;
    }

    if (filePath.indexOf(' ') > 0) {
        filePath = `"${filePath}"`;
    }
    terminal = terminal ? terminal : vscode.window.createTerminal('Python');
    if (pythonSettings.terminal && pythonSettings.terminal.executeInFileDir) {
        const fileDirPath = path.dirname(filePath);
        const wkspace = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(filePath));
        if (wkspace && fileDirPath !== wkspace.uri.fsPath && fileDirPath.substring(1) !== wkspace.uri.fsPath) {
            terminal.sendText(`cd "${fileDirPath}"`);
        }
    }
    const launchArgs = settings.PythonSettings.getInstance(fileUri).terminal.launchArgs;
    const launchArgsString = launchArgs.length > 0 ? ' '.concat(launchArgs.join(' ')) : '';
    const command = `${currentPythonPath}${launchArgsString} ${filePath}`;
    if (IS_WINDOWS) {
        const commandWin = command.replace(/\\/g, '/');
        if (IS_POWERSHELL) {
            terminal.sendText(`& ${commandWin}`);
        } else {
            terminal.sendText(commandWin);
        }
    } else {
        terminal.sendText(command);
    }
    terminal.show();
    sendTelemetryEvent(EXECUTION_CODE, undefined, { scope: 'file' });
}

function execSelectionInTerminal() {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
        return;
    }

    const terminalShellSettings = vscode.workspace.getConfiguration('terminal.integrated.shell');
    // tslint:disable-next-line:no-backbone-get-set-outside-model
    const IS_POWERSHELL = /powershell/.test(terminalShellSettings.get<string>('windows'));

    let currentPythonPath = settings.PythonSettings.getInstance(activeEditor.document.uri).pythonPath;
    if (currentPythonPath.indexOf(' ') > 0) {
        currentPythonPath = `"${currentPythonPath}"`;
    }

    const selection = vscode.window.activeTextEditor.selection;
    let code: string;
    if (selection.isEmpty) {
        code = vscode.window.activeTextEditor.document.lineAt(selection.start.line).text;
    } else {
        const textRange = new vscode.Range(selection.start, selection.end);
        code = vscode.window.activeTextEditor.document.getText(textRange);
    }
    if (code.length === 0) {
        return;
    }
    code = removeBlankLines(code);
    const launchArgs = settings.PythonSettings.getInstance(activeEditor.document.uri).terminal.launchArgs;
    const launchArgsString = launchArgs.length > 0 ? ' '.concat(launchArgs.join(' ')) : '';
    const command = `${currentPythonPath}${launchArgsString}`;
    if (!terminal) {
        terminal = vscode.window.createTerminal('Python');
        if (IS_WINDOWS) {
            const commandWin = command.replace(/\\/g, '/');
            if (IS_POWERSHELL) {
                terminal.sendText(`& ${commandWin}`);
            } else {
                terminal.sendText(commandWin);
            }
        } else {
            terminal.sendText(command);
        }
    }
    // tslint:disable-next-line:variable-name
    const unix_code = code.replace(/\r\n/g, '\n');
    if (IS_WINDOWS) {
        terminal.sendText(unix_code.replace(/\n/g, '\r\n'));
    } else {
        terminal.sendText(unix_code);
    }
    terminal.show();
    sendTelemetryEvent(EXECUTION_CODE, undefined, { scope: 'selection' });
}

function execSelectionInDjangoShell() {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
        return;
    }

    const terminalShellSettings = vscode.workspace.getConfiguration('terminal.integrated.shell');
    // tslint:disable-next-line:no-backbone-get-set-outside-model
    const IS_POWERSHELL = /powershell/.test(terminalShellSettings.get<string>('windows'));

    let currentPythonPath = settings.PythonSettings.getInstance(activeEditor.document.uri).pythonPath;
    if (currentPythonPath.indexOf(' ') > 0) {
        currentPythonPath = `"${currentPythonPath}"`;
    }

    const workspaceUri = vscode.workspace.getWorkspaceFolder(activeEditor.document.uri);
    const defaultWorkspace = Array.isArray(vscode.workspace.workspaceFolders) && vscode.workspace.workspaceFolders.length > 0 ? vscode.workspace.workspaceFolders[0].uri.fsPath : '';
    const workspaceRoot = workspaceUri ? workspaceUri.uri.fsPath : defaultWorkspace;
    const djangoShellCmd = `"${path.join(workspaceRoot, 'manage.py')}" shell`;
    const selection = vscode.window.activeTextEditor.selection;
    let code: string;
    if (selection.isEmpty) {
        code = vscode.window.activeTextEditor.document.lineAt(selection.start.line).text;
    } else {
        const textRange = new vscode.Range(selection.start, selection.end);
        code = vscode.window.activeTextEditor.document.getText(textRange);
    }
    if (code.length === 0) {
        return;
    }
    const launchArgs = settings.PythonSettings.getInstance(activeEditor.document.uri).terminal.launchArgs;
    const launchArgsString = launchArgs.length > 0 ? ' '.concat(launchArgs.join(' ')) : '';
    const command = `${currentPythonPath}${launchArgsString} ${djangoShellCmd}`;
    if (!terminal) {
        terminal = vscode.window.createTerminal('Django Shell');
        if (IS_WINDOWS) {
            const commandWin = command.replace(/\\/g, '/');
            if (IS_POWERSHELL) {
                terminal.sendText(`& ${commandWin}`);
            } else {
                terminal.sendText(commandWin);
            }
        } else {
            terminal.sendText(command);
        }
    }
    // tslint:disable-next-line:variable-name
    const unix_code = code.replace(/\r\n/g, '\n');
    if (IS_WINDOWS) {
        terminal.sendText(unix_code.replace(/\n/g, '\r\n'));
    } else {
        terminal.sendText(unix_code);
    }
    terminal.show();
    sendTelemetryEvent(EXECUTION_DJANGO);
}

class DjangoContextInitializer implements vscode.Disposable {
    private isDjangoProject: ContextKey;
    private monitoringActiveTextEditor: boolean;
    private workspaceContextKeyValues = new Map<string, boolean>();
    private lastCheckedWorkspace: string;
    private disposables: Disposable[] = [];
    constructor() {
        this.isDjangoProject = new ContextKey('python.isDjangoProject');
        this.ensureState();
        this.disposables.push(vscode.workspace.onDidChangeWorkspaceFolders(() => this.updateContextKeyBasedOnActiveWorkspace()));
    }

    public dispose() {
        this.isDjangoProject = null;
        this.disposables.forEach(disposable => disposable.dispose());
    }
    private updateContextKeyBasedOnActiveWorkspace() {
        if (this.monitoringActiveTextEditor) {
            return;
        }
        this.monitoringActiveTextEditor = true;
        this.disposables.push(vscode.window.onDidChangeActiveTextEditor(() => this.ensureState()));
    }
    private getActiveWorkspace(): string | undefined {
        if (!Array.isArray(workspace.workspaceFolders || workspace.workspaceFolders.length === 0)) {
            return undefined;
        }
        if (workspace.workspaceFolders.length === 1) {
            return workspace.workspaceFolders[0].uri.fsPath;
        }
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) {
            return undefined;
        }
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(activeEditor.document.uri);
        return workspaceFolder ? workspaceFolder.uri.fsPath : undefined;
    }
    private async ensureState(): Promise<void> {
        const activeWorkspace = this.getActiveWorkspace();
        if (!activeWorkspace) {
            return await this.isDjangoProject.set(false);
        }
        if (this.lastCheckedWorkspace === activeWorkspace) {
            return;
        }
        if (this.workspaceContextKeyValues.has(activeWorkspace)) {
            await this.isDjangoProject.set(this.workspaceContextKeyValues.get(activeWorkspace));
        } else {
            const exists = await fs.pathExists(path.join(activeWorkspace, 'manage.py'));
            await this.isDjangoProject.set(exists);
            this.workspaceContextKeyValues.set(activeWorkspace, exists);
            this.lastCheckedWorkspace = activeWorkspace;
        }
    }
}
