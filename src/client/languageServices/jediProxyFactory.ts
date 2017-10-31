import { Disposable, Uri, workspace } from 'vscode';
import { JediProxy, JediProxyHandler, ICommandResult } from '../providers/jediProxy';

export class JediFactory implements Disposable {
    private disposables: Disposable[];
    private jediProxyHandlers: Map<string, JediProxyHandler<ICommandResult>>;

    constructor(private extensionRootPath: string) {
        this.disposables = [];
        this.jediProxyHandlers = new Map<string, JediProxyHandler<ICommandResult>>();
    }

    public dispose() {
        this.disposables.forEach(disposable => disposable.dispose());
        this.disposables = [];
    }
    public getJediProxyHandler<T extends ICommandResult>(resource: Uri): JediProxyHandler<T> {
        const workspaceFolder = workspace.getWorkspaceFolder(resource);
        let workspacePath = workspaceFolder ? workspaceFolder.uri.fsPath : undefined;
        if (!workspacePath) {
            if (Array.isArray(workspace.workspaceFolders) && workspace.workspaceFolders.length > 0) {
                workspacePath = workspace.workspaceFolders[0].uri.fsPath;
            }
            else {
                workspacePath = __dirname;
            }
        }

        if (!this.jediProxyHandlers.has(workspacePath)) {
            const jediProxy = new JediProxy(this.extensionRootPath, workspacePath);
            const jediProxyHandler = new JediProxyHandler(jediProxy);
            this.disposables.push(jediProxy, jediProxyHandler);
            this.jediProxyHandlers.set(workspacePath, jediProxyHandler);
        }
        // tslint:disable-next-line:no-non-null-assertion
        return this.jediProxyHandlers.get(workspacePath)! as JediProxyHandler<T>;
    }
}
