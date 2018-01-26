import { Disposable, Uri, workspace } from 'vscode';
import { IServiceContainer } from '../ioc/types';
import { ImportMagicProxy } from '../providers/importMagicProxy';

export class ImportMagicProxyFactory implements Disposable {
    private disposables: Disposable[];
    private proxyHandlers: Map<string, ImportMagicProxy>;

    constructor(private extensionRootPath: string, private serviceContainer: IServiceContainer) {
        this.disposables = [];
        this.proxyHandlers = new Map<string, ImportMagicProxy>();
    }

    public dispose() {
        this.disposables.forEach(disposable => disposable.dispose());
        this.disposables = [];
    }

    public getImportMagicProxy(resource: Uri): ImportMagicProxy {
        const workspaceFolder = workspace.getWorkspaceFolder(resource);
        let workspacePath = workspaceFolder ? workspaceFolder.uri.fsPath : undefined;
        if (!workspacePath) {
            if (Array.isArray(workspace.workspaceFolders) && workspace.workspaceFolders.length > 0) {
                workspacePath = workspace.workspaceFolders[0].uri.fsPath;
            } else {
                workspacePath = __dirname;
            }
        }

        let importMagic = this.proxyHandlers.get(workspacePath);

        if (!importMagic) {
            importMagic = new ImportMagicProxy(this.extensionRootPath, this.serviceContainer, workspacePath);
            this.disposables.push(importMagic);
            this.proxyHandlers.set(workspacePath, importMagic);
        }

        return importMagic;
    }
}
