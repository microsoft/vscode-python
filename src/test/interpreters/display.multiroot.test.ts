import * as assert from 'assert';
import * as path from 'path';
import * as TypeMoq from 'typemoq';
import { ConfigurationTarget, Uri, window, workspace } from 'vscode';
import { PythonSettings } from '../../client/common/configSettings';
import { IInterpreterService } from '../../client/interpreter/contracts';
import { InterpreterDisplay } from '../../client/interpreter/display';
import { VirtualEnvironmentManager } from '../../client/interpreter/virtualEnvs';
import { clearPythonPathInWorkspaceFolder } from '../common';
import { closeActiveWindows, initialize, initializePython, initializeTest, IS_MULTI_ROOT_TEST } from '../initialize';
import { MockStatusBarItem } from '../mockClasses';
import { UnitTestIocContainer } from '../unittests/serviceRegistry';
import { MockInterpreterVersionProvider } from './mocks';

const multirootPath = path.join(__dirname, '..', '..', '..', 'src', 'testMultiRootWkspc');
const workspace3Uri = Uri.file(path.join(multirootPath, 'workspace3'));
const fileToOpen = path.join(workspace3Uri.fsPath, 'file.py');

// tslint:disable-next-line:max-func-body-length
suite('Multiroot Interpreters Display', () => {
    let ioc: UnitTestIocContainer;
    suiteSetup(async function () {
        if (!IS_MULTI_ROOT_TEST) {
            // tslint:disable-next-line:no-invalid-this
            this.skip();
        }
        await initialize();
    });
    setup(async () => {
        await initializeTest();
        initializeDI();
    });
    suiteTeardown(initializePython);
    teardown(async () => {
        ioc.dispose();
        await clearPythonPathInWorkspaceFolder(fileToOpen);
        await initialize();
        await closeActiveWindows();
    });
    function initializeDI() {
        ioc = new UnitTestIocContainer();
        ioc.registerCommonTypes();
        ioc.registerVariableTypes();
        ioc.registerProcessTypes();
    }

    test('Must get display name from workspace folder interpreter and not from interpreter in workspace', async () => {
        const settings = workspace.getConfiguration('python', Uri.file(fileToOpen));
        const pythonPath = fileToOpen;
        await settings.update('pythonPath', pythonPath, ConfigurationTarget.WorkspaceFolder);
        PythonSettings.dispose();

        const document = await workspace.openTextDocument(fileToOpen);
        await window.showTextDocument(document);

        const statusBar = new MockStatusBarItem();
        const provider = TypeMoq.Mock.ofType<IInterpreterService>();
        provider.setup(p => p.getInterpreters(TypeMoq.It.isAny())).returns(() => Promise.resolve([]));
        provider.setup(p => p.getActiveInterpreter(TypeMoq.It.isAny())).returns(() => Promise.resolve(undefined));
        const displayName = `${path.basename(pythonPath)} [Environment]`;
        const displayNameProvider = new MockInterpreterVersionProvider(displayName);
        const display = new InterpreterDisplay(statusBar, provider.object, new VirtualEnvironmentManager([]), displayNameProvider);
        await display.refresh();

        assert.equal(statusBar.text, displayName, 'Incorrect display name');
    });
});
