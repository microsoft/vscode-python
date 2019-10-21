import { IS_WINDOWS } from './platform/constants';
import { FileSystem } from './platform/fileSystem';
import { PathUtils } from './platform/pathUtils';
import { IFileSystem } from './platform/types';
import { EnvironmentVariablesService } from './variables/environment';
import {
    EnvironmentVariables, IEnvironmentVariablesService
} from './variables/types';

function parseEnvironmentVariables(contents: string): EnvironmentVariables | undefined {
    if (typeof contents !== 'string' || contents.length === 0) {
        return undefined;
    }

    const env: EnvironmentVariables = {};
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

export function parseEnvFile(
    envFile: string,
    mergeWithProcessEnvVars: boolean = true,
    service?: IEnvironmentVariablesService,
    fs?: IFileSystem
): EnvironmentVariables {
    fs = fs ? fs : new FileSystem();
    const buffer = fs.readFileSync(envFile);
    const env = parseEnvironmentVariables(buffer)!;
    if (!service) {
        service = new EnvironmentVariablesService(
            new PathUtils(IS_WINDOWS),
            fs
        );
    }
    return mergeWithProcessEnvVars
        ? mergeEnvVariables(env, process.env, service)
        : mergePythonPath(env, process.env.PYTHONPATH as string, service);
}

/**
 * Merge the target environment variables into the source.
 * Note: The source variables are modified and returned (i.e. it modifies value passed in).
 * @export
 * @param {EnvironmentVariables} targetEnvVars target environment variables.
 * @param {EnvironmentVariables} [sourceEnvVars=process.env] source environment variables (defaults to current process variables).
 * @returns {EnvironmentVariables}
 */
export function mergeEnvVariables(
    targetEnvVars: EnvironmentVariables,
    sourceEnvVars: EnvironmentVariables = process.env,
    service?: IEnvironmentVariablesService
): EnvironmentVariables {
    if (!service) {
        service = new EnvironmentVariablesService(
            new PathUtils(IS_WINDOWS),
            new FileSystem()
        );
    }
    service.mergeVariables(sourceEnvVars, targetEnvVars);
    if (sourceEnvVars.PYTHONPATH) {
        service.appendPythonPath(targetEnvVars, sourceEnvVars.PYTHONPATH);
    }
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
export function mergePythonPath(
    env: EnvironmentVariables,
    currentPythonPath: string | undefined,
    service?: IEnvironmentVariablesService
): EnvironmentVariables {
    if (typeof currentPythonPath !== 'string' || currentPythonPath.length === 0) {
        return env;
    }

    if (!service) {
        service = new EnvironmentVariablesService(
            new PathUtils(IS_WINDOWS),
            new FileSystem()
        );
    }
    service.appendPythonPath(env, currentPythonPath);
    return env;
}
