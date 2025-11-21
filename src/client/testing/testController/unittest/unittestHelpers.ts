// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import * as path from 'path';
import { traceInfo } from '../../../logging';

/**
 * Builds the environment variables required for unittest discovery.
 * Sets TEST_RUN_PIPE for communication.
 */
export async function buildUnittestEnv(
    envVars: { [key: string]: string | undefined } | undefined,
    discoveryPipeName: string,
): Promise<{ [key: string]: string | undefined }> {
    const mutableEnv = {
        ...envVars,
    };
    mutableEnv.TEST_RUN_PIPE = discoveryPipeName;
    traceInfo(`Environment variables set for unittest discovery: TEST_RUN_PIPE=${mutableEnv.TEST_RUN_PIPE}`);
    return mutableEnv;
}

/**
 * Builds the unittest discovery command.
 */
export function buildDiscoveryCommand(args: string[], extensionRootDir: string): string[] {
    const discoveryScript = path.join(extensionRootDir, 'python_files', 'unittestadapter', 'discovery.py');
    return [discoveryScript, '--udiscovery', ...args];
}
