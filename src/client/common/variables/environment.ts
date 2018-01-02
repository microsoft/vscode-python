// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as fs from 'fs-extra';
import { inject, injectable } from 'inversify';
import * as path from 'path';
import { IPathUtils } from '../types';
import { EnvironmentVariables, IEnvironmentVariablesService } from './types';

@injectable()
export class EnvironmentVariablesService implements IEnvironmentVariablesService {
    private readonly pathVariable: 'PATH' | 'Path';
    constructor( @inject(IPathUtils) pathUtils: IPathUtils) {
        this.pathVariable = pathUtils.getPathVariableName();
    }
    public async parseFile(filePath: string): Promise<EnvironmentVariables | undefined> {
        const exists = await fs.pathExists(filePath);
        if (!exists) {
            return undefined;
        }
        return new Promise<EnvironmentVariables | undefined>((resolve, reject) => {
            fs.readFile(filePath, 'utf8', (error, data) => {
                if (error) {
                    return reject(error);
                }
                const vars = parseEnvironmentVariables(data)!;
                if (!vars || Object.keys(vars).length === 0) {
                    return resolve(undefined);
                }
                this.appendPythonPath(vars, process.env.PYTHONPATH);
                this.appendPath(vars, process.env[this.pathVariable]);
                resolve(vars);
            });
        });
    }
    public mergeVariables(source: EnvironmentVariables, target: EnvironmentVariables) {
        if (!target) {
            return;
        }
        const settingsNotToMerge = ['PYTHONPATH', this.pathVariable];
        Object.keys(source).forEach(setting => {
            if (settingsNotToMerge.indexOf(setting) >= 0) {
                return;
            }
            if (target[setting] === undefined) {
                target[setting] = source[setting];
            }
        });
    }
    public prependPythonPath(vars: EnvironmentVariables, ...pythonPaths: string[]) {
        return this.appendOrPrependPaths(vars, 'PYTHONPATH', false, ...pythonPaths);
    }
    public appendPythonPath(vars: EnvironmentVariables, ...pythonPaths: string[]) {
        return this.appendOrPrependPaths(vars, 'PYTHONPATH', true, ...pythonPaths);
    }
    public prependPath(vars: EnvironmentVariables, ...paths: string[]) {
        return this.appendOrPrependPaths(vars, this.pathVariable, false, ...paths);
    }
    public appendPath(vars: EnvironmentVariables, ...paths: string[]) {
        return this.appendOrPrependPaths(vars, this.pathVariable, true, ...paths);
    }
    private appendOrPrependPaths(vars: EnvironmentVariables, variableName: 'PATH' | 'Path' | 'PYTHONPATH', append: boolean, ...pythonPaths: string[]) {
        const pathToInsert = pythonPaths.filter(item => typeof item === 'string' && item.length > 0).join(path.delimiter);
        if (pathToInsert.length === 0) {
            return vars;
        }

        if (typeof vars[variableName] === 'string' && vars[variableName].length > 0) {
            vars[variableName] = append ? (vars[variableName] + path.delimiter + pathToInsert) : (pathToInsert + path.delimiter + vars[variableName]);
        } else {
            vars[variableName] = pathToInsert;
        }
        return vars;
    }
}

function parseEnvironmentVariables(contents: string): EnvironmentVariables | undefined {
    if (typeof contents !== 'string' || contents.length === 0) {
        return undefined;
    }

    const env = {} as EnvironmentVariables;
    contents.split('\n').forEach(line => {
        const match = line.match(/^\s*([\w\.\-]+)\s*=\s*(.*)?\s*$/);
        if (match !== null) {
            let value = typeof match[2] === 'string' ? match[2] : '';
            if (value.length > 0 && value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') {
                value = value.replace(/\\n/gm, '\n');
            }
            env[match[1]] = value.replace(/(^['"]|['"]$)/g, '');
        }
    });
    return env;
}
