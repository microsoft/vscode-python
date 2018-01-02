import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import { decorate, inject, injectable } from 'inversify';
import * as Rx from 'rxjs';
import { Disposable } from 'vscode';
import { ExecutionResult, IBufferDecoder, IProcessService, ObservableExecutionResult, Output, SpawnOptions } from '../../client/common/process/types';

type ExecObservableCallback = (result: Rx.Observable<Output<string>> | Output<string>) => void;
type ExecCallback = (result: ExecutionResult<string>) => void;

export const IOriginalProcessService = Symbol('IProcessService');

@injectable()
export class MockProcessService extends EventEmitter implements IProcessService {
    private observableResults: (Rx.Observable<Output<string>> | Output<string>)[] = [];
    constructor( @inject(IOriginalProcessService) private procService: IProcessService) {
        super();
    }
    public onExecObservable(handler: (file: string, args: string[], options: SpawnOptions, callback: ExecObservableCallback) => void) {
        this.on('execObservable', handler);
    }
    public execObservable(file: string, args: string[], options: SpawnOptions = {}): ObservableExecutionResult<string> {
        let value: Rx.Observable<Output<string>> | Output<string> | undefined;
        let valueReturned = false;
        this.emit('execObservable', file, args, options, (result: Rx.Observable<Output<string>> | Output<string>) => { value = result; valueReturned = true; });

        if (valueReturned) {
            const output = value as Output<string>;
            if (['stderr', 'stdout'].some(source => source === output.source)) {
                return {
                    // tslint:disable-next-line:no-any
                    proc: {} as any,
                    out: Rx.Observable.of(output)
                };
            } else {
                return {
                    // tslint:disable-next-line:no-any
                    proc: {} as any,
                    out: value as Rx.Observable<Output<string>>
                };
            }
        } else {
            return this.procService.execObservable(file, args, options);
        }
    }
    public onExec(handler: (file: string, args: string[], options: SpawnOptions, callback: ExecCallback) => void) {
        this.on('exec', handler);
    }
    public async exec(file: string, args: string[], options: SpawnOptions = {}): Promise<ExecutionResult<string>> {
        let value: ExecutionResult<string> | undefined;
        let valueReturned = false;
        this.emit('exec', file, args, options, (result: ExecutionResult<string>) => { value = result; valueReturned = true; });

        return valueReturned ? value : this.procService.exec(file, args, options);
    }
}
