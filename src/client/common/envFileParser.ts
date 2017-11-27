import * as fs from 'fs';
import * as path from 'path';

type EnvVars = Object & { [key: string]: string };

export function parseEnvFile(envFile: string, mergeWithProcessEnvVars: boolean = true): EnvVars {
    const buffer = fs.readFileSync(envFile, 'utf8');
    const env = {};
    buffer.split('\n').forEach(line => {
        const r = line.match(/^\s*([\w\.\-]+)\s*=\s*(.*)?\s*$/);
        if (r !== null) {
            let value = r[2] || '';
            if (value.length > 0 && value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') {
                value = value.replace(/\\n/gm, '\n');
            }
            env[r[1]] = value.replace(/(^['"]|['"]$)/g, '');
        }
    });
    return mergeWithProcessEnvVars ? mergeEnvVariables(env, process.env) : mergePythonPath(env, process.env.PYTHONPATH);
}

/**
 * Merge the target environment variables into the source.
 * Note: The source variables are modified and returned (i.e. it modifies value passed in).
 * @export
 * @param {EnvVars} targetEnvVars target environment variables.
 * @param {EnvVars} [sourceEnvVars=process.env] source environment variables (defaults to current process variables).
 * @returns {EnvVars}
 */
export function mergeEnvVariables(targetEnvVars: EnvVars, sourceEnvVars: EnvVars = process.env): EnvVars {
    Object.keys(sourceEnvVars).forEach(setting => {
        if (targetEnvVars[setting] === undefined) {
            targetEnvVars[setting] = sourceEnvVars[setting];
        }
    });
    return mergePythonPath(targetEnvVars, sourceEnvVars.PYTHONPATH);
}

/**
 * Merge the target PYTHONPATH value into the env variables passed.
 * Note: The env variables passed in are modified and returned (i.e. it modifies value passed in).
 * @export
 * @param {EnvVars} env target environment variables.
 * @param {string | undefined} [currentPythonPath] PYTHONPATH value.
 * @returns {EnvVars}
 */
export function mergePythonPath(env: EnvVars, currentPythonPath: string | undefined): EnvVars {
    if (typeof currentPythonPath !== 'string' || currentPythonPath.length === 0) {
        return env;
    }

    if (typeof env.PYTHONPATH === 'string' && env.PYTHONPATH.length > 0) {
        env.PYTHONPATH = env.PYTHONPATH + path.delimiter + currentPythonPath;
    } else {
        env.PYTHONPATH = currentPythonPath;
    }
    return env;
}
