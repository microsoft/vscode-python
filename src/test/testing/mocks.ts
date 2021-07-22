import { EventEmitter } from 'events';
import { injectable } from 'inversify';
import { CancellationToken, Disposable, Uri } from 'vscode';
import { createDeferred, Deferred } from '../../client/common/utils/async';
import {
    ITestDebugLauncher,
    ITestDiscoveryService,
    IUnitTestSocketServer,
    LaunchOptions,
    TestDiscoveryOptions,
    Tests,
} from '../../client/testing/common/types';

@injectable()
export class MockDebugLauncher implements ITestDebugLauncher, Disposable {
    public get launched(): Promise<boolean> {
        return this._launched.promise;
    }
    public get debuggerPromise(): Deferred<Tests> {
        return this._promise!;
    }
    public get cancellationToken(): CancellationToken {
        if (this._token === undefined) {
            throw Error('debugger not launched');
        }
        return this._token;
    }

    private _launched: Deferred<boolean>;

    private _promise?: Deferred<Tests>;

    private _token?: CancellationToken;
    constructor() {
        this._launched = createDeferred<boolean>();
    }
    public async getLaunchOptions(_resource?: Uri): Promise<{ port: number; host: string }> {
        return { port: 0, host: 'localhost' };
    }
    public async launchDebugger(options: LaunchOptions): Promise<void> {
        this._launched.resolve(true);

        this._token = options.token!;
        this._promise = createDeferred<Tests>();

        options.token!.onCancellationRequested(() => {
            if (this._promise) {
                this._promise.reject('Mock-User Cancelled');
            }
        });
        return (this._promise.promise as {}) as Promise<void>;
    }
    public dispose() {
        this._promise = undefined;
    }
}

@injectable()
export class MockDiscoveryService implements ITestDiscoveryService {
    constructor(private discoverPromise: Promise<Tests>) {}
    public async discoverTests(_options: TestDiscoveryOptions): Promise<Tests> {
        return this.discoverPromise;
    }
}

@injectable()
export class MockUnitTestSocketServer extends EventEmitter implements IUnitTestSocketServer {
    private results: {}[] = [];
    public reset() {
        this.removeAllListeners();
    }
    public addResults(results: {}[]) {
        this.results.push(...results);
    }
    public async start(options: { port: number; host: string } = { port: 0, host: 'localhost' }): Promise<number> {
        this.results.forEach((result) => {
            this.emit('result', result);
        });
        this.results = [];
        return typeof options.port === 'number' ? options.port! : 0;
    }

    public stop(): void {}

    public dispose() {}
}
