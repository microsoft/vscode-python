// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { IWorkspaceService } from './common/application/types';
import { isTestExecution } from './common/constants';
import { DeprecatePythonPath } from './common/experiments/groups';
import { traceError } from './common/logger';
import { ITerminalHelper } from './common/terminal/types';
import {
    IConfigurationService,
    IExperimentsManager,
    IInterpreterPathService,
    InspectInterpreterSettingType,
    Resource
} from './common/types';
import {
    AutoSelectionRule,
    IInterpreterAutoSelectionRule,
    IInterpreterAutoSelectionService
} from './interpreter/autoSelection/types';
import { ICondaService, IInterpreterService } from './interpreter/contracts';
import { IServiceContainer } from './ioc/types';
import { PythonInterpreter } from './pythonEnvironments/discovery/types';
import { sendTelemetryEvent } from './telemetry';
import { EventName } from './telemetry/constants';
import { EditorLoadTelemetry } from './telemetry/types';

interface IStopWatch {
    elapsedTime: number;
}

export async function sendStartupTelemetry(
    // tslint:disable-next-line:no-any
    activatedPromise: Promise<any>,
    durations: Record<string, number>,
    stopWatch: IStopWatch,
    serviceContainer: IServiceContainer
) {
    if (isTestExecution()) {
        return;
    }

    try {
        await activatedPromise;
        durations.totalActivateTime = stopWatch.elapsedTime;
        const props = await getActivationTelemetryProps(serviceContainer);
        sendTelemetryEvent(EventName.EDITOR_LOAD, durations, props);
    } catch (ex) {
        traceError('sendStartupTelemetry() failed.', ex);
    }
}

export async function sendErrorTelemetry(
    ex: Error,
    durations: Record<string, number>,
    serviceContainer?: IServiceContainer
) {
    try {
        // tslint:disable-next-line:no-any
        let props: any = {};
        if (serviceContainer) {
            try {
                props = await getActivationTelemetryProps(serviceContainer);
            } catch (ex) {
                traceError('getActivationTelemetryProps() failed.', ex);
            }
        }
        sendTelemetryEvent(EventName.EDITOR_LOAD, durations, props, ex);
    } catch (exc2) {
        traceError('sendErrorTelemetry() failed.', exc2);
    }
}

function isUsingGlobalInterpreterInWorkspace(currentPythonPath: string, serviceContainer: IServiceContainer): boolean {
    const service = serviceContainer.get<IInterpreterAutoSelectionService>(IInterpreterAutoSelectionService);
    const globalInterpreter = service.getAutoSelectedInterpreter(undefined);
    if (!globalInterpreter) {
        return false;
    }
    return currentPythonPath === globalInterpreter.path;
}

export function hasUserDefinedPythonPath(resource: Resource, serviceContainer: IServiceContainer) {
    const abExperiments = serviceContainer.get<IExperimentsManager>(IExperimentsManager);
    const workspaceService = serviceContainer.get<IWorkspaceService>(IWorkspaceService);
    const interpreterPathService = serviceContainer.get<IInterpreterPathService>(IInterpreterPathService);
    let settings: InspectInterpreterSettingType;
    if (abExperiments.inExperiment(DeprecatePythonPath.experiment)) {
        settings = interpreterPathService.inspect(resource);
    } else {
        settings = workspaceService.getConfiguration('python', resource)!.inspect<string>('pythonPath')!;
    }
    abExperiments.sendTelemetryIfInExperiment(DeprecatePythonPath.control);
    return (settings.workspaceFolderValue && settings.workspaceFolderValue !== 'python') ||
        (settings.workspaceValue && settings.workspaceValue !== 'python') ||
        (settings.globalValue && settings.globalValue !== 'python')
        ? true
        : false;
}

function getPreferredWorkspaceInterpreter(resource: Resource, serviceContainer: IServiceContainer) {
    const workspaceInterpreterSelector = serviceContainer.get<IInterpreterAutoSelectionRule>(
        IInterpreterAutoSelectionRule,
        AutoSelectionRule.workspaceVirtualEnvs
    );
    const interpreter = workspaceInterpreterSelector.getPreviouslyAutoSelectedInterpreter(resource);
    return interpreter ? interpreter.path : undefined;
}

async function getActivationTelemetryProps(serviceContainer: IServiceContainer): Promise<EditorLoadTelemetry> {
    // tslint:disable-next-line:no-suspicious-comment
    // TODO: Not all of this data is showing up in the database...
    // tslint:disable-next-line:no-suspicious-comment
    // TODO: If any one of these parts fails we send no info.  We should
    // be able to partially populate as much as possible instead
    // (through granular try-catch statements).
    const terminalHelper = serviceContainer.get<ITerminalHelper>(ITerminalHelper);
    const terminalShellType = terminalHelper.identifyTerminalShell();
    const condaLocator = serviceContainer.get<ICondaService>(ICondaService);
    const interpreterService = serviceContainer.get<IInterpreterService>(IInterpreterService);
    const workspaceService = serviceContainer.get<IWorkspaceService>(IWorkspaceService);
    const configurationService = serviceContainer.get<IConfigurationService>(IConfigurationService);
    const mainWorkspaceUri = workspaceService.hasWorkspaceFolders
        ? workspaceService.workspaceFolders![0].uri
        : undefined;
    const settings = configurationService.getSettings(mainWorkspaceUri);
    const [condaVersion, interpreter, interpreters] = await Promise.all([
        condaLocator
            .getCondaVersion()
            .then((ver) => (ver ? ver.raw : ''))
            .catch<string>(() => ''),
        interpreterService.getActiveInterpreter().catch<PythonInterpreter | undefined>(() => undefined),
        interpreterService.getInterpreters(mainWorkspaceUri).catch<PythonInterpreter[]>(() => [])
    ]);
    const workspaceFolderCount = workspaceService.hasWorkspaceFolders ? workspaceService.workspaceFolders!.length : 0;
    const pythonVersion = interpreter && interpreter.version ? interpreter.version.raw : undefined;
    const interpreterType = interpreter ? interpreter.type : undefined;
    const usingUserDefinedInterpreter = hasUserDefinedPythonPath(mainWorkspaceUri, serviceContainer);
    const preferredWorkspaceInterpreter = getPreferredWorkspaceInterpreter(mainWorkspaceUri, serviceContainer);
    const usingGlobalInterpreter = isUsingGlobalInterpreterInWorkspace(settings.pythonPath, serviceContainer);
    const usingAutoSelectedWorkspaceInterpreter = preferredWorkspaceInterpreter
        ? settings.pythonPath === getPreferredWorkspaceInterpreter(mainWorkspaceUri, serviceContainer)
        : false;
    const hasPython3 =
        interpreters!.filter((item) => (item && item.version ? item.version.major === 3 : false)).length > 0;

    return {
        condaVersion,
        terminal: terminalShellType,
        pythonVersion,
        interpreterType,
        workspaceFolderCount,
        hasPython3,
        usingUserDefinedInterpreter,
        usingAutoSelectedWorkspaceInterpreter,
        usingGlobalInterpreter
    };
}
