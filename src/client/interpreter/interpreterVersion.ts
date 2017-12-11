import * as child_process from 'child_process';
import { injectable } from 'inversify';
import 'reflect-metadata';
import { getInterpreterVersion } from '../common/utils';
import { IInterpreterVersionService } from './contracts';

const PIP_VERSION_REGEX = '\\d\\.\\d(\\.\\d)+';

@injectable()
export class InterpreterVersionService implements IInterpreterVersionService {
    public async getVersion(pythonPath: string, defaultValue: string): Promise<string> {
        return getInterpreterVersion(pythonPath)
            .then(version => version.length === 0 ? defaultValue : version)
            .catch(() => defaultValue);
    }
    public async getPipVersion(pythonPath: string): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            child_process.execFile(pythonPath, ['-m', 'pip', '--version'], (error, stdout, stdErr) => {
                if (stdout && stdout.length > 0) {
                    // Take the first available version number, see below example.
                    // pip 9.0.1 from /Users/donjayamanne/anaconda3/lib/python3.6/site-packages (python 3.6).
                    // Take the second part, see below example.
                    // pip 9.0.1 from /Users/donjayamanne/anaconda3/lib/python3.6/site-packages (python 3.6).
                    const re = new RegExp(PIP_VERSION_REGEX, 'g');
                    const matches = re.exec(stdout);
                    if (matches && matches.length > 0) {
                        resolve(matches[0].trim());
                        return;
                    }
                }
                reject();
            });
        });
    }
}
