import { EventEmitter } from 'events';
import 'rxjs/add/observable/of';
import { Observable } from 'rxjs/Observable';
import { ExecutionResult, IProcessService, ObservableExecutionResult, Output, SpawnOptions } from '../../client/common/process/types';

type ExecObservableCallback = (result: Observable<Output<string>> | Output<string>) => void;
type ExecCallback = (result: ExecutionResult<string>) => void;

export const IOriginalProcessService = Symbol('IProcessService');

export class MockProcessService extends EventEmitter implements IProcessService {
    constructor(private procService: IProcessService) {
        super();
    }
    public onExecObservable(handler: (file: string, args: string[], options: SpawnOptions, callback: ExecObservableCallback) => void) {
        this.on('execObservable', handler);
    }
    public execObservable(file: string, args: string[], options: SpawnOptions = {}): ObservableExecutionResult<string> {
        let value: Observable<Output<string>> | Output<string> | undefined;
        let valueReturned = false;
        this.emit('execObservable', file, args, options, (result: Observable<Output<string>> | Output<string>) => { value = result; valueReturned = true; });

        if (valueReturned) {
            const output = value as Output<string>;
            if (['stderr', 'stdout'].some(source => source === output.source)) {
                return {
                    // tslint:disable-next-line:no-any
                    proc: {} as any,
                    out: Observable.of(output)
                };
            } else {
                return {
                    // tslint:disable-next-line:no-any
                    proc: {} as any,
                    out: value as Observable<Output<string>>
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

        return valueReturned ? value! : this.procService.exec(file, args, options);
    }
}
