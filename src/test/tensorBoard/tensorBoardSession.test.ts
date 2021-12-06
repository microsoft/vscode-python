import * as path from 'path';
import { assert } from 'chai';
import Sinon, * as sinon from 'sinon';
import { SemVer } from 'semver';
import { Uri, ViewColumn, window, workspace, WorkspaceConfiguration } from 'vscode';
import {
    IExperimentService,
    IInstaller,
    InstallerResponse,
    Product,
    ProductInstallStatus,
} from '../../client/common/types';
import { Common, TensorBoard } from '../../client/common/utils/localize';
import { IApplicationShell, ICommandManager } from '../../client/common/application/types';
import { IServiceManager } from '../../client/ioc/types';
import { TensorBoardEntrypoint, TensorBoardEntrypointTrigger } from '../../client/tensorBoard/constants';
import { TensorBoardSession } from '../../client/tensorBoard/tensorBoardSession';
import { closeActiveWindows, EXTENSION_ROOT_DIR_FOR_TESTS, initialize } from '../initialize';
import { IInterpreterService } from '../../client/interpreter/contracts';
import { Architecture } from '../../client/common/utils/platform';
import { PythonEnvironment, EnvironmentType } from '../../client/pythonEnvironments/info';
import { PYTHON_PATH } from '../common';
import { TorchProfiler } from '../../client/common/experiments/groups';
import { ImportTracker } from '../../client/telemetry/importTracker';
import { IMultiStepInput, IMultiStepInputFactory } from '../../client/common/utils/multiStepInput';
import { ModuleInstallFlags } from '../../client/common/installer/types';

// Class methods exposed just for testing purposes
interface ITensorBoardSessionTestAPI {
    jumpToSource(fsPath: string, line: number): Promise<void>;
}

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

const interpreter: PythonEnvironment = {
    ...info,
    envType: EnvironmentType.Unknown,
    path: PYTHON_PATH,
};

suite('TensorBoard session creation', async () => {
    let serviceManager: IServiceManager;
    let errorMessageStub: Sinon.SinonStub;
    let sandbox: Sinon.SinonSandbox;
    let applicationShell: IApplicationShell;
    let commandManager: ICommandManager;
    let experimentService: IExperimentService;
    let installer: IInstaller;
    let initialValue: string | undefined;
    let workspaceConfiguration: WorkspaceConfiguration;

    suiteSetup(function () {
        if (process.env.CI_PYTHON_VERSION === '2.7') {
            // TensorBoard 2.4.1 not available for Python 2.7
            this.skip();
        }

        // See: https://github.com/microsoft/vscode-python/issues/18130
        this.skip();
    });

    setup(async () => {
        sandbox = sinon.createSandbox();
        ({ serviceManager } = await initialize());

        experimentService = serviceManager.get<IExperimentService>(IExperimentService);
        const interpreterService = serviceManager.get<IInterpreterService>(IInterpreterService);
        sandbox.stub(interpreterService, 'getActiveInterpreter').resolves(interpreter);

        applicationShell = serviceManager.get<IApplicationShell>(IApplicationShell);
        commandManager = serviceManager.get<ICommandManager>(ICommandManager);
        installer = serviceManager.get<IInstaller>(IInstaller);
        workspaceConfiguration = workspace.getConfiguration('python.tensorBoard');
        initialValue = workspaceConfiguration.get('logDirectory');
        await workspaceConfiguration.update('logDirectory', undefined, true);
    });

    teardown(async () => {
        await workspaceConfiguration.update('logDirectory', initialValue, true);
        await closeActiveWindows();
        sandbox.restore();
    });

    function configureStubs(
        isInTorchProfilerExperiment: boolean,
        hasTorchImports: boolean,
        tensorBoardInstallStatus: ProductInstallStatus,
        torchProfilerPackageInstallStatus: ProductInstallStatus,
        installPromptSelection: 'Yes' | 'No',
    ) {
        sandbox
            .stub(experimentService, 'inExperiment')
            .withArgs(TorchProfiler.experiment)
            .resolves(isInTorchProfilerExperiment);
        sandbox.stub(ImportTracker, 'hasModuleImport').withArgs('torch').returns(hasTorchImports);
        const isProductVersionCompatible = sandbox.stub(installer, 'isProductVersionCompatible');
        isProductVersionCompatible
            .withArgs(Product.tensorboard, '>= 2.4.1', interpreter)
            .resolves(tensorBoardInstallStatus);
        isProductVersionCompatible
            .withArgs(Product.torchProfilerImportName, '>= 0.2.0', interpreter)
            .resolves(torchProfilerPackageInstallStatus);
        errorMessageStub = sandbox.stub(applicationShell, 'showErrorMessage');
        errorMessageStub.resolves(installPromptSelection);
    }
    async function createSession() {
        errorMessageStub = sandbox.stub(applicationShell, 'showErrorMessage');
        // Stub user selections
        sandbox.stub(applicationShell, 'showQuickPick').resolves({ label: TensorBoard.useCurrentWorkingDirectory() });

        const session = (await commandManager.executeCommand(
            'python.launchTensorBoard',
            TensorBoardEntrypoint.palette,
            TensorBoardEntrypointTrigger.palette,
        )) as TensorBoardSession;

        assert.ok(session.panel?.viewColumn === ViewColumn.One, 'Panel opened in wrong group');
        assert.ok(session.panel?.visible, 'Webview panel not shown on session creation golden path');
        assert.ok(errorMessageStub.notCalled, 'Error message shown on session creation golden path');
        return session;
    }
    suite('Core functionality', async () => {
        test('Golden path: TensorBoard session starts successfully and webview is shown', async () => {
            await createSession();
        });
        test('When webview is closed, session is killed', async () => {
            const session = await createSession();
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
        test('When user selects remote URL, display input box', async () => {
            sandbox.stub(applicationShell, 'showQuickPick').resolves({ label: TensorBoard.enterRemoteUrl() });
            const inputBoxStub = sandbox.stub(applicationShell, 'showInputBox');

            // Create session
            await commandManager.executeCommand(
                'python.launchTensorBoard',
                TensorBoardEntrypoint.palette,
                TensorBoardEntrypointTrigger.palette,
            );

            assert.ok(
                inputBoxStub.called,
                'User requested to enter remote URL and input box to enter URL was not shown',
            );
        });
    });
    suite('Installation prompt message', async () => {
        async function createSessionAndVerifyMessage(message: string) {
            sandbox
                .stub(applicationShell, 'showQuickPick')
                .resolves({ label: TensorBoard.useCurrentWorkingDirectory() });
            await commandManager.executeCommand(
                'python.launchTensorBoard',
                TensorBoardEntrypoint.palette,
                TensorBoardEntrypointTrigger.palette,
            );
            assert.ok(
                errorMessageStub.calledOnceWith(message, Common.bannerLabelYes(), Common.bannerLabelNo()),
                'Wrong error message shown',
            );
        }
        suite('Install profiler package + upgrade tensorboard', async () => {
            async function runTest(expectTensorBoardUpgrade: boolean) {
                const installStub = sandbox.stub(installer, 'install').resolves(InstallerResponse.Installed);
                await createSessionAndVerifyMessage(TensorBoard.installTensorBoardAndProfilerPluginPrompt());
                assert.ok(installStub.calledTwice, `Expected 2 installs but got ${installStub.callCount} calls`);
                assert.ok(installStub.calledWith(Product.torchProfilerInstallName));
                assert.ok(
                    installStub.calledWith(
                        Product.tensorboard,
                        sinon.match.any,
                        sinon.match.any,
                        expectTensorBoardUpgrade ? ModuleInstallFlags.upgrade : undefined,
                    ),
                );
            }
            test('In experiment: true, has torch imports: true, is profiler package installed: false, TensorBoard needs upgrade', async () => {
                configureStubs(true, true, ProductInstallStatus.NeedsUpgrade, ProductInstallStatus.NotInstalled, 'Yes');
                await runTest(true);
            });
            test('In experiment: true, has torch imports: true, is profiler package installed: false, TensorBoard not installed', async () => {
                configureStubs(true, true, ProductInstallStatus.NotInstalled, ProductInstallStatus.NotInstalled, 'Yes');
                await runTest(false);
            });
        });
        suite('Install profiler only', async () => {
            test('In experiment: true, has torch imports: true, is profiler package installed: false, TensorBoard installed', async () => {
                configureStubs(true, true, ProductInstallStatus.Installed, ProductInstallStatus.NotInstalled, 'Yes');
                sandbox
                    .stub(applicationShell, 'showQuickPick')
                    .resolves({ label: TensorBoard.useCurrentWorkingDirectory() });
                // Ensure we ask to install the profiler package and that it resolves to a cancellation
                sandbox
                    .stub(installer, 'install')
                    .withArgs(Product.torchProfilerInstallName, sinon.match.any, sinon.match.any)
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
        });
        suite('Install tensorboard only', async () => {
            [false, true].forEach(async (inExperiment) => {
                [false, true].forEach(async (hasTorchImports) => {
                    [
                        ProductInstallStatus.Installed,
                        ProductInstallStatus.NotInstalled,
                        ProductInstallStatus.NeedsUpgrade,
                    ].forEach(async (torchProfilerInstallStatus) => {
                        const isTorchProfilerPackageInstalled =
                            torchProfilerInstallStatus === ProductInstallStatus.Installed;
                        if (!(inExperiment && hasTorchImports && !isTorchProfilerPackageInstalled)) {
                            test(`In experiment: ${inExperiment}, has torch imports: ${hasTorchImports}, is profiler package installed: ${isTorchProfilerPackageInstalled}, TensorBoard not installed`, async () => {
                                configureStubs(
                                    inExperiment,
                                    hasTorchImports,
                                    ProductInstallStatus.NotInstalled,
                                    torchProfilerInstallStatus,
                                    'No',
                                );
                                await createSessionAndVerifyMessage(TensorBoard.installPrompt());
                            });
                        }
                    });
                });
            });
        });
        suite('Upgrade tensorboard only', async () => {
            async function runTest() {
                const installStub = sandbox.stub(installer, 'install').resolves(InstallerResponse.Installed);
                await createSessionAndVerifyMessage(TensorBoard.upgradePrompt());

                assert.ok(installStub.calledOnce, `Expected 1 install but got ${installStub.callCount} installs`);
                assert.ok(installStub.args[0][0] === Product.tensorboard, 'Did not install tensorboard');
                assert.ok(
                    installStub.args.filter((argsList) => argsList[0] === Product.torchProfilerInstallName).length ===
                        0,
                    'Unexpected attempt to install profiler package',
                );
            }
            [false, true].forEach(async (inExperiment) => {
                [false, true].forEach(async (hasTorchImports) => {
                    [
                        ProductInstallStatus.Installed,
                        ProductInstallStatus.NotInstalled,
                        ProductInstallStatus.NeedsUpgrade,
                    ].forEach(async (torchProfilerInstallStatus) => {
                        const isTorchProfilerPackageInstalled =
                            torchProfilerInstallStatus === ProductInstallStatus.Installed;
                        if (!(inExperiment && hasTorchImports && !isTorchProfilerPackageInstalled)) {
                            test(`In experiment: ${inExperiment}, has torch imports: ${hasTorchImports}, is profiler package installed: ${isTorchProfilerPackageInstalled}, TensorBoard needs upgrade`, async () => {
                                configureStubs(
                                    inExperiment,
                                    hasTorchImports,
                                    ProductInstallStatus.NeedsUpgrade,
                                    torchProfilerInstallStatus,
                                    'Yes',
                                );
                                await runTest();
                            });
                        }
                    });
                });
            });
        });
        suite('No prompt', async () => {
            async function runTest() {
                sandbox
                    .stub(applicationShell, 'showQuickPick')
                    .resolves({ label: TensorBoard.useCurrentWorkingDirectory() });
                await commandManager.executeCommand(
                    'python.launchTensorBoard',
                    TensorBoardEntrypoint.palette,
                    TensorBoardEntrypointTrigger.palette,
                );
                assert.ok(errorMessageStub.notCalled, 'Prompt was unexpectedly shown');
            }
            [false, true].forEach(async (inExperiment) => {
                [false, true].forEach(async (hasTorchImports) => {
                    [
                        ProductInstallStatus.Installed,
                        ProductInstallStatus.NotInstalled,
                        ProductInstallStatus.NeedsUpgrade,
                    ].forEach(async (torchProfilerInstallStatus) => {
                        const isTorchProfilerPackageInstalled =
                            torchProfilerInstallStatus === ProductInstallStatus.Installed;
                        if (!(inExperiment && hasTorchImports && !isTorchProfilerPackageInstalled)) {
                            test(`In experiment: ${inExperiment}, has torch imports: ${hasTorchImports}, is profiler package installed: ${isTorchProfilerPackageInstalled}, TensorBoard installed`, async () => {
                                configureStubs(
                                    inExperiment,
                                    hasTorchImports,
                                    ProductInstallStatus.Installed,
                                    torchProfilerInstallStatus,
                                    'Yes',
                                );
                                await runTest();
                            });
                        }
                    });
                });
            });
        });
    });
    suite('Error messages', async () => {
        test('If user cancels starting TensorBoard session, do not show error', async () => {
            sandbox
                .stub(applicationShell, 'showQuickPick')
                .resolves({ label: TensorBoard.useCurrentWorkingDirectory() });
            sandbox.stub(applicationShell, 'withProgress').resolves('canceled');
            errorMessageStub = sandbox.stub(applicationShell, 'showErrorMessage');

            await commandManager.executeCommand(
                'python.launchTensorBoard',
                TensorBoardEntrypoint.palette,
                TensorBoardEntrypointTrigger.palette,
            );

            assert.ok(errorMessageStub.notCalled, 'User canceled session start and error was shown');
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
        test('If TensorBoard is not installed and user chooses not to install, do not show error', async () => {
            configureStubs(true, true, ProductInstallStatus.NotInstalled, ProductInstallStatus.NotInstalled, 'Yes');
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
        test('If starting TensorBoard times out, show error', async () => {
            sandbox
                .stub(applicationShell, 'showQuickPick')
                .resolves({ label: TensorBoard.useCurrentWorkingDirectory() });
            sandbox.stub(applicationShell, 'withProgress').resolves(60_000);
            errorMessageStub = sandbox.stub(applicationShell, 'showErrorMessage');

            await commandManager.executeCommand(
                'python.launchTensorBoard',
                TensorBoardEntrypoint.palette,
                TensorBoardEntrypointTrigger.palette,
            );

            assert.ok(errorMessageStub.called, 'TensorBoard timed out but no error was shown');
        });
        test('If installing the profiler package fails, do not show error, continue to create session', async () => {
            configureStubs(true, true, ProductInstallStatus.Installed, ProductInstallStatus.NotInstalled, 'Yes');
            sandbox
                .stub(applicationShell, 'showQuickPick')
                .resolves({ label: TensorBoard.useCurrentWorkingDirectory() });
            // Ensure we ask to install the profiler package and that it resolves to a cancellation
            sandbox
                .stub(installer, 'install')
                .withArgs(Product.torchProfilerInstallName, sinon.match.any, sinon.match.any)
                .resolves(InstallerResponse.Ignore);

            const session = (await commandManager.executeCommand(
                'python.launchTensorBoard',
                TensorBoardEntrypoint.palette,
                TensorBoardEntrypointTrigger.palette,
            )) as TensorBoardSession;

            assert.ok(session.panel?.visible, 'Webview panel not shown, expected successful session creation');
        });
        test('If user opts not to install profiler package and tensorboard is already installed, continue to create session', async () => {
            configureStubs(true, true, ProductInstallStatus.Installed, ProductInstallStatus.NotInstalled, 'No');
            sandbox
                .stub(applicationShell, 'showQuickPick')
                .resolves({ label: TensorBoard.useCurrentWorkingDirectory() });
            const session = (await commandManager.executeCommand(
                'python.launchTensorBoard',
                TensorBoardEntrypoint.palette,
                TensorBoardEntrypointTrigger.palette,
            )) as TensorBoardSession;
            assert.ok(session.panel?.visible, 'Webview panel not shown, expected successful session creation');
        });
    });
    test('If python.tensorBoard.logDirectory is provided, do not prompt user to pick a log directory', async () => {
        const selectDirectoryStub = sandbox
            .stub(applicationShell, 'showQuickPick')
            .resolves({ label: TensorBoard.useCurrentWorkingDirectory() });
        errorMessageStub = sandbox.stub(applicationShell, 'showErrorMessage');
        await workspaceConfiguration.update('logDirectory', 'logs/fit', true);

        const session = (await commandManager.executeCommand(
            'python.launchTensorBoard',
            TensorBoardEntrypoint.palette,
            TensorBoardEntrypointTrigger.palette,
        )) as TensorBoardSession;

        assert.ok(session.panel?.visible, 'Expected successful session creation but webpanel not shown');
        assert.ok(errorMessageStub.notCalled, 'Expected successful session creation but error message was shown');
        assert.ok(
            selectDirectoryStub.notCalled,
            'Prompted user to select log directory although setting was specified',
        );
    });
    suite('Jump to source', async () => {
        // We can't test a full E2E scenario with the TB profiler plugin because we can't
        // accurately target simulated clicks at iframed content. This only tests
        // code from the moment that the VS Code webview posts a message back
        // to the extension.
        const fsPath = path.join(
            EXTENSION_ROOT_DIR_FOR_TESTS,
            'src',
            'test',
            'pythonFiles',
            'tensorBoard',
            'sourcefile.py',
        );
        teardown(() => {
            sandbox.restore();
        });
        function setupStubsForMultiStepInput() {
            // Stub the factory to return our stubbed multistep input when it's asked to create one
            const multiStepFactory = serviceManager.get<IMultiStepInputFactory>(IMultiStepInputFactory);
            const inputInstance = multiStepFactory.create();
            // Create a multistep input with stubs for methods
            const showQuickPickStub = sandbox.stub(inputInstance, 'showQuickPick').resolves({
                label: TensorBoard.selectMissingSourceFile(),
                description: TensorBoard.selectMissingSourceFileDescription(),
            });
            const createInputStub = sandbox
                .stub(multiStepFactory, 'create')
                .returns(inputInstance as IMultiStepInput<unknown>);
            // Stub the system file picker
            const filePickerStub = sandbox.stub(applicationShell, 'showOpenDialog').resolves([Uri.file(fsPath)]);
            return [showQuickPickStub, createInputStub, filePickerStub];
        }
        test('Resolves filepaths without displaying prompt', async () => {
            const session = ((await createSession()) as unknown) as ITensorBoardSessionTestAPI;
            const stubs = setupStubsForMultiStepInput();
            await session.jumpToSource(fsPath, 0);
            assert.ok(window.activeTextEditor !== undefined, 'Source file not resolved');
            assert.ok(window.activeTextEditor?.document.uri.fsPath === fsPath, 'Wrong source file opened');
            assert.ok(
                stubs.reduce((prev, current) => current.notCalled && prev, true),
                'Stubs were called when file is present',
            );
        });
        test('Display quickpick to user if filepath is not on disk', async () => {
            const session = ((await createSession()) as unknown) as ITensorBoardSessionTestAPI;
            const stubs = setupStubsForMultiStepInput();
            await session.jumpToSource('/nonexistent/file/path.py', 0);
            assert.ok(window.activeTextEditor !== undefined, 'Source file not resolved');
            assert.ok(window.activeTextEditor?.document.uri.fsPath === fsPath, 'Wrong source file opened');
            assert.ok(
                stubs.reduce((prev, current) => current.calledOnce && prev, true),
                'Stubs called an unexpected number of times',
            );
        });
    });
});
