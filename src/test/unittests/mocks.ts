import { CancellationToken, Disposable, OutputChannel, Uri } from 'vscode';
import { createDeferred, Deferred } from '../../client/common/helpers';
import { Product } from '../../client/common/installer';
import { BaseTestManager } from '../../client/unittests/common/baseTestManager';
import { CANCELLATION_REASON } from '../../client/unittests/common/constants';
import { ITestCollectionStorageService, ITestDebugLauncher, ITestResultsService, ITestsHelper, Tests, TestsToRun } from '../../client/unittests/common/types';

export class MockDebugLauncher implements ITestDebugLauncher, Disposable {
    public get launched(): Promise<boolean> {
        return this._launched.promise;
    }
    public get debuggerPromise(): Deferred<Tests> {
        // tslint:disable-next-line:no-non-null-assertion
        return this._promise!;
    }
    public get cancellationToken(): CancellationToken {
        return this._token;
    }
    // tslint:disable-next-line:variable-name
    private _launched: Deferred<boolean>;
    // tslint:disable-next-line:variable-name
    private _promise?: Deferred<Tests>;
    // tslint:disable-next-line:variable-name
    private _token: CancellationToken;
    constructor() {
        this._launched = createDeferred<boolean>();
    }
    public async getPort(resource?: Uri): Promise<number> {
        return 0;
    }
    public async launchDebugger(rootDirectory: string, testArgs: string[], debugPort: number, token?: CancellationToken, outChannel?: OutputChannel): Promise<Tests> {
        this._launched.resolve(true);
        // tslint:disable-next-line:no-non-null-assertion
        this._token = token!;
        this._promise = createDeferred<Tests>();
        // tslint:disable-next-line:no-non-null-assertion
        token!.onCancellationRequested(() => {
            if (this._promise) {
                this._promise.reject('Mock-User Cancelled');
            }
        });
        return this._promise.promise;
    }
    public dispose() {
        this._promise = undefined;
    }
}

export class MockTestManagerWithRunningTests extends BaseTestManager {
    // tslint:disable-next-line:no-any
    public readonly runnerDeferred = createDeferred<any>();
    // tslint:disable-next-line:no-any
    public readonly discoveryDeferred = createDeferred<Tests>();
    constructor(testRunnerId: 'nosetest' | 'pytest' | 'unittest', product: Product, rootDirectory: string,
        outputChannel: OutputChannel, storageService: ITestCollectionStorageService, resultsService: ITestResultsService, testsHelper: ITestsHelper) {
        super('nosetest', product, rootDirectory, outputChannel, storageService, resultsService, testsHelper);
    }
    // tslint:disable-next-line:no-any
    protected async runTestImpl(tests: Tests, testsToRun?: TestsToRun, runFailedTests?: boolean, debug?: boolean): Promise<any> {
        // tslint:disable-next-line:no-non-null-assertion
        this.testRunnerCancellationToken!.onCancellationRequested(() => {
            this.runnerDeferred.reject(CANCELLATION_REASON);
        });
        return this.runnerDeferred.promise;
    }
    protected async discoverTestsImpl(ignoreCache: boolean, debug?: boolean): Promise<Tests> {
        // tslint:disable-next-line:no-non-null-assertion
        this.testDiscoveryCancellationToken!.onCancellationRequested(() => {
            this.discoveryDeferred.reject(CANCELLATION_REASON);
        });
        return this.discoveryDeferred.promise;
    }
}
