import * as vscode from 'vscode';
import * as TypeMoq from 'typemoq';
import * as path from 'path';
import * as fs from 'fs-extra';
import { assert } from 'chai';
import { mock, when } from 'ts-mockito';
import * as tasClient from 'vscode-tas-client';
import * as sinon from 'sinon';
import { IS_SMOKE_TEST, EXTENSION_ROOT_DIR_FOR_TESTS } from '../constants';
import { initialize } from '../initialize';
import { openFile, waitForCondition } from '../common';
import { IExperimentService } from '../../client/common/types';
import { EnableREPLSmartSend } from '../../client/common/experiments/groups';
import { IServiceContainer } from '../../client/ioc/types';
import { IWorkspaceService } from '../../client/common/application/types';
import { WorkspaceService } from '../../client/common/application/workspace';

// const TEST_FILES_PATH = path.join(EXTENSION_ROOT_DIR, 'src', 'test', 'pythonFiles', 'terminalExec');

suite('Smoke Test: Run Smart Selection and Advance Cursor', () => {
    // const extensionVersion = '1.2.3';
    let workspaceService: IWorkspaceService;
    let experimentService: TypeMoq.IMock<IExperimentService>;
    let serviceContainer: TypeMoq.IMock<IServiceContainer>;
    // let appEnvironment: IApplicationEnvironment;
    // "keybindings": [
    //     {
    //         "command": "python.execSelectionInTerminal",
    //         "key": "shift+enter",
    //         "when": "editorTextFocus && editorLangId == python && !findInputFocussed && !replaceInputFocussed && !jupyter.ownsSelection && !notebookEditorFocused"
    //     },
    // function configureApplicationEnvironment(channel: Channel, version: string, contributes?: Record<string, unknown>) {
    //     when(appEnvironment.extensionChannel).thenReturn(channel);
    //     when(appEnvironment.extensionName).thenReturn(PVSC_EXTENSION_ID_FOR_TESTS);
    //     when(appEnvironment.packageJson).thenReturn({ version, contributes });
    // }
    function configureSettings(enabled: boolean, optInto: string[], optOutFrom: string[]) {
        when(workspaceService.getConfiguration('python')).thenReturn({
            get: (key: string) => {
                if (key === 'experiments.enabled') {
                    return enabled;
                }
                if (key === 'experiments.optInto') {
                    return optInto;
                }
                if (key === 'experiments.optOutFrom') {
                    return optOutFrom;
                }
                return undefined;
            },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);
    }
    teardown(() => {
        sinon.restore();
    });
    suiteSetup(async function () {
        workspaceService = mock(WorkspaceService);
        configureSettings(true, ['pythonREPLSmartSend', 'EnableREPLSmartSend'], []);
        // configureApplicationEnvironment('stable', extensionVersion);

        serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
        serviceContainer
            .setup((s) => s.get(TypeMoq.It.isValue(IExperimentService)))
            .returns(() => experimentService.object);
        experimentService = TypeMoq.Mock.ofType<IExperimentService>();
        experimentService.setup((exp) => exp.inExperimentSync(TypeMoq.It.isAny())).returns(() => true);
        if (!IS_SMOKE_TEST) {
            return this.skip();
        }
        await initialize();
        const pythonConfig = vscode.workspace.getConfiguration('python');
        await pythonConfig.update('experiments.optInto', ['All'], vscode.ConfigurationTarget.Global);
        return undefined;
    });

    // setup(initializeTest);
    // suiteTeardown(closeActiveWindows);
    // teardown(closeActiveWindows);

    test('Smart Send', async () => {
        const pythonConfig = vscode.workspace.getConfiguration('python');
        await pythonConfig.update('experiments.optInto', ['All'], vscode.ConfigurationTarget.Global);
        workspaceService = mock(WorkspaceService);
        configureSettings(true, ['pythonREPLSmartSend', 'EnableREPLSmartSend'], []);
        // configureApplicationEnvironment('stable', extensionVersion);
        experimentService = TypeMoq.Mock.ofType<IExperimentService>();
        experimentService
            .setup((exp) => exp.inExperimentSync(TypeMoq.It.isValue(EnableREPLSmartSend.experiment)))
            .returns(() => true);
        sinon.stub(tasClient, 'getExperimentationService');
        serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
        serviceContainer
            .setup((s) => s.get(TypeMoq.It.isValue(IExperimentService)))
            .returns(() => experimentService.object);

        configureSettings(true, ['pythonREPLSmartSend', 'EnableREPLSmartSend'], []);

        serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
        serviceContainer
            .setup((s) => s.get(TypeMoq.It.isValue(IExperimentService)))
            .returns(() => experimentService.object);
        experimentService = TypeMoq.Mock.ofType<IExperimentService>();

        experimentService
            .setup((exp) => exp.inExperimentSync(TypeMoq.It.isValue(EnableREPLSmartSend.experiment)))
            .returns(() => true);

        const file = path.join(
            EXTENSION_ROOT_DIR_FOR_TESTS,
            'src',
            'testMultiRootWkspc',
            'smokeTests',
            'create_delete_file.py',
        );
        const outputFile = path.join(
            EXTENSION_ROOT_DIR_FOR_TESTS,
            'src',
            'testMultiRootWkspc',
            'smokeTests',
            'smart_send_smoke.txt',
        );
        // const pythonConfig = vscode.workspace.getConfiguration('python');
        await pythonConfig.update('experiments.optInto', ['All'], vscode.ConfigurationTarget.Global);
        await fs.remove(outputFile);

        const textDocument = await openFile(file);

        if (vscode.window.activeTextEditor) {
            const myPos = new vscode.Position(0, 0);
            vscode.window.activeTextEditor!.selections = [new vscode.Selection(myPos, myPos)];
        }
        await vscode.commands
            .executeCommand<void>('python.execSelectionInTerminal', textDocument.uri)
            .then(undefined, (err) => {
                assert.fail(`Something went wrong running the Python file in the terminal: ${err}`);
            });

        const checkIfFileHasBeenCreated = () => fs.pathExists(outputFile);
        await waitForCondition(checkIfFileHasBeenCreated, 30_000, `"${outputFile}" file not created`);
        console.log(experimentService.object.inExperimentSync(EnableREPLSmartSend.experiment));
        // Shift+enter two more times so we can track cursor movement with deletion of file
        await vscode.commands
            .executeCommand<void>('python.execSelectionInTerminal', textDocument.uri)
            .then(undefined, (err) => {
                assert.fail(`Something went wrong running the Python file in the terminal: ${err}`);
            });
        await vscode.commands
            .executeCommand<void>('python.execSelectionInTerminal', textDocument.uri)
            .then(undefined, (err) => {
                assert.fail(`Something went wrong running the Python file in the terminal: ${err}`);
            });

        async function waitThirtySeconds() {
            return new Promise<void>((resolve) => {
                setTimeout(() => {
                    resolve();
                }, 30000);
            });
        }

        await waitThirtySeconds();

        const deletedFile = !(await fs.pathExists(outputFile));
        if (deletedFile) {
            assert.ok(true, `"${outputFile}" file has been deleted`);
        } else {
            assert.fail(`"${outputFile}" file still exists`);
        }
    });
});
