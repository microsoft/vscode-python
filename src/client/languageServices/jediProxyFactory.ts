import { Disposable, Uri, workspace } from 'vscode';

import { PythonInterpreter } from '../interpreter/contracts';
import { IServiceContainer } from '../ioc/types';
import { ICommandResult, JediProxy, JediProxyHandler } from '../providers/jediProxy';

export class JediFactory implements Disposable {
    private disposables: Disposable[];
    private jediProxyHandlers: Map<string, JediProxyHandler<ICommandResult>>;

    constructor(
        private interpreter: PythonInterpreter | undefined,
        // This is passed through to JediProxy().
        private serviceContainer: IServiceContainer
    ) {
        this.disposables = [];
        this.jediProxyHandlers = new Map<string, JediProxyHandler<ICommandResult>>();
    }

    public dispose() {
        this.disposables.forEach((disposable) => disposable.dispose());
        this.disposables = [];
    }

    public getJediProxyHandler<T extends ICommandResult>(resource?: Uri): JediProxyHandler<T> {
        const workspacePath = this.getWorkspacePath(resource);
        if (!this.jediProxyHandlers.has(workspacePath)) {
            const jediProxy = new JediProxy(workspacePath, this.interpreter, this.serviceContainer);
            const jediProxyHandler = new JediProxyHandler(jediProxy);
            this.disposables.push(jediProxy, jediProxyHandler);
            this.jediProxyHandlers.set(workspacePath, jediProxyHandler);
        }
        return this.jediProxyHandlers.get(workspacePath)! as JediProxyHandler<T>;
    }

    private getWorkspacePath(resource?: Uri): string {
        if (resource) {
            const workspaceFolder = workspace.getWorkspaceFolder(resource);
            if (workspaceFolder) {
                return workspaceFolder.uri.fsPath;
            }
        }

        if (Array.isArray(workspace.workspaceFolders) && workspace.workspaceFolders.length > 0) {
            return workspace.workspaceFolders[0].uri.fsPath;
        } else {
            return __dirname;
        }
    }
}
