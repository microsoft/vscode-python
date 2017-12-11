import { injectable } from 'inversify';
import 'reflect-metadata';
import { createDeferred, Deferred } from '../../client/common/helpers';
import { ITerminalService } from '../../client/common/terminal/types';

@injectable()
export class MockTerminalService implements ITerminalService {
    private deferred: Deferred<string>;
    constructor() {
        this.deferred = createDeferred<string>(this);
    }
    public get commandSent(): Promise<string> {
        return this.deferred.promise;
    }
    public sendCommand(command: string, args: string[]): Promise<void> {
        return this.deferred.resolve(`${command} ${args.join(' ')}`.trim());
    }
}
