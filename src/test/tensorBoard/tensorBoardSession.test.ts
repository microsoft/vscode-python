import { assert } from 'chai';
import Sinon, * as sinon from 'sinon';
import { SemVer } from 'semver';
import { IApplicationShell, ICommandManager } from '../../client/common/application/types';
import { IExperimentService, IInstaller, InstallerResponse, ProductInstallStatus } from '../../client/common/types';
import { TensorBoard } from '../../client/common/utils/localize';
import { IServiceManager } from '../../client/ioc/types';
import { TensorBoardEntrypoint, TensorBoardEntrypointTrigger } from '../../client/tensorBoard/constants';
import { TensorBoardSession } from '../../client/tensorBoard/tensorBoardSession';
import { closeActiveWindows, initialize } from '../initialize';
import * as ExperimentHelpers from '../../client/common/experiments/helpers';
import { IInterpreterService } from '../../client/interpreter/contracts';
import { Architecture } from '../../client/common/utils/platform';
import { PythonEnvironment, EnvironmentType } from '../../client/pythonEnvironments/info';
import { PYTHON_PATH } from '../common';

const info: PythonEnvironment = {
    architecture: Architecture.Unknown,
    companyDisplayName: '',
    displayName: '',
    envName: '',
    path: '',
    envType: EnvironmentType.Unknown,
    version: new SemVer('0.0.0-alpha'),
    sysPrefix: '',
    sysVersion: '',
};

suite('TensorBoard session creation', async () => {
    let serviceManager: IServiceManager;
    let errorMessageStub: Sinon.SinonStub;
    let sandbox: Sinon.SinonSandbox;
    let applicationShell: IApplicationShell;
    let commandManager: ICommandManager;

    suiteSetup(function () {
        if (process.env.CI_PYTHON_VERSION === '2.7') {
            // TensorBoard 2.4.1 not available for Python 2.7
            this.skip();
        }
    });

    setup(async function () {
        sandbox = sinon.createSandbox();
        ({ serviceManager } = await initialize());
        sandbox.stub(ExperimentHelpers, 'inDiscoveryExperiment').resolves(false);
        // Pretend to be in experiment
        const experimentService = serviceManager.get<IExperimentService>(IExperimentService);
        sandbox.stub(experimentService, 'inExperiment').resolves(true);

        // Ensure we use CI Python
        const interpreter: PythonEnvironment = {
            ...info,
            envType: EnvironmentType.Unknown,
            path: PYTHON_PATH,
        };
        const interpreterService = serviceManager.get<IInterpreterService>(IInterpreterService);
        sandbox.stub(interpreterService, 'getActiveInterpreter').resolves(interpreter);

        applicationShell = serviceManager.get<IApplicationShell>(IApplicationShell);
        errorMessageStub = sandbox.stub(applicationShell, 'showErrorMessage');
        commandManager = serviceManager.get<ICommandManager>(ICommandManager);
    });

    teardown(async () => {
        await closeActiveWindows();
        sandbox.restore();
    });

    test('Golden path: TensorBoard session starts successfully and webview is shown', async () => {
        // Stub user selections
        sandbox.stub(applicationShell, 'showQuickPick').resolves({ label: TensorBoard.useCurrentWorkingDirectory() });

        const session = (await commandManager.executeCommand(
            'python.launchTensorBoard',
            TensorBoardEntrypoint.palette,
            TensorBoardEntrypointTrigger.palette,
        )) as TensorBoardSession;

        assert.ok(session.panel?.visible, 'Webview panel not shown on session creation golden path');
        assert.ok(errorMessageStub.notCalled, 'Error message shown on session creation golden path');
    });
    test('When webview is closed, session is killed', async () => {
        // Stub user selections
        sandbox.stub(applicationShell, 'showQuickPick').resolves({ label: TensorBoard.useCurrentWorkingDirectory() });

        const session = (await commandManager.executeCommand(
            'python.launchTensorBoard',
            TensorBoardEntrypoint.palette,
            TensorBoardEntrypointTrigger.palette,
        )) as TensorBoardSession;

        const { daemon, panel } = session;
        assert.ok(panel?.visible, 'Webview panel not shown');
        panel?.dispose();
        assert.ok(session.panel === undefined, 'Webview still visible');
        assert.ok(daemon?.killed, 'TensorBoard session process not killed after webview closed');
    });
    test('When user selects file picker, display file picker', async () => {
        // Stub user selections
        sandbox.stub(applicationShell, 'showQuickPick').resolves({ label: TensorBoard.selectAnotherFolder() });
        const filePickerStub = sandbox.stub(applicationShell, 'showOpenDialog');

        // Create session
        await commandManager.executeCommand(
            'python.launchTensorBoard',
            TensorBoardEntrypoint.palette,
            TensorBoardEntrypointTrigger.palette,
        );

        assert.ok(filePickerStub.called, 'User requests to select another folder and file picker was not shown');
    });
    test('If user does not select a logdir, do not show error', async () => {
        // Stub user selections
        sandbox.stub(applicationShell, 'showQuickPick').resolves({ label: TensorBoard.selectAFolder() });
        sandbox.stub(applicationShell, 'showOpenDialog').resolves(undefined);

        // Create session
        await commandManager.executeCommand(
            'python.launchTensorBoard',
            TensorBoardEntrypoint.palette,
            TensorBoardEntrypointTrigger.palette,
        );

        assert.ok(errorMessageStub.notCalled, 'User opted not to select a logdir and error was shown');
    });
    test('If TensorBoard is not installed and user chooses not to install, do not show error', async () => {
        const installer = serviceManager.get<IInstaller>(IInstaller);
        sandbox.stub(installer, 'isProductVersionCompatible').resolves(ProductInstallStatus.NotInstalled);
        sandbox.stub(installer, 'promptToInstall').resolves(InstallerResponse.Ignore);

        await commandManager.executeCommand(
            'python.launchTensorBoard',
            TensorBoardEntrypoint.palette,
            TensorBoardEntrypointTrigger.palette,
        );

        assert.ok(errorMessageStub.notCalled, 'User opted not to install and error was shown');
    });
    test('If existing install of TensorBoard is outdated and user cancels installation, do not show error', async () => {
        const installer = serviceManager.get<IInstaller>(IInstaller);
        sandbox.stub(installer, 'isProductVersionCompatible').resolves(ProductInstallStatus.NeedsUpgrade);
        sandbox.stub(installer, 'promptToInstall').resolves(InstallerResponse.Ignore);
        const quickPickStub = sandbox.stub(applicationShell, 'showQuickPick');

        await commandManager.executeCommand(
            'python.launchTensorBoard',
            TensorBoardEntrypoint.palette,
            TensorBoardEntrypointTrigger.palette,
        );

        assert.ok(quickPickStub.notCalled, 'User opted not to upgrade and we proceeded to create session');
    });
    test('If user cancels starting TensorBoard session, do not show error', async () => {
        sandbox.stub(applicationShell, 'showQuickPick').resolves({ label: TensorBoard.useCurrentWorkingDirectory() });
        sandbox.stub(applicationShell, 'withProgress').resolves('canceled');

        await commandManager.executeCommand(
            'python.launchTensorBoard',
            TensorBoardEntrypoint.palette,
            TensorBoardEntrypointTrigger.palette,
        );

        assert.ok(errorMessageStub.notCalled, 'User canceled session start and error was shown');
    });
    test('If starting TensorBoard times out, show error', async () => {
        sandbox.stub(applicationShell, 'showQuickPick').resolves({ label: TensorBoard.useCurrentWorkingDirectory() });
        sandbox.stub(applicationShell, 'withProgress').resolves(60_000);

        await commandManager.executeCommand(
            'python.launchTensorBoard',
            TensorBoardEntrypoint.palette,
            TensorBoardEntrypointTrigger.palette,
        );

        assert.ok(errorMessageStub.called, 'TensorBoard timed out but no error was shown');
    });
});
