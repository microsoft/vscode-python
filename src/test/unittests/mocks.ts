import { CancellationToken, Disposable, OutputChannel } from 'vscode';
import { createDeferred, Deferred } from '../../client/common/helpers';
import { ITestDebugLauncher, Tests } from '../../client/unittests/common/types';

export class MockDebugLauncher implements ITestDebugLauncher, Disposable {
    public get launched(): Promise<boolean> {
        return this._launched.promise;
    }
    public get debuggerPromise(): Deferred<Tests> {
        return this._promise;
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
    public async launchDebugger(rootDirectory: string, testArgs: string[], token?: CancellationToken, outChannel?: OutputChannel): Promise<Tests> {
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
