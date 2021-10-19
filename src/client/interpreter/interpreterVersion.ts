import { inject, injectable } from 'inversify';
import '../common/extensions';
import { IProcessServiceFactory } from '../common/process/types';
import { getPythonVersion } from '../pythonEnvironments/info/pythonVersion';
import { IInterpreterVersionService } from './contracts';

@injectable()
export class InterpreterVersionService implements IInterpreterVersionService {
    constructor(@inject(IProcessServiceFactory) private readonly processServiceFactory: IProcessServiceFactory) {}

    public async getVersion(pythonPath: string, defaultValue: string): Promise<string> {
        const processService = await this.processServiceFactory.create();
        return getPythonVersion(pythonPath, defaultValue, (cmd, args) =>
            processService.exec(cmd, args, { mergeStdOutErr: true }),
        );
    }
}
