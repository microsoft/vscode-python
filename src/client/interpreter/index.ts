'use strict';
import * as path from 'path';
import { ConfigurationTarget, Disposable, StatusBarAlignment, Uri, window, workspace } from 'vscode';
import { PythonSettings } from '../common/configSettings';
import { PythonPathUpdaterService } from './configuration/pythonPathUpdaterService';
import { PythonPathUpdaterServiceFactory } from './configuration/pythonPathUpdaterServiceFactory';
import { InterpreterDisplay } from './display';
import { getActiveWorkspaceUri } from './helpers';
import { InterpreterVersionService } from './interpreterVersion';
import { PythonInterpreterLocatorService } from './locators';
import { VirtualEnvironmentManager } from './virtualEnvs/index';
import { VEnv } from './virtualEnvs/venv';
import { VirtualEnv } from './virtualEnvs/virtualEnv';

export class InterpreterManager implements Disposable {
    private disposables: Disposable[] = [];
    private display: InterpreterDisplay | null | undefined;
    private interpreterProvider: PythonInterpreterLocatorService;
    private pythonPathUpdaterService: PythonPathUpdaterService;
    constructor() {
        const virtualEnvMgr = new VirtualEnvironmentManager([new VEnv(), new VirtualEnv()]);
        const statusBar = window.createStatusBarItem(StatusBarAlignment.Left);
        this.interpreterProvider = new PythonInterpreterLocatorService(virtualEnvMgr);
        const versionService = new InterpreterVersionService();
        this.display = new InterpreterDisplay(statusBar, this.interpreterProvider, virtualEnvMgr, versionService);
        const interpreterVersionService = new InterpreterVersionService();
        this.pythonPathUpdaterService = new PythonPathUpdaterService(new PythonPathUpdaterServiceFactory(), interpreterVersionService);
        PythonSettings.getInstance().addListener('change', () => this.onConfigChanged());
        this.disposables.push(window.onDidChangeActiveTextEditor(() => this.refresh()));
        this.disposables.push(statusBar);
        this.disposables.push(this.display);
    }
    public async refresh() {
        return this.display.refresh();
    }
    public getInterpreters(resource?: Uri) {
        return this.interpreterProvider.getInterpreters(resource);
    }
    public async autoSetInterpreter() {
        if (!this.shouldAutoSetInterpreter()) {
            return;
        }
        const activeWorkspace = getActiveWorkspaceUri();
        if (!activeWorkspace) {
            return;
        }
        const interpreters = await this.interpreterProvider.getInterpreters(activeWorkspace.folderUri);
        const workspacePathUpper = activeWorkspace.folderUri.fsPath.toUpperCase();
        const interpretersInWorkspace = interpreters.filter(interpreter => interpreter.path.toUpperCase().startsWith(workspacePathUpper));
        if (interpretersInWorkspace.length !== 1) {
            return;
        }

        // Ensure this new environment is at the same level as the current workspace.
        // In windows the interpreter is under scripts/python.exe on linux it is under bin/python.
        // Meaning the sub directory must be either scripts, bin or other (but only one level deep).
        const pythonPath = interpretersInWorkspace[0].path;
        const relativePath = path.dirname(pythonPath).substring(activeWorkspace.folderUri.fsPath.length);
        if (relativePath.split(path.sep).filter(l => l.length > 0).length === 2) {
            await this.pythonPathUpdaterService.updatePythonPath(pythonPath, activeWorkspace.configTarget, 'load', activeWorkspace.folderUri);
        }
    }
    public dispose(): void {
        // tslint:disable-next-line:prefer-type-cast
        this.disposables.forEach(disposable => disposable.dispose() as void);
        this.display = null;
        this.interpreterProvider.dispose();
    }
    private shouldAutoSetInterpreter() {
        const activeWorkspace = getActiveWorkspaceUri();
        if (!activeWorkspace) {
            return false;
        }
        const pythonConfig = workspace.getConfiguration('python', activeWorkspace.folderUri);
        const pythonPathInConfig = pythonConfig.inspect<string>('pythonPath');
        if (activeWorkspace.configTarget === ConfigurationTarget.Workspace) {
            return pythonPathInConfig.workspaceValue === undefined || pythonPathInConfig.workspaceValue === 'python';
        }
        if (activeWorkspace.configTarget === ConfigurationTarget.WorkspaceFolder) {
            return pythonPathInConfig.workspaceFolderValue === undefined || pythonPathInConfig.workspaceFolderValue === 'python';
        }
        return false;
    }
    private onConfigChanged() {
        if (this.display) {
            this.display.refresh()
                .catch(ex => console.error('Python Extension: display.refresh', ex));
        }
    }
}
