/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as child_process from 'child_process';
import { getInterpreterVersion } from '../common/utils';

export interface IInterpreterVersionService {
    getVersion(pythonPath: string, defaultValue: string): Promise<string>;
    getPipVersion(pythonPath: string): Promise<string>;
}

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
                    // Take the second part, see below example.
                    // pip 9.0.1 from /Users/donjayamanne/anaconda3/lib/python3.6/site-packages (python 3.6).
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
