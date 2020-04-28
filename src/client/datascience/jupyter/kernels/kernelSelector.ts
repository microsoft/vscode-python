// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import '../../../common/extensions';

import type { nbformat } from '@jupyterlab/coreutils';
import type { Kernel } from '@jupyterlab/services';
import { inject, injectable } from 'inversify';
import { CancellationToken } from 'vscode-jsonrpc';

import { IApplicationShell } from '../../../common/application/types';
import { traceError, traceInfo, traceVerbose } from '../../../common/logger';
import { IInstaller, Product, Resource } from '../../../common/types';
import * as localize from '../../../common/utils/localize';
import { noop } from '../../../common/utils/misc';
import { StopWatch } from '../../../common/utils/stopWatch';
import { IInterpreterService, PythonInterpreter } from '../../../interpreter/contracts';
import { IEventNamePropertyMapping, sendTelemetryEvent } from '../../../telemetry';
import { KnownNotebookLanguages, Telemetry } from '../../constants';
import { reportAction } from '../../progress/decorator';
import { ReportableAction } from '../../progress/types';
import { IJupyterKernelSpec, IJupyterSessionManager } from '../../types';
import { KernelSelectionProvider } from './kernelSelections';
import { KernelService } from './kernelService';
import { IKernelSpecQuickPickItem, LiveKernelModel } from './types';

export type KernelSpecInterpreter = {
    kernelSpec?: IJupyterKernelSpec;
    /**
     * Interpreter that goes with the kernelspec.
     * Sometimes, we're unable to determine the exact interpreter associalted with a kernelspec, in such cases this is a closes match.
     * E.g. when selecting a remote kernel, we do not have the remote interpreter information, we can only try to find a close match.
     *
     * @type {PythonInterpreter}
     */
    interpreter?: PythonInterpreter;
    /**
     * Active kernel from an active session.
     * If this is available, then user needs to connect to an existing kernel (instead of starting a new session).
     *
     * @type {(LiveKernelModel)}
     */
    kernelModel?: LiveKernelModel;
};

@injectable()
export class KernelSelector {
    /**
     * List of ids of kernels that should be hidden from the kernel picker.
     *
     * @private
     * @type {new Set<string>}
     * @memberof KernelSelector
     */
    private readonly kernelIdsToHide = new Set<string>();
    constructor(
        @inject(KernelSelectionProvider) private readonly selectionProvider: KernelSelectionProvider,
        @inject(IApplicationShell) private readonly applicationShell: IApplicationShell,
        @inject(KernelService) private readonly kernelService: KernelService,
        @inject(IInterpreterService) private readonly interpreterService: IInterpreterService,
        @inject(IInstaller) private readonly installer: IInstaller
    ) {}

    /**
     * Ensure kernels such as those associated with the restart session are not displayed in the kernel picker.
     *
     * @param {Kernel.IKernelConnection} kernel
     * @memberof KernelSelector
     */
    public addKernelToIgnoreList(kernel: Kernel.IKernelConnection): void {
        this.kernelIdsToHide.add(kernel.id);
        this.kernelIdsToHide.add(kernel.clientId);
    }
    /**
     * Opposite of the add counterpart.
     *
     * @param {Kernel.IKernelConnection} kernel
     * @memberof KernelSelector
     */
    public removeKernelFromIgnoreList(kernel: Kernel.IKernelConnection): void {
        this.kernelIdsToHide.delete(kernel.id);
        this.kernelIdsToHide.delete(kernel.clientId);
    }

    /**
     * Selects a kernel from a remote session.
     *
     * @param {IJupyterSessionManager} session
     * @param {CancellationToken} [cancelToken]
     * @returns {Promise<KernelSpecInterpreter>}
     * @memberof KernelSelector
     */
    public async selectRemoteKernel(
        resource: Resource,
        stopWatch: StopWatch,
        session: IJupyterSessionManager,
        cancelToken?: CancellationToken,
        currentKernel?: IJupyterKernelSpec | LiveKernelModel
    ): Promise<KernelSpecInterpreter> {
        let suggestions = await this.selectionProvider.getKernelSelectionsForRemoteSession(
            resource,
            session,
            cancelToken
        );
        suggestions = suggestions.filter((item) => !this.kernelIdsToHide.has(item.selection.kernelModel?.id || ''));
        return this.selectKernel(
            resource,
            stopWatch,
            Telemetry.SelectRemoteJupyterKernel,
            suggestions,
            session,
            cancelToken,
            currentKernel
        );
    }
    /**
     * Select a kernel from a local session.
     *
     * @param {IJupyterSessionManager} [session]
     * @param {CancellationToken} [cancelToken]
     * @returns {Promise<KernelSpecInterpreter>}
     * @memberof KernelSelector
     */
    public async selectLocalKernel(
        resource: Resource,
        stopWatch: StopWatch,
        session?: IJupyterSessionManager,
        cancelToken?: CancellationToken,
        currentKernel?: IJupyterKernelSpec | LiveKernelModel
    ): Promise<KernelSpecInterpreter> {
        let suggestions = await this.selectionProvider.getKernelSelectionsForLocalSession(
            resource,
            session,
            cancelToken
        );
        suggestions = suggestions.filter((item) => !this.kernelIdsToHide.has(item.selection.kernelModel?.id || ''));
        return this.selectKernel(
            resource,
            stopWatch,
            Telemetry.SelectLocalJupyterKernel,
            suggestions,
            session,
            cancelToken,
            currentKernel
        );
    }
    /**
     * Gets a kernel that needs to be used with a local session.
     * (will attempt to find the best matching kernel, or prompt user to use current interpreter or select one).
     *
     * @param {IJupyterSessionManager} [sessionManager]
     * @param {nbformat.INotebookMetadata} [notebookMetadata]
     * @param {CancellationToken} [cancelToken]
     * @returns {Promise<KernelSpecInterpreter>}
     * @memberof KernelSelector
     */
    @reportAction(ReportableAction.KernelsGetKernelForLocalConnection)
    public async getKernelForLocalConnection(
        resource: Resource,
        sessionManager?: IJupyterSessionManager,
        notebookMetadata?: nbformat.INotebookMetadata,
        disableUI?: boolean,
        cancelToken?: CancellationToken
    ): Promise<KernelSpecInterpreter> {
        const stopWatch = new StopWatch();
        const telemetryProps: IEventNamePropertyMapping[Telemetry.FindKernelForLocalConnection] = {
            kernelSpecFound: false,
            interpreterFound: false,
            promptedToSelect: false
        };
        // When this method is called, we know we've started a local jupyter server.
        // Lets pre-warm the list of local kernels.
        this.selectionProvider.getKernelSelectionsForLocalSession(resource, sessionManager, cancelToken).ignoreErrors();

        let selection: KernelSpecInterpreter = {};
        if (notebookMetadata?.kernelspec) {
            selection.kernelSpec = await this.kernelService.findMatchingKernelSpec(
                notebookMetadata?.kernelspec,
                sessionManager,
                cancelToken
            );
            if (selection.kernelSpec) {
                selection.interpreter = await this.kernelService.findMatchingInterpreter(
                    selection.kernelSpec,
                    cancelToken
                );
                sendTelemetryEvent(Telemetry.UseExistingKernel);

                // Make sure we update the environment in the kernel before using it
                await this.kernelService.updateKernelEnvironment(
                    selection.interpreter,
                    selection.kernelSpec,
                    cancelToken
                );
            } else {
                // No kernel info, hence prmopt to use current interpreter as a kernel.
                const activeInterpreter = await this.interpreterService.getActiveInterpreter(resource);
                if (activeInterpreter) {
                    selection = await this.useInterpreterAsKernel(
                        resource,
                        activeInterpreter,
                        notebookMetadata.kernelspec.display_name,
                        sessionManager,
                        disableUI,
                        cancelToken
                    );
                } else {
                    telemetryProps.promptedToSelect = true;
                    selection = await this.selectLocalKernel(resource, stopWatch, sessionManager, cancelToken);
                }
            }
        } else {
            // No kernel info, hence use current interpreter as a kernel.
            const activeInterpreter = await this.interpreterService.getActiveInterpreter(resource);
            if (activeInterpreter) {
                selection.interpreter = activeInterpreter;
                selection.kernelSpec = await this.kernelService.searchAndRegisterKernel(
                    activeInterpreter,
                    disableUI,
                    cancelToken
                );
            }
        }
        // If still not found, log an error (this seems possible for some people, so use the default)
        if (!selection.kernelSpec) {
            traceError('Jupyter Kernel Spec not found for a local connection');
        }

        telemetryProps.kernelSpecFound = !!selection.kernelSpec;
        telemetryProps.interpreterFound = !!selection.interpreter;
        sendTelemetryEvent(Telemetry.FindKernelForLocalConnection, stopWatch.elapsedTime, telemetryProps);
        return selection;
    }

    /**
     * Gets a kernel that needs to be used with a remote session.
     * (will attempt to find the best matching kernel, or prompt user to use current interpreter or select one).
     *
     * @param {IJupyterSessionManager} [sessionManager]
     * @param {nbformat.INotebookMetadata} [notebookMetadata]
     * @param {CancellationToken} [cancelToken]
     * @returns {Promise<KernelSpecInterpreter>}
     * @memberof KernelSelector
     */
    // tslint:disable-next-line: cyclomatic-complexity
    @reportAction(ReportableAction.KernelsGetKernelForRemoteConnection)
    public async getKernelForRemoteConnection(
        resource: Resource,
        sessionManager?: IJupyterSessionManager,
        notebookMetadata?: nbformat.INotebookMetadata,
        cancelToken?: CancellationToken
    ): Promise<KernelSpecInterpreter> {
        const [interpreter, specs] = await Promise.all([
            this.interpreterService.getActiveInterpreter(resource),
            this.kernelService.getKernelSpecs(sessionManager, cancelToken)
        ]);
        let bestMatch: IJupyterKernelSpec | undefined;
        let bestScore = 0;
        for (let i = 0; specs && i < specs?.length; i = i + 1) {
            const spec = specs[i];
            let score = 0;

            // First match on language. No point if not python.
            if (spec && spec.language && spec.language.toLocaleLowerCase() === 'python') {
                // Language match
                score += 1;

                // See if the path matches. Don't bother if the language doesn't.
                if (spec && spec.path && spec.path.length > 0 && interpreter && spec.path === interpreter.path) {
                    // Path match
                    score += 10;
                }

                // See if the version is the same
                if (interpreter && interpreter.version && spec && spec.name) {
                    // Search for a digit on the end of the name. It should match our major version
                    const match = /\D+(\d+)/.exec(spec.name);
                    if (match && match !== null && match.length > 0) {
                        // See if the version number matches
                        const nameVersion = parseInt(match[1][0], 10);
                        if (nameVersion && nameVersion === interpreter.version.major) {
                            score += 4;
                        }
                    }
                }

                // See if the display name already matches.
                if (spec.display_name && spec.display_name === notebookMetadata?.kernelspec?.display_name) {
                    score += 2;
                }
            }

            if (score > bestScore) {
                bestMatch = spec;
                bestScore = score;
            }
        }

        return {
            kernelSpec: bestMatch,
            interpreter: interpreter
        };
    }
    private async selectKernel(
        resource: Resource,
        stopWatch: StopWatch,
        telemetryEvent: Telemetry,
        suggestions: IKernelSpecQuickPickItem[],
        session?: IJupyterSessionManager,
        cancelToken?: CancellationToken,
        currentKernel?: IJupyterKernelSpec | LiveKernelModel
    ) {
        const placeHolder =
            localize.DataScience.selectKernel() +
            (currentKernel ? ` (current: ${currentKernel.display_name || currentKernel.name})` : '');
        sendTelemetryEvent(telemetryEvent, stopWatch.elapsedTime);
        const selection = await this.applicationShell.showQuickPick(suggestions, { placeHolder }, cancelToken);
        if (!selection?.selection) {
            return {};
        }
        // Check if ipykernel is installed in this kernel.
        if (selection.selection.interpreter) {
            sendTelemetryEvent(Telemetry.SwitchToInterpreterAsKernel);
            return this.useInterpreterAsKernel(
                resource,
                selection.selection.interpreter,
                undefined,
                session,
                false,
                cancelToken
            );
        } else if (selection.selection.kernelModel) {
            sendTelemetryEvent(Telemetry.SwitchToExistingKernel, undefined, {
                language: this.computeLanguage(selection.selection.kernelModel.language)
            });
            // tslint:disable-next-line: no-any
            const interpreter = selection.selection.kernelModel
                ? await this.kernelService.findMatchingInterpreter(selection.selection.kernelModel, cancelToken)
                : undefined;
            return {
                kernelSpec: selection.selection.kernelSpec,
                interpreter,
                kernelModel: selection.selection.kernelModel
            };
        } else if (selection.selection.kernelSpec) {
            sendTelemetryEvent(Telemetry.SwitchToExistingKernel, undefined, {
                language: this.computeLanguage(selection.selection.kernelSpec.language)
            });
            const interpreter = selection.selection.kernelSpec
                ? await this.kernelService.findMatchingInterpreter(selection.selection.kernelSpec, cancelToken)
                : undefined;
            await this.kernelService.updateKernelEnvironment(interpreter, selection.selection.kernelSpec, cancelToken);
            return { kernelSpec: selection.selection.kernelSpec, interpreter };
        } else {
            return {};
        }
    }
    /**
     * Use the provided interpreter as a kernel.
     * If `displayNameOfKernelNotFound` is provided, then display a message indicating we're using the `current interpreter`.
     * This would happen when we're starting a notebook.
     * Otherwise, if not provided user is changing the kernel after starting a notebook.
     *
     * @private
     * @param {PythonInterpreter} interpreter
     * @param {string} [displayNameOfKernelNotFound]
     * @param {IJupyterSessionManager} [session]
     * @param {CancellationToken} [cancelToken]
     * @returns {Promise<KernelSpecInterpreter>}
     * @memberof KernelSelector
     */
    private async useInterpreterAsKernel(
        resource: Resource,
        interpreter: PythonInterpreter,
        displayNameOfKernelNotFound?: string,
        session?: IJupyterSessionManager,
        disableUI?: boolean,
        cancelToken?: CancellationToken
    ): Promise<KernelSpecInterpreter> {
        let kernelSpec: IJupyterKernelSpec | undefined;

        if (await this.installer.isInstalled(Product.ipykernel, interpreter)) {
            // Find the kernel associated with this interpter.
            kernelSpec = await this.kernelService.findMatchingKernelSpec(interpreter, session, cancelToken);

            if (kernelSpec) {
                traceVerbose(`ipykernel installed in ${interpreter.path}, and matching kernelspec found.`);
                // Make sure the environment matches.
                await this.kernelService.updateKernelEnvironment(interpreter, kernelSpec, cancelToken);

                // Notify the UI that we didn't find the initially requested kernel and are just using the active interpreter
                if (displayNameOfKernelNotFound && !disableUI) {
                    this.applicationShell
                        .showInformationMessage(
                            localize.DataScience.fallbackToUseActiveInterpeterAsKernel().format(
                                displayNameOfKernelNotFound
                            )
                        )
                        .then(noop, noop);
                }

                sendTelemetryEvent(Telemetry.UseInterpreterAsKernel);
                return { kernelSpec, interpreter };
            }
            traceInfo(`ipykernel installed in ${interpreter.path}, no matching kernel found. Will register kernel.`);
        }

        // Try an install this interpreter as a kernel.
        try {
            kernelSpec = await this.kernelService.registerKernel(interpreter, disableUI, cancelToken);
        } catch (e) {
            sendTelemetryEvent(Telemetry.KernelRegisterFailed);
            throw e;
        }

        // If we have a display name of a kernel that could not be found,
        // then notify user that we're using current interpreter instead.
        if (displayNameOfKernelNotFound && !disableUI) {
            this.applicationShell
                .showInformationMessage(
                    localize.DataScience.fallBackToRegisterAndUseActiveInterpeterAsKernel().format(
                        displayNameOfKernelNotFound
                    )
                )
                .then(noop, noop);
        }

        // When this method is called, we know a new kernel may have been registered.
        // Lets pre-warm the list of local kernels (with the new list).
        this.selectionProvider.getKernelSelectionsForLocalSession(resource, session, cancelToken).ignoreErrors();

        return { kernelSpec, interpreter };
    }

    private computeLanguage(language: string | undefined): string {
        if (language && KnownNotebookLanguages.includes(language.toLowerCase())) {
            return language;
        }
        return 'unknown';
    }
}
