import { assert } from 'chai';
import Sinon, * as sinon from 'sinon';
import { window } from 'vscode';
import { IApplicationShell, ICommandManager } from '../../client/common/application/types';
import { IExperimentService, IInstaller, InstallerResponse } from '../../client/common/types';
import { TensorBoard } from '../../client/common/utils/localize';
import { IServiceManager } from '../../client/ioc/types';
import { TensorBoardEntrypoint, TensorBoardEntrypointTrigger } from '../../client/tensorBoard/constants';
import { TensorBoardSession } from '../../client/tensorBoard/tensorBoardSession';
import { TensorBoardSessionProvider } from '../../client/tensorBoard/tensorBoardSessionProvider';
import { initialize } from '../initialize';
import * as ExperimentHelpers from '../../client/common/experiments/helpers';

suite('TensorBoard session creation', async () => {
    let serviceManager: IServiceManager;
    let errorMessageStub: Sinon.SinonStub;
    let sandbox: Sinon.SinonSandbox;
    let provider: TensorBoardSessionProvider;
    let applicationShell: IApplicationShell;
    let commandManager: ICommandManager;

    setup(async () => {
        sandbox = sinon.createSandbox();
        ({ serviceManager } = await initialize());
        sandbox.stub(ExperimentHelpers, 'inDiscoveryExperiment').resolves(false);
        // Pretend to be in experiment
        const experimentService = serviceManager.get<IExperimentService>(IExperimentService);
        sandbox.stub(experimentService, 'inExperiment').resolves(true);
        // Create tensorboard session provider
        provider = serviceManager.get<TensorBoardSessionProvider>(TensorBoardSessionProvider);
        await provider.activate();
        applicationShell = serviceManager.get<IApplicationShell>(IApplicationShell);
        errorMessageStub = sandbox.stub(applicationShell, 'showErrorMessage');
        commandManager = serviceManager.get<ICommandManager>(ICommandManager);
    });

    teardown(() => {
        sandbox.restore();
    });

    test('Golden path: TensorBoard session starts successfully and webview is shown', async () => {
        // Stub user selections
        sandbox.stub(window, 'showQuickPick').resolves({ label: TensorBoard.useCurrentWorkingDirectory() });

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
        sandbox.stub(window, 'showQuickPick').resolves({ label: TensorBoard.useCurrentWorkingDirectory() });

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
        sandbox.stub(window, 'showQuickPick').resolves({ label: TensorBoard.selectAFolder() });
        const filePickerStub = sandbox.stub(window, 'showOpenDialog');

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
        sandbox.stub(window, 'showQuickPick').resolves({ label: TensorBoard.selectAFolder() });
        sandbox.stub(window, 'showOpenDialog').resolves(undefined);

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
        sandbox.stub(installer, 'isInstalled').resolves(false);
        sandbox.stub(installer, 'promptToInstall').resolves(InstallerResponse.Ignore);

        await commandManager.executeCommand(
            'python.launchTensorBoard',
            TensorBoardEntrypoint.palette,
            TensorBoardEntrypointTrigger.palette,
        );

        assert.ok(errorMessageStub.notCalled, 'User opted not to install and error was shown');
    });
    test('If user cancels starting TensorBoard session, do not show error', async () => {
        sandbox.stub(window, 'showQuickPick').resolves({ label: TensorBoard.useCurrentWorkingDirectory() });
        sandbox.stub(window, 'withProgress').resolves('canceled');

        await commandManager.executeCommand(
            'python.launchTensorBoard',
            TensorBoardEntrypoint.palette,
            TensorBoardEntrypointTrigger.palette,
        );

        assert.ok(errorMessageStub.notCalled, 'User canceled session start and error was shown');
    });
    test('If starting TensorBoard times out, show error', async () => {
        sandbox.stub(window, 'showQuickPick').resolves({ label: TensorBoard.useCurrentWorkingDirectory() });
        sandbox.stub(window, 'withProgress').resolves(60_000);

        await commandManager.executeCommand(
            'python.launchTensorBoard',
            TensorBoardEntrypoint.palette,
            TensorBoardEntrypointTrigger.palette,
        );

        assert.ok(errorMessageStub.called, 'TensorBoard timed out but no error was shown');
    });
});
