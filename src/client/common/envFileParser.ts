import * as fs from 'fs-extra';
import { PathUtils } from './platform/pathUtils';
import { EnvironmentVariablesService } from './variables/environment';
import { EnvironmentVariables } from './variables/types';
export const IS_WINDOWS = /^win/.test(process.platform);

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
    const service = new EnvironmentVariablesService(new PathUtils(IS_WINDOWS));
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
    const service = new EnvironmentVariablesService(new PathUtils(IS_WINDOWS));
    service.appendPythonPath(env, currentPythonPath!);
    return env;
}
