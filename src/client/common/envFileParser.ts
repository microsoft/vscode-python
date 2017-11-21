import * as fs from 'fs-extra';
import * as path from 'path';
import { EnvironmentVariables, IEnvironmentVariablesService } from './types';
export const IS_WINDOWS = /^win/.test(process.platform);
export const WINDOWS_PATH_VARIABLE_NAME = 'Path';
export const NON_WINDOWS_PATH_VARIABLE_NAME = 'PATH';

export class EnvironmentVariablesService implements IEnvironmentVariablesService {
    constructor(private isWidows: boolean) { }
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
                const pathVariable = this.isWidows ? WINDOWS_PATH_VARIABLE_NAME : NON_WINDOWS_PATH_VARIABLE_NAME;
                this.appendPath(vars, process.env[pathVariable]);
                resolve(vars);
            });
        });
    }
    public mergeVariables(source: EnvironmentVariables, target: EnvironmentVariables) {
        const pathVariable = this.isWidows ? WINDOWS_PATH_VARIABLE_NAME : NON_WINDOWS_PATH_VARIABLE_NAME;
        const settingsNotToMerge = ['PYTHONPATH', pathVariable];
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
        const pathVariable = this.isWidows ? WINDOWS_PATH_VARIABLE_NAME : NON_WINDOWS_PATH_VARIABLE_NAME;
        return this.appendOrPrependPaths(vars, pathVariable, false, ...paths);
    }
    public appendPath(vars: EnvironmentVariables, append: boolean, ...paths: string[]) {
        const pathVariable = this.isWidows ? WINDOWS_PATH_VARIABLE_NAME : NON_WINDOWS_PATH_VARIABLE_NAME;
        return this.appendOrPrependPaths(vars, pathVariable, true, ...paths);
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

export function parseEnvFile(envFile: string, mergeWithProcessEnvVars: boolean = true): EnvironmentVariables {
    const buffer = fs.readFileSync(envFile, 'utf8');
    const env = parseEnvironmentVariables(buffer)!;
    return mergeWithProcessEnvVars ? mergeEnvVariables(env, process.env) : mergePythonPath(env, process.env.PYTHONPATH as string);
}

/**
 * Merge the target environment variables into the source.
 * Note: The source variables are modified and returned (i.e. it modifies value passed in).
 * @export
 * @param {EnvironmentVariables} targetEnvVars target environment variables.
 * @param {EnvironmentVariables} [sourceEnvVars=process.env] source environment variables (defaults to current process variables).
 * @returns {EnvironmentVariables}
 */
export function mergeEnvVariables(targetEnvVars: EnvironmentVariables, sourceEnvVars: EnvironmentVariables = process.env): EnvironmentVariables {
    const service = new EnvironmentVariablesService(IS_WINDOWS);
    service.mergeVariables(sourceEnvVars, targetEnvVars);
    service.appendPythonPath(targetEnvVars, sourceEnvVars.PYTHONPATH);
    return targetEnvVars;
}

/**
 * Merge the target PYTHONPATH value into the env variables passed.
 * Note: The env variables passed in are modified and returned (i.e. it modifies value passed in).
 * @export
 * @param {EnvironmentVariables} env target environment variables.
 * @param {string | undefined} [currentPythonPath] PYTHONPATH value.
 * @returns {EnvironmentVariables}
 */
export function mergePythonPath(env: EnvironmentVariables, currentPythonPath: string | undefined): EnvironmentVariables {
    if (typeof currentPythonPath !== 'string' || currentPythonPath.length === 0) {
        return env;
    }
    const service = new EnvironmentVariablesService(IS_WINDOWS);
    service.appendPythonPath(env, currentPythonPath!);
    return env;
}
