import { inject, injectable } from 'inversify';
import '../common/extensions';
import { IProcessService } from '../common/process/types';
import { IInterpreterVersionService } from './contracts';

export const PIP_VERSION_REGEX = '\\d+\\.\\d+(\\.\\d+)';

@injectable()
export class InterpreterVersionService implements IInterpreterVersionService {
    constructor(@inject(IProcessService) private processService: IProcessService) { }
    public async getVersion(pythonPath: string, defaultValue: string): Promise<string> {
        return this.processService.exec(pythonPath, ['--version'], { mergeStdOutErr: true })
            .then(output => output.stdout.splitLines()[0])
            .then(version => version.length === 0 ? defaultValue : version)
            .catch(() => defaultValue);
    }
    public async getPipVersion(pythonPath: string): Promise<string> {
        const output = await this.processService.exec(pythonPath, ['-m', 'pip', '--version'], { mergeStdOutErr: true });
        if (output.stdout.length > 0) {
            // Here's a sample output:
            // pip 9.0.1 from /Users/donjayamanne/anaconda3/lib/python3.6/site-packages (python 3.6).
            const re = new RegExp(PIP_VERSION_REGEX, 'g');
            const matches = re.exec(output.stdout);
            if (matches && matches.length > 0) {
                return matches[0].trim();
            }
        }
        throw new Error(`Unable to determine pip version from output '${output.stdout}'`);
    }
}
