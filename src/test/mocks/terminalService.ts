import { injectable } from 'inversify';
import { createDeferred, Deferred } from '../../client/common/helpers';
import { ITerminalService, TerminalShellType } from '../../client/common/terminal/types';

@injectable()
export class MockTerminalService implements ITerminalService {
    private deferred: Deferred<string>;
    private _textSent: string;
    constructor() {
        this.deferred = createDeferred<string>(this);
    }
    public get commandSent(): Promise<string> {
        return this.deferred.promise;
    }
    public get textSent(): Promise<string> {
        return Promise.resolve(this._textSent);
    }
    public getShellType(): TerminalShellType {
        return TerminalShellType.other;
    }
    public sendCommand(command: string, args: string[]): Promise<void> {
        return this.deferred.resolve(`${command} ${args.join(' ')}`.trim());
    }
    public async sendText(text: string): Promise<void> {
        this._textSent = text;
    }
}
