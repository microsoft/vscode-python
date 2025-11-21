// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { CancellationTokenSource, Uri } from 'vscode';
import { Deferred } from '../../../common/utils/async';
import { traceError, traceInfo, traceVerbose } from '../../../logging';
import { createDiscoveryErrorPayload, fixLogLinesNoTrailing } from './utils';
import { ITestResultResolver } from './types';

/**
 * Test provider type for logging purposes.
 */
export type TestProvider = 'pytest' | 'unittest';

/**
 * Creates standard process event handlers for test discovery subprocess.
 * Handles stdout/stderr logging and error reporting on process exit.
 *
 * @param testProvider - The test framework being used ('pytest' or 'unittest')
 * @param uri - The workspace URI
 * @param cwd - The current working directory
 * @param resultResolver - Resolver for test discovery results
 * @param deferredTillExecClose - Deferred to resolve when process closes
 * @param allowedSuccessCodes - Additional exit codes to treat as success (e.g., pytest exit code 5 for no tests found)
 */
export function createProcessHandlers(
    testProvider: TestProvider,
    uri: Uri,
    cwd: string,
    resultResolver: ITestResultResolver | undefined,
    deferredTillExecClose: Deferred<void>,
    allowedSuccessCodes: number[] = [],
): {
    onStdout: (data: any) => void;
    onStderr: (data: any) => void;
    onExit: (code: number | null, signal: NodeJS.Signals | null) => void;
    onClose: (code: number | null, signal: NodeJS.Signals | null) => void;
} {
    const isSuccessCode = (code: number | null): boolean => {
        return code === 0 || (code !== null && allowedSuccessCodes.includes(code));
    };

    return {
        onStdout: (data: any) => {
            const out = fixLogLinesNoTrailing(data.toString());
            traceInfo(out);
        },
        onStderr: (data: any) => {
            const out = fixLogLinesNoTrailing(data.toString());
            traceError(out);
        },
        onExit: (code: number | null, signal: NodeJS.Signals | null) => {
            // The 'exit' event fires when the process terminates, but streams may still be open.
            if (!isSuccessCode(code)) {
                const exitCodeNote =
                    allowedSuccessCodes.length > 0
                        ? ` Note: Exit codes ${allowedSuccessCodes.join(', ')} are also treated as success.`
                        : '';
                traceError(
                    `${testProvider} discovery subprocess exited with code ${code} and signal ${signal} for workspace ${uri.fsPath}.${exitCodeNote}`,
                );
            } else if (code === 0) {
                traceVerbose(`${testProvider} discovery subprocess exited successfully for workspace ${uri.fsPath}`);
            }
        },
        onClose: (code: number | null, signal: NodeJS.Signals | null) => {
            // We resolve the deferred here to ensure all output has been captured.
            if (!isSuccessCode(code)) {
                traceError(
                    `${testProvider} discovery failed with exit code ${code} and signal ${signal} for workspace ${uri.fsPath}. Creating error payload.`,
                );
                resultResolver?.resolveDiscovery(createDiscoveryErrorPayload(code, signal, cwd));
            } else {
                traceVerbose(`${testProvider} discovery subprocess streams closed for workspace ${uri.fsPath}`);
            }
            deferredTillExecClose?.resolve();
        },
    };
}

/**
 * Handles cleanup when test discovery is cancelled.
 * Kills the subprocess (if running), resolves the completion deferred, and cancels the discovery pipe.
 *
 * @param testProvider - The test framework being used ('pytest' or 'unittest')
 * @param proc - The process to kill
 * @param processCompletion - Deferred to resolve
 * @param pipeCancellation - Cancellation token source to cancel
 * @param uri - The workspace URI
 */
export function cleanupOnCancellation(
    testProvider: TestProvider,
    proc: { kill: () => void } | undefined,
    processCompletion: Deferred<void>,
    pipeCancellation: CancellationTokenSource,
    uri: Uri,
): void {
    traceInfo(`Test discovery cancelled, killing ${testProvider} subprocess for workspace ${uri.fsPath}`);
    if (proc) {
        proc.kill();
    }
    processCompletion.resolve();
    pipeCancellation.cancel();
}
