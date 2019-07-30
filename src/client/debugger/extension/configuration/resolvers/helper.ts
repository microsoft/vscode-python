// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { ICurrentProcess, IPathUtils } from '../../../../common/types';
import { EnvironmentVariables, IEnvironmentVariablesService } from '../../../../common/variables/types';
import { LaunchRequestArguments } from '../../../types';

export async function getEnvironmentVariables(
    envParser: IEnvironmentVariablesService,
    pathUtils: IPathUtils,
    process: ICurrentProcess,
    args: LaunchRequestArguments): Promise<EnvironmentVariables> {
    const pathVariableName = pathUtils.getPathVariableName();

    // Merge variables from both .env file and env json variables.
    // tslint:disable-next-line:no-any
    const debugLaunchEnvVars: Record<string, string> = (args.env && Object.keys(args.env).length > 0) ? { ...args.env } as any : {} as any;
    const envFileVars = await envParser.parseFile(args.envFile, debugLaunchEnvVars);
    const env = envFileVars ? { ...envFileVars! } : {};
    envParser.mergeVariables(debugLaunchEnvVars, env);

    // Append the PYTHONPATH and PATH variables.
    envParser.appendPath(env, debugLaunchEnvVars[pathVariableName]);
    envParser.appendPythonPath(env, debugLaunchEnvVars.PYTHONPATH);

    if (typeof env[pathVariableName] === 'string' && env[pathVariableName]!.length > 0) {
        // Now merge this path with the current system path.
        // We need to do this to ensure the PATH variable always has the system PATHs as well.
        envParser.appendPath(env, process.env[pathVariableName]!);
    }
    if (typeof env.PYTHONPATH === 'string' && env.PYTHONPATH.length > 0) {
        // We didn't have a value for PATH earlier and now we do.
        // Now merge this path with the current system path.
        // We need to do this to ensure the PATH variable always has the system PATHs as well.
        envParser.appendPythonPath(env, process.env.PYTHONPATH!);
    }

    if (typeof args.console !== 'string' || args.console === 'internalConsole') {
        // For debugging, when not using any terminal, then we need to provide all env variables.
        // As we're spawning the process, we need to ensure all env variables are passed.
        // Including those from the current process (i.e. everything, not just custom vars).
        envParser.mergeVariables(process.env, env);

        if (env[pathVariableName] === undefined && typeof process.env[pathVariableName] === 'string') {
            env[pathVariableName] = process.env[pathVariableName];
        }
        if (env.PYTHONPATH === undefined && typeof process.env.PYTHONPATH === 'string') {
            env.PYTHONPATH = process.env.PYTHONPATH;
        }
    }

    if (!env.hasOwnProperty('PYTHONIOENCODING')) {
        env.PYTHONIOENCODING = 'UTF-8';
    }
    if (!env.hasOwnProperty('PYTHONUNBUFFERED')) {
        env.PYTHONUNBUFFERED = '1';
    }

    if (args.gevent) {
        env.GEVENT_SUPPORT = 'True';  // this is read in pydevd_constants.py
    }

    return env;
}
