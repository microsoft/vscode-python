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
    constructor(@inject(IPathUtils) pathUtils: IPathUtils) {
        this.pathVariable = pathUtils.getPathVariableName();
    }
    public async parseFile(filePath?: string): Promise<EnvironmentVariables | undefined> {
        if (!filePath || !await fs.pathExists(filePath)) {
            return;
        }
        if (!fs.lstatSync(filePath).isFile()) {
            return;
        }
        return parseEnvFile(await fs.readFile(filePath));
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

        const variable = vars ? vars[variableName] : undefined;
        if (variable && typeof variable === 'string' && variable.length > 0) {
            vars[variableName] = variable + path.delimiter + valueToAppend;
        } else {
            vars[variableName] = valueToAppend;
        }
        return vars;
    }
}

// tslint:disable-next-line:no-suspicious-comment
// TODO: Support passing in substitutions?
export function parseEnvFile(
    lines: string | Buffer
): EnvironmentVariables {
    // Most of the following is an adaptation of the dotenv code:
    //   https://github.com/motdotla/dotenv/blob/master/lib/main.js#L32
    // We don't use dotenv here because it loses ordering, which is
    // significant for substitution.
    const vars = {};
    lines.toString().split('\n').forEach((line, idx) => {
        const match = line.match(/^\s*([a-zA-Z]\w*)\s*=\s*(.*?)?\s*$/);
        if (!match) {
            return;
        }

        const name = match[1];
        let value = match[2];
        if (value) {
            if (value[0] === '\'' && value[value.length - 1] === '\'') {
                value = value.substring(1, value.length - 1);
                value = value.replace(/\\n/gm, '\n');
            } else if (value[0] === '"' && value[value.length - 1] === '"') {
                value = value.substring(1, value.length - 1);
                value = value.replace(/\\n/gm, '\n');
            }

            // Substitution here is inspired a little by dotenv-expand:
            //   https://github.com/motdotla/dotenv-expand/blob/master/lib/main.js

            if (value.match(/(?<![\\])\${([a-zA-Z]\w*)?\${/)) {
                // Disallow nesting.
            } else {
                const matches = value.match(/(?<![\\])(\${[a-zA-Z]\w*})/g) || [];
                for (const submatch of matches) {
                    const replacement = submatch.substring(2, submatch.length - 1);
                    value = value.replace(RegExp(`(?<![\\\\])\\${'$'}{${replacement}}`), vars[replacement] || '');
                }
                value = value.replace(/\\\$/g, '$');
            }
        } else {
            value = '';
        }
        vars[name] = value;
    });
    return vars;
}
