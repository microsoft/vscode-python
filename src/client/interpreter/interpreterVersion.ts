import * as child_process from 'child_process';
import { getInterpreterVersion } from '../common/utils';

export interface IInterpreterVersionService {
    getVersion(pythonPath: string, defaultValue: string): Promise<string>;
    getPipVersion(pythonPath: string): Promise<string>;
}

export class InterpreterVersionService implements IInterpreterVersionService {
    public getVersion(pythonPath: string, defaultValue: string): Promise<string> {
        return getInterpreterVersion(pythonPath)
            .catch(() => defaultValue);
    }
    public async getPipVersion(pythonPath: string): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            child_process.execFile(pythonPath, ['-m', 'pip', '--version'], (error, stdout, stdErr) => {
                if (stdout && stdout.length > 0) {
                    const parts = stdout.split(' ');
                    if (parts.length > 1) {
                        resolve(parts[1].trim());
                        return;
                    }
                }
                reject();
            });
        });
    }
}
