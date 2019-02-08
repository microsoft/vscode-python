import { inject, injectable } from 'inversify';
import { Disposable, Uri, workspace } from 'vscode';
import { IDisposableRegistry } from '../../../common/types';
import { FlattenedTestFunction, FlattenedTestSuite, ITestCollectionStorageService, TestFunction, Tests, TestSuite } from './../types';

@injectable()
export class TestCollectionStorageService implements ITestCollectionStorageService {

    private testsIndexedByWorkspaceUri = new Map<string, Tests | undefined>();

    constructor(@inject(IDisposableRegistry) disposables: Disposable[]) {
        disposables.push(this);
    }
    public getTests(wkspace: Uri): Tests | undefined {
        const workspaceFolder = this.getWorkspaceFolderPath(wkspace) || '';
        return this.testsIndexedByWorkspaceUri.has(workspaceFolder) ? this.testsIndexedByWorkspaceUri.get(workspaceFolder) : undefined;
    }
    public storeTests(wkspace: Uri, tests: Tests | undefined): void {
        const workspaceFolder = this.getWorkspaceFolderPath(wkspace) || '';
        this.testsIndexedByWorkspaceUri.set(workspaceFolder, tests);
    }
    public findFlattendTestFunction(resource: Uri, func: TestFunction): FlattenedTestFunction | undefined {
        const tests = this.getTests(resource);
        if (!tests) {
            return;
        }
        return tests.testFunctions.find(f => f.testFunction === func);
    }
    public findFlattendTestSuite(resource: Uri, suite: TestSuite): FlattenedTestSuite | undefined {
        const tests = this.getTests(resource);
        if (!tests) {
            return;
        }
        return tests.testSuites.find(f => f.testSuite === suite);
    }
    public dispose() {
        this.testsIndexedByWorkspaceUri.clear();
    }
    private getWorkspaceFolderPath(resource: Uri): string | undefined {
        const folder = workspace.getWorkspaceFolder(resource);
        return folder ? folder.uri.path : undefined;
    }
}
