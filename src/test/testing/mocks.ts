import { EventEmitter } from 'events';
import { injectable } from 'inversify';

import { IUnitTestSocketServer } from '../../client/testing/common/types';

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
