import { inject, injectable } from 'inversify';
import '../common/extensions';
import * as internalPython from '../common/process/internal/python';
import { IProcessServiceFactory } from '../common/process/types';
import { IInterpreterVersionService } from './contracts';

export const PIP_VERSION_REGEX = '\\d+\\.\\d+(\\.\\d+)?';

@injectable()
export class InterpreterVersionService implements IInterpreterVersionService {
    constructor(@inject(IProcessServiceFactory) private readonly processServiceFactory: IProcessServiceFactory) {}
    public async getVersion(pythonPath: string, defaultValue: string): Promise<string> {
        const [args, parse] = internalPython.getVersion();
        const processService = await this.processServiceFactory.create();
        return processService
            .exec(pythonPath, args, { mergeStdOutErr: true })
            .then((output) => parse(output.stdout).splitLines()[0])
            .then((version) => (version.length === 0 ? defaultValue : version))
            .catch(() => defaultValue);
    }
    public async getPipVersion(pythonPath: string): Promise<string> {
        const [args, parse] = internalPython.getModuleVersion('pip');
        const processService = await this.processServiceFactory.create();
        const output = await processService.exec(pythonPath, args, { mergeStdOutErr: true });
        const version = parse(output.stdout);
        if (version.length > 0) {
            // Here's a sample output:
            // pip 9.0.1 from /Users/donjayamanne/anaconda3/lib/python3.6/site-packages (python 3.6).
            const re = new RegExp(PIP_VERSION_REGEX, 'g');
            const matches = re.exec(version);
            if (matches && matches.length > 0) {
                return matches[0].trim();
            }
        }
        throw new Error(`Unable to determine pip version from output '${output.stdout}'`);
    }
}
