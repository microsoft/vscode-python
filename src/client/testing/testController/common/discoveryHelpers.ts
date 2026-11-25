// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { CancellationToken, CancellationTokenSource, Disposable, Uri } from 'vscode';
import { Deferred } from '../../../common/utils/async';
import { traceError, traceInfo, traceVerbose } from '../../../logging';
import { createDiscoveryErrorPayload, fixLogLinesNoTrailing, startDiscoveryNamedPipe } from './utils';
import { DiscoveredTestPayload, ITestResultResolver } from './types';

/**
 * Test provider type for logging purposes.
 */
export type TestProvider = 'pytest' | 'unittest';

/**
 * Sets up the discovery named pipe and wires up cancellation.
 * @param resultResolver The resolver to handle discovered test data
 * @param token Optional cancellation token from the caller
 * @param uri Workspace URI for logging
 * @returns Object containing the pipe name, cancellation source, and disposable for the external token handler
 */
export async function setupDiscoveryPipe(
    resultResolver: ITestResultResolver | undefined,
    token: CancellationToken | undefined,
    uri: Uri,
): Promise<{ pipeName: string; cancellation: CancellationTokenSource; tokenDisposable: Disposable | undefined }> {
    const discoveryPipeCancellation = new CancellationTokenSource();

    // Wire up cancellation from external token and store the disposable
    const tokenDisposable = token?.onCancellationRequested(() => {
        traceInfo(`Test discovery cancelled.`);
        discoveryPipeCancellation.cancel();
    });

    // Start the named pipe with the discovery listener
    const discoveryPipeName = await startDiscoveryNamedPipe((data: DiscoveredTestPayload) => {
        if (!token?.isCancellationRequested) {
            resultResolver?.resolveDiscovery(data);
        }
    }, discoveryPipeCancellation.token);

    traceVerbose(`Created discovery pipe: ${discoveryPipeName} for workspace ${uri.fsPath}`);

    return {
        pipeName: discoveryPipeName,
        cancellation: discoveryPipeCancellation,
        tokenDisposable,
    };
}

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
        onExit: (code: number | null, _signal: NodeJS.Signals | null) => {
            // The 'exit' event fires when the process terminates, but streams may still be open.
            // Only log verbose success message here; error handling happens in onClose.
            if (isSuccessCode(code)) {
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
        traceVerbose(`Killing ${testProvider} subprocess for workspace ${uri.fsPath}`);
        proc.kill();
    } else {
        traceVerbose(`No ${testProvider} subprocess to kill for workspace ${uri.fsPath} (proc is undefined)`);
    }
    traceVerbose(`Resolving process completion deferred for ${testProvider} discovery in workspace ${uri.fsPath}`);
    processCompletion.resolve();
    traceVerbose(`Cancelling discovery pipe for ${testProvider} discovery in workspace ${uri.fsPath}`);
    pipeCancellation.cancel();
}
