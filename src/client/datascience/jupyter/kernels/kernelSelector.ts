// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import type { nbformat } from '@jupyterlab/coreutils';
import type { Kernel } from '@jupyterlab/services';
import { sha256 } from 'hash.js';
import { inject, injectable } from 'inversify';
// tslint:disable-next-line: no-require-imports
import cloneDeep = require('lodash/cloneDeep');
import { CancellationToken } from 'vscode-jsonrpc';
import { IApplicationShell } from '../../../common/application/types';
import '../../../common/extensions';
import { traceError, traceInfo, traceVerbose } from '../../../common/logger';
import { IConfigurationService, IDisposableRegistry, Resource } from '../../../common/types';
import * as localize from '../../../common/utils/localize';
import { noop } from '../../../common/utils/misc';
import { StopWatch } from '../../../common/utils/stopWatch';
import { IInterpreterService } from '../../../interpreter/contracts';
import { PythonEnvironment } from '../../../pythonEnvironments/info';
import { IEventNamePropertyMapping, sendTelemetryEvent } from '../../../telemetry';
import { Commands, KnownNotebookLanguages, Settings, Telemetry } from '../../constants';
import { IKernelFinder } from '../../kernel-launcher/types';
import { getInterpreterInfoStoredInMetadata } from '../../notebookStorage/baseModel';
import { reportAction } from '../../progress/decorator';
import { ReportableAction } from '../../progress/types';
import {
    IJupyterConnection,
    IJupyterKernelSpec,
    IJupyterSessionManager,
    IJupyterSessionManagerFactory,
    IKernelDependencyService,
    INotebookMetadataLive,
    INotebookProviderConnection,
    KernelInterpreterDependencyResponse
} from '../../types';
import { createDefaultKernelSpec, getDisplayNameOrNameOfKernelConnection, isPythonKernelConnection } from './helpers';
import { KernelSelectionProvider } from './kernelSelections';
import { KernelService } from './kernelService';
import {
    DefaultKernelConnectionMetadata,
    IKernelSelectionUsage,
    IKernelSpecQuickPickItem,
    KernelConnectionMetadata,
    KernelSpecConnectionMetadata,
    LiveKernelConnectionMetadata,
    PythonKernelConnectionMetadata
} from './types';

/**
 * All KernelConnections returned (as return values of methods) by the KernelSelector can be used in a number of ways.
 * E.g. some part of the code update the `interpreter` property in the `KernelConnectionMetadata` object.
 * We need to ensure such changes (i.e. updates to the `KernelConnectionMetadata`) downstream do not change the original `KernelConnectionMetadata`.
 * Hence always clone the `KernelConnectionMetadata` returned by the `kernelSelector`.
 */
@injectable()
export class KernelSelector implements IKernelSelectionUsage {
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
        @inject(IKernelDependencyService) private readonly kernelDependencyService: IKernelDependencyService,
        @inject(IKernelFinder) private readonly kernelFinder: IKernelFinder,
        @inject(IJupyterSessionManagerFactory) private jupyterSessionManagerFactory: IJupyterSessionManagerFactory,
        @inject(IConfigurationService) private configService: IConfigurationService,
        @inject(IDisposableRegistry) disposableRegistry: IDisposableRegistry
    ) {
        disposableRegistry.push(
            this.jupyterSessionManagerFactory.onRestartSessionCreated(this.addKernelToIgnoreList.bind(this))
        );
        disposableRegistry.push(
            this.jupyterSessionManagerFactory.onRestartSessionUsed(this.removeKernelFromIgnoreList.bind(this))
        );
    }

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
     */
    public async selectRemoteKernel(
        resource: Resource,
        stopWatch: StopWatch,
        session: IJupyterSessionManager,
        cancelToken?: CancellationToken,
        currentKernelDisplayName?: string
    ): Promise<LiveKernelConnectionMetadata | KernelSpecConnectionMetadata | undefined> {
        let suggestions = await this.selectionProvider.getKernelSelectionsForRemoteSession(
            resource,
            session,
            cancelToken
        );
        suggestions = suggestions.filter((item) => !this.kernelIdsToHide.has(item.selection.kernelModel?.id || ''));
        const selection = await this.selectKernel<LiveKernelConnectionMetadata | KernelSpecConnectionMetadata>(
            resource,
            'jupyter',
            stopWatch,
            Telemetry.SelectRemoteJupyterKernel,
            suggestions,
            session,
            cancelToken,
            currentKernelDisplayName
        );
        return cloneDeep(selection);
    }
    /**
     * Select a kernel from a local session.
     */
    public async selectLocalKernel(
        resource: Resource,
        type: 'raw' | 'jupyter' | 'noConnection',
        stopWatch: StopWatch,
        session?: IJupyterSessionManager,
        cancelToken?: CancellationToken,
        currentKernelDisplayName?: string
    ): Promise<KernelSpecConnectionMetadata | PythonKernelConnectionMetadata | undefined> {
        const suggestions = await this.selectionProvider.getKernelSelectionsForLocalSession(
            resource,
            type,
            session,
            cancelToken
        );
        const selection = await this.selectKernel<KernelSpecConnectionMetadata | PythonKernelConnectionMetadata>(
            resource,
            type,
            stopWatch,
            Telemetry.SelectLocalJupyterKernel,
            suggestions,
            session,
            cancelToken,
            currentKernelDisplayName
        );
        return cloneDeep(selection);
    }
    /**
     * Gets a kernel that needs to be used with a local session.
     * (will attempt to find the best matching kernel, or prompt user to use current interpreter or select one).
     */
    @reportAction(ReportableAction.KernelsGetKernelForLocalConnection)
    public async getPreferredKernelForLocalConnection(
        resource: Resource,
        type: 'raw' | 'jupyter' | 'noConnection',
        sessionManager?: IJupyterSessionManager,
        notebookMetadata?: nbformat.INotebookMetadata,
        disableUI?: boolean,
        cancelToken?: CancellationToken,
        ignoreDependencyCheck?: boolean
    ): Promise<
        KernelSpecConnectionMetadata | PythonKernelConnectionMetadata | DefaultKernelConnectionMetadata | undefined
    > {
        const stopWatch = new StopWatch();
        const telemetryProps: IEventNamePropertyMapping[Telemetry.FindKernelForLocalConnection] = {
            kernelSpecFound: false,
            interpreterFound: false,
            promptedToSelect: false
        };
        // When this method is called, we know we've started a local jupyter server or are connecting raw
        // Lets pre-warm the list of local kernels.
        this.selectionProvider
            .getKernelSelectionsForLocalSession(resource, type, sessionManager, cancelToken)
            .ignoreErrors();

        let selection:
            | KernelSpecConnectionMetadata
            | PythonKernelConnectionMetadata
            | DefaultKernelConnectionMetadata
            | undefined;

        if (type === 'jupyter') {
            selection = await this.getKernelForLocalJupyterConnection(
                resource,
                stopWatch,
                telemetryProps,
                sessionManager,
                notebookMetadata,
                disableUI,
                cancelToken
            );
        } else if (type === 'raw') {
            selection = await this.getKernelForLocalRawConnection(
                resource,
                notebookMetadata,
                cancelToken,
                ignoreDependencyCheck
            );
        }

        // If still not found, log an error (this seems possible for some people, so use the default)
        if (!selection || !selection.kernelSpec) {
            traceError('Jupyter Kernel Spec not found for a local connection');
        }

        telemetryProps.kernelSpecFound = !!selection?.kernelSpec;
        telemetryProps.interpreterFound = !!selection?.interpreter;
        sendTelemetryEvent(Telemetry.FindKernelForLocalConnection, stopWatch.elapsedTime, telemetryProps);
        const itemToReturn = cloneDeep(selection);
        if (itemToReturn) {
            itemToReturn.interpreter =
                itemToReturn.interpreter || (await this.interpreterService.getActiveInterpreter(resource));
        }
        return itemToReturn;
    }

    /**
     * Gets a kernel that needs to be used with a remote session.
     * (will attempt to find the best matching kernel, or prompt user to use current interpreter or select one).
     */
    // tslint:disable-next-line: cyclomatic-complexity
    @reportAction(ReportableAction.KernelsGetKernelForRemoteConnection)
    public async getPreferredKernelForRemoteConnection(
        resource: Resource,
        sessionManager?: IJupyterSessionManager,
        notebookMetadata?: INotebookMetadataLive,
        cancelToken?: CancellationToken
    ): Promise<KernelConnectionMetadata | undefined> {
        const [interpreter, specs, sessions] = await Promise.all([
            this.interpreterService.getActiveInterpreter(resource),
            this.kernelService.getKernelSpecs(sessionManager, cancelToken),
            sessionManager?.getRunningSessions()
        ]);

        // First check for a live active session.
        if (notebookMetadata && notebookMetadata.id) {
            const session = sessions?.find((s) => s.kernel.id === notebookMetadata?.id);
            if (session) {
                // tslint:disable-next-line: no-any
                const liveKernel = session.kernel as any;
                const lastActivityTime = liveKernel.last_activity
                    ? new Date(Date.parse(liveKernel.last_activity.toString()))
                    : new Date();
                const numberOfConnections = liveKernel.connections
                    ? parseInt(liveKernel.connections.toString(), 10)
                    : 0;
                return cloneDeep({
                    kernelModel: { ...session.kernel, lastActivityTime, numberOfConnections, session },
                    interpreter: interpreter,
                    kind: 'connectToLiveKernel'
                });
            }
        }

        // No running session, try matching based on interpreter
        let bestMatch: IJupyterKernelSpec | undefined;
        let bestScore = -1;
        for (let i = 0; specs && i < specs?.length; i = i + 1) {
            const spec = specs[i];
            let score = 0;

            if (spec) {
                // See if the path matches.
                if (spec && spec.path && spec.path.length > 0 && interpreter && spec.path === interpreter.path) {
                    // Path match
                    score += 8;
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
                    score += 16;
                }
            }

            if (score > bestScore) {
                bestMatch = spec;
                bestScore = score;
            }
        }

        if (bestMatch) {
            return cloneDeep({
                kernelSpec: bestMatch,
                interpreter: interpreter,
                kind: 'startUsingKernelSpec'
            });
        } else {
            // Unlikely scenario, we expect there to be at least one kernel spec.
            // Either way, return so that we can start using the default kernel.
            return cloneDeep({
                interpreter: interpreter,
                kind: 'startUsingDefaultKernel'
            });
        }
    }
    public async useSelectedKernel(
        selection: KernelConnectionMetadata,
        resource: Resource,
        type: 'raw' | 'jupyter' | 'noConnection',
        session?: IJupyterSessionManager,
        cancelToken?: CancellationToken
    ): Promise<KernelConnectionMetadata | undefined> {
        // Check if ipykernel is installed in this kernel.
        if (selection.interpreter && type === 'jupyter') {
            sendTelemetryEvent(Telemetry.SwitchToInterpreterAsKernel);
            const item = await this.useInterpreterAsKernel(
                resource,
                selection.interpreter,
                type,
                undefined,
                session,
                false,
                cancelToken
            );
            return cloneDeep(item);
        } else if (selection.interpreter && type === 'raw') {
            const item = await this.useInterpreterAndDefaultKernel(selection.interpreter);
            return cloneDeep(item);
        } else if (selection.kind === 'connectToLiveKernel') {
            sendTelemetryEvent(Telemetry.SwitchToExistingKernel, undefined, {
                language: this.computeLanguage(selection.kernelModel.language)
            });
            // tslint:disable-next-line: no-any
            const interpreter = selection.kernelModel
                ? await this.kernelService.findMatchingInterpreter(selection.kernelModel, cancelToken)
                : undefined;
            return cloneDeep({
                interpreter,
                kernelModel: selection.kernelModel,
                kind: 'connectToLiveKernel'
            });
        } else if (selection.kernelSpec) {
            sendTelemetryEvent(Telemetry.SwitchToExistingKernel, undefined, {
                language: this.computeLanguage(selection.kernelSpec.language)
            });
            const interpreter = selection.kernelSpec
                ? await this.kernelService.findMatchingInterpreter(selection.kernelSpec, cancelToken)
                : undefined;
            await this.kernelService.updateKernelEnvironment(interpreter, selection.kernelSpec, cancelToken);
            return cloneDeep({ kernelSpec: selection.kernelSpec, interpreter, kind: 'startUsingKernelSpec' });
        } else {
            return;
        }
    }
    public async askForLocalKernel(
        resource: Resource,
        type: 'raw' | 'jupyter' | 'noConnection',
        kernelConnection?: KernelConnectionMetadata
    ): Promise<KernelConnectionMetadata | undefined> {
        const displayName = getDisplayNameOrNameOfKernelConnection(kernelConnection);
        const message = localize.DataScience.sessionStartFailedWithKernel().format(
            displayName,
            Commands.ViewJupyterOutput
        );
        const selectKernel = localize.DataScience.selectDifferentKernel();
        const cancel = localize.Common.cancel();
        const selection = await this.applicationShell.showErrorMessage(message, selectKernel, cancel);
        if (selection === selectKernel) {
            const item = await this.selectLocalJupyterKernel(resource, type, displayName);
            return cloneDeep(item);
        }
    }
    public async selectJupyterKernel(
        resource: Resource,
        connection: INotebookProviderConnection | undefined,
        type: 'raw' | 'jupyter',
        currentKernelDisplayName: string | undefined
    ): Promise<KernelConnectionMetadata | undefined> {
        let kernelConnection: KernelConnectionMetadata | undefined;
        const settings = this.configService.getSettings(resource);
        const isLocalConnection =
            connection?.localLaunch ??
            settings.datascience.jupyterServerURI.toLowerCase() === Settings.JupyterServerLocalLaunch;

        if (isLocalConnection) {
            kernelConnection = await this.selectLocalJupyterKernel(
                resource,
                connection?.type || type,
                currentKernelDisplayName
            );
        } else if (connection && connection.type === 'jupyter') {
            kernelConnection = await this.selectRemoteJupyterKernel(resource, connection, currentKernelDisplayName);
        }
        return cloneDeep(kernelConnection);
    }

    private async selectLocalJupyterKernel(
        resource: Resource,
        type: 'raw' | 'jupyter' | 'noConnection',
        currentKernelDisplayName: string | undefined
    ): Promise<KernelConnectionMetadata | undefined> {
        return this.selectLocalKernel(resource, type, new StopWatch(), undefined, undefined, currentKernelDisplayName);
    }

    private async selectRemoteJupyterKernel(
        resource: Resource,
        connInfo: IJupyterConnection,
        currentKernelDisplayName?: string
    ): Promise<KernelConnectionMetadata | undefined> {
        const stopWatch = new StopWatch();
        const session = await this.jupyterSessionManagerFactory.create(connInfo);
        return this.selectRemoteKernel(resource, stopWatch, session, undefined, currentKernelDisplayName);
    }

    // Get our kernelspec and matching interpreter for a connection to a local jupyter server
    private async getKernelForLocalJupyterConnection(
        resource: Resource,
        stopWatch: StopWatch,
        telemetryProps: IEventNamePropertyMapping[Telemetry.FindKernelForLocalConnection],
        sessionManager?: IJupyterSessionManager,
        notebookMetadata?: nbformat.INotebookMetadata,
        disableUI?: boolean,
        cancelToken?: CancellationToken
    ): Promise<
        KernelSpecConnectionMetadata | PythonKernelConnectionMetadata | DefaultKernelConnectionMetadata | undefined
    > {
        if (notebookMetadata?.kernelspec) {
            const kernelSpec = await this.kernelService.findMatchingKernelSpec(
                notebookMetadata?.kernelspec,
                sessionManager,
                cancelToken
            );
            if (kernelSpec) {
                const interpreter = await this.kernelService.findMatchingInterpreter(kernelSpec, cancelToken);
                sendTelemetryEvent(Telemetry.UseExistingKernel);

                // Make sure we update the environment in the kernel before using it
                await this.kernelService.updateKernelEnvironment(interpreter, kernelSpec, cancelToken);
                return { kind: 'startUsingKernelSpec', interpreter, kernelSpec };
            } else if (!cancelToken?.isCancellationRequested) {
                // No kernel info, hence prompt to use current interpreter as a kernel.
                const activeInterpreter = await this.interpreterService.getActiveInterpreter(resource);
                if (activeInterpreter) {
                    return this.useInterpreterAsKernel(
                        resource,
                        activeInterpreter,
                        'jupyter',
                        notebookMetadata.kernelspec.display_name,
                        sessionManager,
                        disableUI,
                        cancelToken
                    );
                } else {
                    telemetryProps.promptedToSelect = true;
                    return this.selectLocalKernel(resource, 'jupyter', stopWatch, sessionManager, cancelToken);
                }
            }
        } else if (!cancelToken?.isCancellationRequested) {
            // No kernel info, hence use current interpreter as a kernel.
            const activeInterpreter = await this.interpreterService.getActiveInterpreter(resource);
            if (activeInterpreter) {
                const kernelSpec = await this.kernelService.searchAndRegisterKernel(
                    activeInterpreter,
                    disableUI,
                    cancelToken
                );
                if (kernelSpec) {
                    return { kind: 'startUsingKernelSpec', kernelSpec, interpreter: activeInterpreter };
                } else {
                    return { kind: 'startUsingDefaultKernel', interpreter: activeInterpreter };
                }
            }
        }
    }
    private async findInterpreterStoredInNotebookMetadata(
        resource: Resource,
        notebookMetadata?: nbformat.INotebookMetadata
    ): Promise<PythonEnvironment | undefined> {
        const info = getInterpreterInfoStoredInMetadata(notebookMetadata);
        if (!info) {
            return;
        }
        const interpreters = await this.interpreterService.getInterpreters(resource);
        return interpreters.find((item) => sha256().update(item.path).digest('hex') === info.hash);
    }

    // Get our kernelspec and interpreter for a local raw connection
    private async getKernelForLocalRawConnection(
        resource: Resource,
        notebookMetadata?: nbformat.INotebookMetadata,
        cancelToken?: CancellationToken,
        ignoreDependencyCheck?: boolean
    ): Promise<KernelSpecConnectionMetadata | PythonKernelConnectionMetadata | undefined> {
        // If user had selected an interpreter (raw kernel), then that interpreter would be stored in the kernelspec metadata.
        // Find this matching interpreter & start that using raw kernel.
        const interpreterStoredInKernelSpec = await this.findInterpreterStoredInNotebookMetadata(
            resource,
            notebookMetadata
        );
        if (interpreterStoredInKernelSpec) {
            return {
                kind: 'startUsingPythonInterpreter',
                interpreter: interpreterStoredInKernelSpec
            };
        }

        // First use our kernel finder to locate a kernelspec on disk
        const kernelSpec = await this.kernelFinder.findKernelSpec(resource, notebookMetadata, cancelToken);
        const activeInterpreter = await this.interpreterService.getActiveInterpreter(resource);
        if (!kernelSpec && !activeInterpreter) {
            return;
        } else if (!kernelSpec && activeInterpreter) {
            await this.installDependenciesIntoInterpreter(activeInterpreter, ignoreDependencyCheck, cancelToken);

            // Return current interpreter.
            return {
                kind: 'startUsingPythonInterpreter',
                interpreter: activeInterpreter
            };
        } else if (kernelSpec) {
            // Locate the interpreter that matches our kernelspec
            const interpreter = await this.kernelService.findMatchingInterpreter(kernelSpec, cancelToken);

            const connectionInfo: KernelSpecConnectionMetadata = {
                kind: 'startUsingKernelSpec',
                kernelSpec,
                interpreter
            };
            // Install missing depednencies only if we're dealing with a Python kernel.
            if (interpreter && isPythonKernelConnection(connectionInfo)) {
                await this.installDependenciesIntoInterpreter(interpreter, ignoreDependencyCheck, cancelToken);
            }
            return connectionInfo;
        }
    }

    private async selectKernel<T extends KernelConnectionMetadata>(
        resource: Resource,
        type: 'raw' | 'jupyter' | 'noConnection',
        stopWatch: StopWatch,
        telemetryEvent: Telemetry,
        suggestions: IKernelSpecQuickPickItem<T>[],
        session?: IJupyterSessionManager,
        cancelToken?: CancellationToken,
        currentKernelDisplayName?: string
    ) {
        const placeHolder =
            localize.DataScience.selectKernel() +
            (currentKernelDisplayName ? ` (current: ${currentKernelDisplayName})` : '');
        sendTelemetryEvent(telemetryEvent, stopWatch.elapsedTime);
        const selection = await this.applicationShell.showQuickPick(suggestions, { placeHolder }, cancelToken);
        if (!selection?.selection) {
            return;
        }
        return (this.useSelectedKernel(selection.selection, resource, type, session, cancelToken) as unknown) as
            | T
            | undefined;
    }

    // When switching to an interpreter in raw kernel mode then just create a default kernelspec for that interpreter to use
    private async useInterpreterAndDefaultKernel(interpreter: PythonEnvironment): Promise<KernelConnectionMetadata> {
        const kernelSpec = createDefaultKernelSpec(interpreter);
        return { kernelSpec, interpreter, kind: 'startUsingPythonInterpreter' };
    }

    // If we need to install our dependencies now (for non-native scenarios)
    // then install ipykernel into the interpreter or throw error
    private async installDependenciesIntoInterpreter(
        interpreter: PythonEnvironment,
        ignoreDependencyCheck?: boolean,
        cancelToken?: CancellationToken
    ) {
        if (!ignoreDependencyCheck) {
            if (
                (await this.kernelDependencyService.installMissingDependencies(interpreter, cancelToken)) !==
                KernelInterpreterDependencyResponse.ok
            ) {
                throw new Error(
                    localize.DataScience.ipykernelNotInstalled().format(interpreter.displayName || interpreter.path)
                );
            }
        }
    }

    /**
     * Use the provided interpreter as a kernel.
     * If `displayNameOfKernelNotFound` is provided, then display a message indicating we're using the `current interpreter`.
     * This would happen when we're starting a notebook.
     * Otherwise, if not provided user is changing the kernel after starting a notebook.
     */
    private async useInterpreterAsKernel(
        resource: Resource,
        interpreter: PythonEnvironment,
        type: 'raw' | 'jupyter' | 'noConnection',
        displayNameOfKernelNotFound?: string,
        session?: IJupyterSessionManager,
        disableUI?: boolean,
        cancelToken?: CancellationToken
    ): Promise<KernelSpecConnectionMetadata | undefined> {
        let kernelSpec: IJupyterKernelSpec | undefined;

        if (await this.kernelDependencyService.areDependenciesInstalled(interpreter, cancelToken)) {
            // Find the kernel associated with this interpreter.
            kernelSpec = await this.kernelService.findMatchingKernelSpec(interpreter, session, cancelToken);

            if (kernelSpec) {
                traceVerbose(`ipykernel installed in ${interpreter.path}, and matching kernelspec found.`);
                // Make sure the environment matches.
                await this.kernelService.updateKernelEnvironment(interpreter, kernelSpec, cancelToken);

                // Notify the UI that we didn't find the initially requested kernel and are just using the active interpreter
                if (displayNameOfKernelNotFound && !disableUI) {
                    this.applicationShell
                        .showInformationMessage(
                            localize.DataScience.fallbackToUseActiveInterpreterAsKernel().format(
                                displayNameOfKernelNotFound
                            )
                        )
                        .then(noop, noop);
                }

                sendTelemetryEvent(Telemetry.UseInterpreterAsKernel);
                return { kind: 'startUsingKernelSpec', kernelSpec, interpreter };
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
        this.selectionProvider.getKernelSelectionsForLocalSession(resource, type, session, cancelToken).ignoreErrors();

        if (kernelSpec) {
            return { kind: 'startUsingKernelSpec', kernelSpec, interpreter };
        }
    }

    private computeLanguage(language: string | undefined): string {
        if (language && KnownNotebookLanguages.includes(language.toLowerCase())) {
            return language;
        }
        return 'unknown';
    }
}
