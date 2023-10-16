import * as vscode from 'vscode';
import * as TypeMoq from 'typemoq';
import * as path from 'path';
import * as fs from 'fs-extra';
import { assert } from 'chai';
import { IS_SMOKE_TEST, EXTENSION_ROOT_DIR_FOR_TESTS } from '../constants';
import { closeActiveWindows, initialize, initializeTest } from '../initialize';
import { openFile, waitForCondition } from '../common';
import { IExperimentService } from '../../client/common/types';
import { EnableREPLSmartSend } from '../../client/common/experiments/groups';
import { IServiceContainer } from '../../client/ioc/types';

suite('Smoke Test: Run Smart Selection and Advance Cursor', () => {
    let experimentService: TypeMoq.IMock<IExperimentService>;
    let serviceContainer: TypeMoq.IMock<IServiceContainer>;

    suiteSetup(async function () {
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

    setup(initializeTest);
    suiteTeardown(closeActiveWindows);
    teardown(closeActiveWindows);

    test('Smart Send', async () => {
        const pythonConfig = vscode.workspace.getConfiguration('python');
        await pythonConfig.update('experiments.optInto', ['All'], vscode.ConfigurationTarget.Global);

        experimentService = TypeMoq.Mock.ofType<IExperimentService>();
        experimentService
            .setup((exp) => exp.inExperimentSync(TypeMoq.It.isValue(EnableREPLSmartSend.experiment)))
            .returns(() => true);
        serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
        serviceContainer
            .setup((s) => s.get(TypeMoq.It.isValue(IExperimentService)))
            .returns(() => experimentService.object);

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

        async function wait() {
            return new Promise<void>((resolve) => {
                setTimeout(() => {
                    resolve();
                }, 10000);
            });
        }

        await wait();

        const deletedFile = !(await fs.pathExists(outputFile));
        if (deletedFile) {
            assert.ok(true, `"${outputFile}" file has been deleted`);
        } else {
            assert.fail(`"${outputFile}" file still exists`);
        }
    });
});
