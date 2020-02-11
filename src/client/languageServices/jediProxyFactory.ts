import { Disposable, Uri, workspace } from 'vscode';

import { PythonInterpreter } from '../interpreter/contracts';
import { IServiceContainer } from '../ioc/types';
import { ICommandResult, JediProxy, JediProxyHandler } from '../providers/jediProxy';

export class JediFactory implements Disposable {
    private disposables: Disposable[];
    private jediProxyHandlers: Map<string, JediProxyHandler<ICommandResult>>;

    constructor(
        private extensionRootPath: string,
        private interpreter: PythonInterpreter | undefined,
        private serviceContainer: IServiceContainer
    ) {
        this.disposables = [];
        this.jediProxyHandlers = new Map<string, JediProxyHandler<ICommandResult>>();
    }

    public dispose() {
        this.disposables.forEach(disposable => disposable.dispose());
        this.disposables = [];
    }
    public getJediProxyHandler<T extends ICommandResult>(resource?: Uri): JediProxyHandler<T> {
        const workspaceFolder = resource ? workspace.getWorkspaceFolder(resource) : undefined;
        let workspacePath = workspaceFolder ? workspaceFolder.uri.fsPath : undefined;
        if (!workspacePath) {
            if (Array.isArray(workspace.workspaceFolders) && workspace.workspaceFolders.length > 0) {
                workspacePath = workspace.workspaceFolders[0].uri.fsPath;
            } else {
                workspacePath = __dirname;
            }
        }

        if (!this.jediProxyHandlers.has(workspacePath)) {
            const jediProxy = new JediProxy(
                this.extensionRootPath,
                workspacePath,
                this.interpreter,
                this.serviceContainer
            );
            const jediProxyHandler = new JediProxyHandler(jediProxy);
            this.disposables.push(jediProxy, jediProxyHandler);
            this.jediProxyHandlers.set(workspacePath, jediProxyHandler);
        }
        // tslint:disable-next-line:no-non-null-assertion
        return this.jediProxyHandlers.get(workspacePath)! as JediProxyHandler<T>;
    }
}
