// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as dotenv from 'dotenv';
import * as fs from 'fs-extra';
import { inject, injectable } from 'inversify';
import * as path from 'path';
import { IPathUtils } from '../types';
import { EnvironmentVariables, IEnvironmentVariablesService } from './types';

@injectable()
export class EnvironmentVariablesService implements IEnvironmentVariablesService {
    private readonly pathVariable: 'PATH' | 'Path';
    constructor(@inject(IPathUtils) pathUtils: IPathUtils) {
        this.pathVariable = pathUtils.getPathVariableName();
    }
    public async parseFile(filePath: string): Promise<EnvironmentVariables | undefined> {
        const exists = await fs.pathExists(filePath);
        if (!exists) {
            return undefined;
        }
        if (!fs.lstatSync(filePath).isFile()) {
            return undefined;
        }
        return dotenv.parse(await fs.readFile(filePath));
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
    public appendPythonPath(vars: EnvironmentVariables, ...pythonPaths: string[]) {
        return this.appendPaths(vars, 'PYTHONPATH', ...pythonPaths);
    }
    public appendPath(vars: EnvironmentVariables, ...paths: string[]) {
        return this.appendPaths(vars, this.pathVariable, ...paths);
    }
    private appendPaths(vars: EnvironmentVariables, variableName: 'PATH' | 'Path' | 'PYTHONPATH', ...pathsToAppend: string[]) {
        const valueToAppend = pathsToAppend
            .filter(item => typeof item === 'string' && item.trim().length > 0)
            .map(item => item.trim())
            .join(path.delimiter);
        if (valueToAppend.length === 0) {
            return vars;
        }

        if (typeof vars[variableName] === 'string' && vars[variableName].length > 0) {
            vars[variableName] = vars[variableName] + path.delimiter + valueToAppend;
        } else {
            vars[variableName] = valueToAppend;
        }
        return vars;
    }
}
