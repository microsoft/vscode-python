import { injectable } from 'inversify';
import { ICurrentProcess } from '../types';
import { EnvironmentVariables } from '../variables/types';

@injectable()
export class CurrentProcess implements ICurrentProcess {
    public get env(): EnvironmentVariables {
        return process.env;
    }
}
