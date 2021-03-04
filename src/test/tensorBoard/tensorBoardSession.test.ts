import { assert } from 'chai';
import Sinon, * as sinon from 'sinon';
import { SemVer } from 'semver';
import { IApplicationShell, ICommandManager } from '../../client/common/application/types';
import {
    IExperimentService,
    IInstaller,
    InstallerResponse,
    Product,
    ProductInstallStatus,
} from '../../client/common/types';
import { Common, TensorBoard } from '../../client/common/utils/localize';
import { IServiceManager } from '../../client/ioc/types';
import { TensorBoardEntrypoint, TensorBoardEntrypointTrigger } from '../../client/tensorBoard/constants';
import { TensorBoardSession } from '../../client/tensorBoard/tensorBoardSession';
import { closeActiveWindows, initialize } from '../initialize';
import * as ExperimentHelpers from '../../client/common/experiments/helpers';
import { IInterpreterService } from '../../client/interpreter/contracts';
import { Architecture } from '../../client/common/utils/platform';
import { PythonEnvironment, EnvironmentType } from '../../client/pythonEnvironments/info';
import { PYTHON_PATH } from '../common';
import { anything } from 'ts-mockito';
import { TorchProfiler } from '../../client/common/experiments/groups';
import { ImportTracker } from '../../client/telemetry/importTracker';

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
    let experimentService: IExperimentService;
    let installer: IInstaller;

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
        experimentService = serviceManager.get<IExperimentService>(IExperimentService);

        // Ensure we use CI Python
        const interpreter: PythonEnvironment = {
            ...info,
            envType: EnvironmentType.Unknown,
            path: PYTHON_PATH,
        };
        const interpreterService = serviceManager.get<IInterpreterService>(IInterpreterService);
        sandbox.stub(interpreterService, 'getActiveInterpreter').resolves(interpreter);

        applicationShell = serviceManager.get<IApplicationShell>(IApplicationShell);
        commandManager = serviceManager.get<ICommandManager>(ICommandManager);
        installer = serviceManager.get<IInstaller>(IInstaller);
    });

    teardown(async () => {
        await closeActiveWindows();
        sandbox.restore();
    });

    function configureStubs(
        isInTorchProfilerExperiment: boolean,
        hasTorchImports: boolean,
        tensorBoardInstallStatus: ProductInstallStatus,
        isTorchProfilerPackageInstalled: boolean,
        installPromptSelection: 'Yes' | 'No',
    ) {
        sandbox
            .stub(experimentService, 'inExperiment')
            .withArgs(TorchProfiler.experiment)
            .resolves(isInTorchProfilerExperiment);
        sandbox.stub(ImportTracker, 'hasModuleImport').withArgs('torch').returns(hasTorchImports);
        sandbox.stub(installer, 'isProductVersionCompatible').resolves(tensorBoardInstallStatus);
        sandbox
            .stub(installer, 'isInstalled')
            .withArgs(Product.torchprofiler, anything())
            .resolves(isTorchProfilerPackageInstalled);
        errorMessageStub = sandbox.stub(applicationShell, 'showErrorMessage');
        errorMessageStub.resolves(installPromptSelection as any);
    }

    test('Show correct message if profiler is not installed but not PyTorch user and tensorboard needs upgrade', async () => {
        configureStubs(true, false, ProductInstallStatus.NeedsUpgrade, false, 'Yes');
        sandbox.stub(applicationShell, 'showQuickPick').resolves({ label: TensorBoard.useCurrentWorkingDirectory() });
        const installStub = sandbox.stub(installer, 'install').resolves(InstallerResponse.Installed);

        await commandManager.executeCommand(
            'python.launchTensorBoard',
            TensorBoardEntrypoint.palette,
            TensorBoardEntrypointTrigger.palette,
        );
        assert.ok(installStub.calledOnce, 'Did not install anything');
        assert.ok(installStub.args[0][0] === Product.tensorboard, 'Did not install tensorboard');
        assert.ok(
            installStub.args.filter((argsList) => argsList[0] === Product.torchprofiler).length === 0,
            'Attempted to install profiler when not in experiment',
        );
        assert.ok(
            errorMessageStub.calledOnceWith(
                TensorBoard.upgradePrompt(),
                Common.bannerLabelYes(),
                Common.bannerLabelNo(),
            ),
            'Wrong error message shown',
        );
    });

    test('Show correct message if profiler not installed but user is not in experiment and tensorboard needs upgrade', async () => {
        configureStubs(false, true, ProductInstallStatus.NeedsUpgrade, false, 'Yes');
        sandbox.stub(applicationShell, 'showQuickPick').resolves({ label: TensorBoard.useCurrentWorkingDirectory() });
        const installStub = sandbox.stub(installer, 'install').resolves(InstallerResponse.Installed);

        await commandManager.executeCommand(
            'python.launchTensorBoard',
            TensorBoardEntrypoint.palette,
            TensorBoardEntrypointTrigger.palette,
        );
        assert.ok(installStub.calledOnce, 'Did not install anything');
        assert.ok(installStub.args[0][0] === Product.tensorboard, 'Did not install tensorboard');
        assert.ok(
            installStub.args.filter((argsList) => argsList[0] === Product.torchprofiler).length === 0,
            'Attempted to install profiler when not in experiment',
        );
        assert.ok(
            errorMessageStub.calledOnceWith(
                TensorBoard.upgradePrompt(),
                Common.bannerLabelYes(),
                Common.bannerLabelNo(),
            ),
            'Wrong error message shown',
        );
    });
    test('If TensorBoard is not installed and user chooses not to install, do not show error', async () => {
        configureStubs(true, true, ProductInstallStatus.NotInstalled, false, 'Yes');
        sandbox.stub(installer, 'install').resolves(InstallerResponse.Ignore);

        await commandManager.executeCommand(
            'python.launchTensorBoard',
            TensorBoardEntrypoint.palette,
            TensorBoardEntrypointTrigger.palette,
        );

        assert.ok(
            errorMessageStub.calledOnceWith(
                TensorBoard.installTensorBoardAndProfilerPluginPrompt(),
                Common.bannerLabelYes(),
                Common.bannerLabelNo(),
            ),
            'User opted not to install and error was shown',
        );
    });
    test('If installing the profiler package fails, continue to create session', async () => {
        configureStubs(true, true, ProductInstallStatus.Installed, false, 'Yes');
        sandbox.stub(applicationShell, 'showQuickPick').resolves({ label: TensorBoard.useCurrentWorkingDirectory() });
        // Ensure we ask to install the profiler package and that it resolves to a cancellation
        sandbox
            .stub(installer, 'install')
            .withArgs(Product.torchprofiler, anything(), anything())
            .resolves(InstallerResponse.Ignore);

        const session = (await commandManager.executeCommand(
            'python.launchTensorBoard',
            TensorBoardEntrypoint.palette,
            TensorBoardEntrypointTrigger.palette,
        )) as TensorBoardSession;

        assert.ok(session.panel?.visible, 'Webview panel not shown, expected successful session creation');
        assert.ok(
            errorMessageStub.calledOnceWith(
                TensorBoard.installProfilerPluginPrompt(),
                Common.bannerLabelYes(),
                Common.bannerLabelNo(),
            ),
            'Wrong error message shown',
        );
    });
    test('Show correct message if neither profiler package nor TensorBoard are installed', async () => {
        configureStubs(true, true, ProductInstallStatus.NotInstalled, false, 'Yes');
        sandbox.stub(applicationShell, 'showQuickPick').resolves({ label: TensorBoard.useCurrentWorkingDirectory() });
        sandbox.stub(installer, 'install').resolves(InstallerResponse.Installed);

        await commandManager.executeCommand(
            'python.launchTensorBoard',
            TensorBoardEntrypoint.palette,
            TensorBoardEntrypointTrigger.palette,
        );

        assert.ok(
            errorMessageStub.calledOnceWith(
                TensorBoard.installTensorBoardAndProfilerPluginPrompt(),
                Common.bannerLabelYes(),
                Common.bannerLabelNo(),
            ),
            'Wrong error message shown',
        );
    });
    test('Show correct message if profiler not installed but user is not in experiment and tensorboard is not installed', async () => {
        configureStubs(false, false, ProductInstallStatus.NotInstalled, false, 'No');
        sandbox.stub(applicationShell, 'showQuickPick').resolves({ label: TensorBoard.useCurrentWorkingDirectory() });

        await commandManager.executeCommand(
            'python.launchTensorBoard',
            TensorBoardEntrypoint.palette,
            TensorBoardEntrypointTrigger.palette,
        );
        assert.ok(
            errorMessageStub.calledOnceWith(
                TensorBoard.installPrompt(),
                Common.bannerLabelYes(),
                Common.bannerLabelNo(),
            ),
            'Wrong error message shown',
        );
    });
    test('If user cancels starting TensorBoard session, do not show error', async () => {
        sandbox.stub(applicationShell, 'showQuickPick').resolves({ label: TensorBoard.useCurrentWorkingDirectory() });
        sandbox.stub(applicationShell, 'withProgress').resolves('canceled');
        errorMessageStub = sandbox.stub(applicationShell, 'showErrorMessage');

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
        errorMessageStub = sandbox.stub(applicationShell, 'showErrorMessage');

        await commandManager.executeCommand(
            'python.launchTensorBoard',
            TensorBoardEntrypoint.palette,
            TensorBoardEntrypointTrigger.palette,
        );

        assert.ok(errorMessageStub.called, 'TensorBoard timed out but no error was shown');
    });
    test('Golden path: TensorBoard session starts successfully and webview is shown', async () => {
        sandbox.stub(experimentService, 'inExperiment').resolves(true);
        errorMessageStub = sandbox.stub(applicationShell, 'showErrorMessage');
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
        sandbox.stub(experimentService, 'inExperiment').resolves(true);
        errorMessageStub = sandbox.stub(applicationShell, 'showErrorMessage');
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
        sandbox.stub(experimentService, 'inExperiment').resolves(true);
        errorMessageStub = sandbox.stub(applicationShell, 'showErrorMessage');
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
        sandbox.stub(experimentService, 'inExperiment').resolves(true);
        errorMessageStub = sandbox.stub(applicationShell, 'showErrorMessage');
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
    test('If existing install of TensorBoard is outdated and user cancels installation, do not show error', async () => {
        sandbox.stub(experimentService, 'inExperiment').resolves(true);
        errorMessageStub = sandbox.stub(applicationShell, 'showErrorMessage');
        sandbox.stub(installer, 'isProductVersionCompatible').resolves(ProductInstallStatus.NeedsUpgrade);
        sandbox.stub(installer, 'install').resolves(InstallerResponse.Ignore);
        const quickPickStub = sandbox.stub(applicationShell, 'showQuickPick');

        await commandManager.executeCommand(
            'python.launchTensorBoard',
            TensorBoardEntrypoint.palette,
            TensorBoardEntrypointTrigger.palette,
        );

        assert.ok(quickPickStub.notCalled, 'User opted not to upgrade and we proceeded to create session');
    });
    test('If user is not in torch profiler experiment, do not prompt to install profiler package', async () => {
        sandbox.stub(applicationShell, 'showQuickPick').resolves({ label: TensorBoard.useCurrentWorkingDirectory() });
        errorMessageStub = sandbox.stub(applicationShell, 'showErrorMessage');
        sandbox.stub(experimentService, 'inExperiment').withArgs(TorchProfiler.experiment).resolves(false);
        sandbox.stub(installer, 'isInstalled').withArgs(Product.torchprofiler).resolves(false);
        const installTorchProfilerPackageStub = sandbox
            .stub(installer, 'install')
            .withArgs(Product.torchprofiler, anything(), anything());

        const session = (await commandManager.executeCommand(
            'python.launchTensorBoard',
            TensorBoardEntrypoint.palette,
            TensorBoardEntrypointTrigger.palette,
        )) as TensorBoardSession;

        // Torch profiler status should be irrelevant to tensorboard session start
        assert.ok(session.panel?.visible, 'Webview panel not shown, expected successful session creation');
        assert.ok(errorMessageStub.notCalled, 'Error message shown when all dependencies were present');
        assert.ok(installTorchProfilerPackageStub.notCalled);
    });
});
