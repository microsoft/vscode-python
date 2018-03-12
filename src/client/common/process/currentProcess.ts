import { injectable } from 'inversify';
import { ICurrentProcess } from '../types';
import { EnvironmentVariables } from '../variables/types';

@injectable()
export class CurrentProcess implements ICurrentProcess {
    public on = (event: string | symbol, listener: Function): this => {
        process.on(event, listener);
        // tslint:disable-next-line:no-any
        return process as any;
    }
    public get env(): EnvironmentVariables {
        return process.env;
    }
    public get argv(): string[] {
        return process.argv;
    }
    public get stdout(): NodeJS.WriteStream {
        return process.stdout;
    }
    public get stdin(): NodeJS.ReadStream {
        return process.stdin;
    }
}
