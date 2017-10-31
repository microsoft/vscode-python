import { Uri, workspace } from 'vscode';
import { ITestCollectionStorageService, Tests } from './types';

export class TestCollectionStorageService implements ITestCollectionStorageService {
    private testsIndexedByWorkspaceUri = new Map<string, Tests | null | undefined>();
    public getTests(wkspace: Uri): Tests | undefined {
        const workspaceFolder = this.getWorkspaceFolderPath(wkspace) || '';
        return this.testsIndexedByWorkspaceUri.has(workspaceFolder) ? this.testsIndexedByWorkspaceUri.get(workspaceFolder) : undefined;
    }
    public storeTests(wkspace: Uri, tests: Tests | null | undefined): void {
        const workspaceFolder = this.getWorkspaceFolderPath(wkspace) || '';
        this.testsIndexedByWorkspaceUri.set(workspaceFolder, tests);
    }
    public dispose() {
        this.testsIndexedByWorkspaceUri.clear();
    }
    private getWorkspaceFolderPath(resource: Uri): string | undefined {
        const folder = workspace.getWorkspaceFolder(resource);
        return folder ? folder.uri.path : undefined;
    }
}
