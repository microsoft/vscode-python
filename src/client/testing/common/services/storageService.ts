import { inject, injectable } from 'inversify';
import { Disposable, Event, EventEmitter, Uri } from 'vscode';
import { IWorkspaceService } from '../../../common/application/types';
import { IDisposableRegistry } from '../../../common/types';
import { TestDataItem } from '../../types';
import { FlattenedTestFunction, FlattenedTestSuite, ITestCollectionStorageService, TestFunction, Tests, TestSuite } from './../types';

@injectable()
export class TestCollectionStorageService implements ITestCollectionStorageService {
    private readonly _onDidChange = new EventEmitter<{ uri: Uri; data?: TestDataItem }>();
    private readonly testsIndexedByWorkspaceUri = new Map<string, Tests | undefined>();

    constructor(@inject(IDisposableRegistry) disposables: Disposable[], @inject(IWorkspaceService) private readonly workspaceService: IWorkspaceService) {
        disposables.push(this);
    }
    public get onDidChange(): Event<{ uri: Uri; data?: TestDataItem }> {
        return this._onDidChange.event;
    }
    public getTests(resource: Uri): Tests | undefined {
        const workspaceFolder = this.workspaceService.getWorkspaceFolderIdentifier(resource);
        return this.testsIndexedByWorkspaceUri.has(workspaceFolder) ? this.testsIndexedByWorkspaceUri.get(workspaceFolder) : undefined;
    }
    public storeTests(resource: Uri, tests: Tests | undefined): void {
        const workspaceFolder = this.workspaceService.getWorkspaceFolderIdentifier(resource);
        this.testsIndexedByWorkspaceUri.set(workspaceFolder, tests);
        this._onDidChange.fire({ uri: resource });
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
    public update(resource: Uri, item: TestDataItem): void {
        this._onDidChange.fire({ uri: resource, data: item });
    }
}
