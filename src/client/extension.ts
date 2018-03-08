'use strict';
// This line should always be right on top.
// tslint:disable-next-line:no-any
if ((Reflect as any).metadata === undefined) {
    // tslint:disable-next-line:no-require-imports no-var-requires
    require('reflect-metadata');
}
import { Container } from 'inversify';
import { Disposable, Memento, OutputChannel, window } from 'vscode';
import * as vscode from 'vscode';
import { ClassicExtensionActivator } from './activation/classic';
import { PtvsExtensionActivator } from './activation/ptvs';
import { IExtensionActivator } from './activation/types';
import { PythonSettings } from './common/configSettings';
import { STANDARD_OUTPUT_CHANNEL } from './common/constants';
import { createDeferred } from './common/helpers';
import { PythonInstaller } from './common/installer/pythonInstallation';
import { registerTypes as installerRegisterTypes } from './common/installer/serviceRegistry';
import { registerTypes as platformRegisterTypes } from './common/platform/serviceRegistry';
import { registerTypes as processRegisterTypes } from './common/process/serviceRegistry';
import { registerTypes as commonRegisterTypes } from './common/serviceRegistry';
import { GLOBAL_MEMENTO, IConfigurationService, IDisposableRegistry, ILogger, IMemento, IOutputChannel, WORKSPACE_MEMENTO } from './common/types';
import { registerTypes as variableRegisterTypes } from './common/variables/serviceRegistry';
import { BaseConfigurationProvider } from './debugger/configProviders/baseProvider';
import { registerTypes as debugConfigurationRegisterTypes } from './debugger/configProviders/serviceRegistry';
import { IDebugConfigurationProvider } from './debugger/types';
import { IInterpreterSelector } from './interpreter/configuration/types';
import { ICondaService, IInterpreterService } from './interpreter/contracts';
import { registerTypes as interpretersRegisterTypes } from './interpreter/serviceRegistry';
import { ServiceContainer } from './ioc/container';
import { ServiceManager } from './ioc/serviceManager';
import { IServiceContainer } from './ioc/types';
import { ReplProvider } from './providers/replProvider';
import { TerminalProvider } from './providers/terminalProvider';
import { activateUpdateSparkLibraryProvider } from './providers/updateSparkLibraryProvider';
import { sendTelemetryEvent } from './telemetry';
import { EDITOR_LOAD } from './telemetry/constants';
import { StopWatch } from './telemetry/stopWatch';
import { registerTypes as commonRegisterTerminalTypes } from './terminals/serviceRegistry';
import { ICodeExecutionManager } from './terminals/types';
import { TEST_OUTPUT_CHANNEL } from './unittests/common/constants';
import { registerTypes as unitTestsRegisterTypes } from './unittests/serviceRegistry';

const activationDeferred = createDeferred<void>();
export const activated = activationDeferred.promise;

// tslint:disable-next-line:max-func-body-length
export async function activate(context: vscode.ExtensionContext) {
    const cont = new Container();
    const serviceManager = new ServiceManager(cont);
    const serviceContainer = new ServiceContainer(cont);
    registerServices(context, serviceManager, serviceContainer);

    const interpreterManager = serviceContainer.get<IInterpreterService>(IInterpreterService);
    // This must be completed before we can continue as language server needs the interpreter path.
    interpreterManager.initialize();
    await interpreterManager.autoSetInterpreter();

    const configuration = serviceManager.get<IConfigurationService>(IConfigurationService);
    const pythonSettings = configuration.getSettings();

    const activator: IExtensionActivator = pythonSettings.usePtvs
        ? new PtvsExtensionActivator(serviceManager, pythonSettings)
        : new ClassicExtensionActivator(serviceManager, pythonSettings);

    await activator.activate(context);

    serviceManager.get<ICodeExecutionManager>(ICodeExecutionManager).registerCommands();
    // tslint:disable-next-line:no-floating-promises
    sendStartupTelemetry(activated, serviceContainer);

    const pythonInstaller = new PythonInstaller(serviceContainer);
    pythonInstaller.checkPythonInstallation(PythonSettings.getInstance())
        .catch(ex => console.error('Python Extension: pythonInstaller.checkPythonInstallation', ex));

    interpreterManager.refresh()
        .catch(ex => console.error('Python Extension: interpreterManager.refresh', ex));

    context.subscriptions.push(serviceContainer.get<IInterpreterSelector>(IInterpreterSelector));
    context.subscriptions.push(activateUpdateSparkLibraryProvider());

    context.subscriptions.push(new ReplProvider(serviceContainer));
    context.subscriptions.push(new TerminalProvider(serviceContainer));

    serviceContainer.getAll<BaseConfigurationProvider>(IDebugConfigurationProvider).forEach(debugConfig => {
        context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider(debugConfig.debugType, debugConfig));
    });
    activationDeferred.resolve();
}

function registerServices(context: vscode.ExtensionContext, serviceManager: ServiceManager, serviceContainer: ServiceContainer) {
    serviceManager.addSingletonInstance<IServiceContainer>(IServiceContainer, serviceContainer);
    serviceManager.addSingletonInstance<Disposable[]>(IDisposableRegistry, context.subscriptions);
    serviceManager.addSingletonInstance<Memento>(IMemento, context.globalState, GLOBAL_MEMENTO);
    serviceManager.addSingletonInstance<Memento>(IMemento, context.workspaceState, WORKSPACE_MEMENTO);

    const standardOutputChannel = window.createOutputChannel('Python');
    const unitTestOutChannel = window.createOutputChannel('Python Test Log');
    serviceManager.addSingletonInstance<OutputChannel>(IOutputChannel, standardOutputChannel, STANDARD_OUTPUT_CHANNEL);
    serviceManager.addSingletonInstance<OutputChannel>(IOutputChannel, unitTestOutChannel, TEST_OUTPUT_CHANNEL);

    commonRegisterTypes(serviceManager);
    processRegisterTypes(serviceManager);
    variableRegisterTypes(serviceManager);
    unitTestsRegisterTypes(serviceManager);
    interpretersRegisterTypes(serviceManager);
    platformRegisterTypes(serviceManager);
    installerRegisterTypes(serviceManager);
    commonRegisterTerminalTypes(serviceManager);
    debugConfigurationRegisterTypes(serviceManager);
}

async function sendStartupTelemetry(activatedPromise: Promise<void>, serviceContainer: IServiceContainer) {
    const stopWatch = new StopWatch();
    const logger = serviceContainer.get<ILogger>(ILogger);
    try {
        await activatedPromise;
        const duration = stopWatch.elapsedTime;
        const condaLocator = serviceContainer.get<ICondaService>(ICondaService);
        const condaVersion = await condaLocator.getCondaVersion().catch(() => undefined);
        const props = condaVersion ? { condaVersion } : undefined;
        sendTelemetryEvent(EDITOR_LOAD, duration, props);
    } catch (ex) {
        logger.logError('sendStartupTelemetry failed.', ex);
    }
}
