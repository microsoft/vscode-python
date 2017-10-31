import { Disposable, OutputChannel, Uri, workspace } from 'vscode';
import { Product } from '../../common/installer';
import { BaseTestManager } from './baseTestManager';
import { TestManagerService } from './testManagerService';
import { ITestManagerService, ITestManagerServiceFactory, IWorkspaceTestManagerService, UnitTestProduct } from './types';

export class WorkspaceTestManagerService implements IWorkspaceTestManagerService, Disposable {
    private workspaceTestManagers = new Map<string, ITestManagerService>();
    private disposables: Disposable[] = [];
    constructor(private outChannel: OutputChannel,
        private testManagerServiceFactory: ITestManagerServiceFactory) {
    }
    public dispose() {
        this.workspaceTestManagers.forEach(info => info.dispose());
    }
    public getTestManager(resource: Uri): BaseTestManager | undefined {
        const wkspace = this.getWorkspace(resource);
        this.ensureTestManagerService(wkspace);
        return this.workspaceTestManagers.get(wkspace.fsPath).getTestManager();
    }
    public getTestWorkingDirectory(resource: Uri) {
        const wkspace = this.getWorkspace(resource);
        this.ensureTestManagerService(wkspace);
        return this.workspaceTestManagers.get(wkspace.fsPath).getTestWorkingDirectory();
    }
    public getPreferredTestManager(resource: Uri): UnitTestProduct {
        const wkspace = this.getWorkspace(resource);
        this.ensureTestManagerService(wkspace);
        return this.workspaceTestManagers.get(wkspace.fsPath).getPreferredTestManager();
    }
    private getWorkspace(resource: Uri): Uri {
        if (!Array.isArray(workspace.workspaceFolders) || workspace.workspaceFolders.length === 0) {
            const noWkspaceMessage = 'Please open a workspace';
            this.outChannel.appendLine(noWkspaceMessage);
            throw new Error(noWkspaceMessage);
        }
        if (!resource || workspace.workspaceFolders.length === 1) {
            return workspace.workspaceFolders[0].uri;
        }
        const workspaceFolder = workspace.getWorkspaceFolder(resource);
        if (workspaceFolder) {
            return workspaceFolder.uri;
        }
        const message = `Resource '${resource.fsPath}' does not belong to any workspace`;
        this.outChannel.appendLine(message);
        throw new Error(message);
    }
    private ensureTestManagerService(wkspace: Uri) {
        if (!this.workspaceTestManagers.has(wkspace.fsPath)) {
            this.workspaceTestManagers.set(wkspace.fsPath, this.testManagerServiceFactory.createTestManagerService(wkspace));
        }
    }
}
