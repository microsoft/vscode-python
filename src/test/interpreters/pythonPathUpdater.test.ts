import * as assert from 'assert';
import * as path from 'path';
import { ConfigurationTarget, Uri, workspace } from 'vscode';
import { PythonPathUpdaterService } from '../../client/interpreter/configuration/pythonPathUpdaterService';
import { PythonPathUpdaterServiceFactory } from '../../client/interpreter/configuration/pythonPathUpdaterServiceFactory';
import { WorkspacePythonPathUpdaterService } from '../../client/interpreter/configuration/services/workspaceUpdaterService';
import { InterpreterVersionService } from '../../client/interpreter/interpreterVersion';
import { closeActiveWindows, initialize, initializeTest } from '../initialize';

const workspaceRoot = path.join(__dirname, '..', '..', '..', 'src', 'test');

// tslint:disable-next-line:max-func-body-length
suite('Python Path Settings Updater', () => {
    suiteSetup(initialize);
    setup(initializeTest);
    suiteTeardown(async () => {
        await closeActiveWindows();
        await initializeTest();
    });
    teardown(async () => {
        await closeActiveWindows();
        await initializeTest();
    });

    // Create Github issue VS Code bug (global changes not reflected immediately)

    // test('Updating Global Python Path should work', async () => {
    //     const globalUpdater = new GlobalPythonPathUpdaterService();
    //     const pythonPath = `xGlobalPythonPath${new Date().getMilliseconds()}`;
    //     await globalUpdater.updatePythonPath(pythonPath);
    //     const globalPythonValue = workspace.getConfiguration('python').inspect('pythonPath').globalValue;
    //     assert.equal(globalPythonValue, pythonPath, 'Global Python Path not updated');
    // });

    // test('Updating Global Python Path using the factory service should work', async () => {
    //     const globalUpdater = new PythonPathUpdaterServiceFactory().getGlobalPythonPathConfigurationService();
    //     const pythonPath = `xGlobalPythonPathFromFactory${new Date().getMilliseconds()}`;
    //     await globalUpdater.updatePythonPath(pythonPath);
    //     const globalPythonValue = workspace.getConfiguration('python').inspect('pythonPath').globalValue;
    //     assert.equal(globalPythonValue, pythonPath, 'Global Python Path not updated');
    // });

    // test('Updating Global Python Path using the PythonPathUpdaterService should work', async () => {
    //     const updaterService = new PythonPathUpdaterService(new PythonPathUpdaterServiceFactory());
    //     const pythonPath = `xGlobalPythonPathFromUpdater${new Date().getMilliseconds()}`;
    //     await updaterService.updatePythonPath(pythonPath, ConfigurationTarget.Global);
    //     const globalPythonValue = workspace.getConfiguration('python').inspect('pythonPath').globalValue;
    //     assert.equal(globalPythonValue, pythonPath, 'Global Python Path not updated');
    // });

    test('Updating Workspace Python Path should work', async () => {
        const workspaceUri = Uri.file(workspaceRoot);
        const workspaceUpdater = new WorkspacePythonPathUpdaterService(workspace.getWorkspaceFolder(workspaceUri).uri);
        const pythonPath = `xWorkspacePythonPath${new Date().getMilliseconds()}`;
        await workspaceUpdater.updatePythonPath(pythonPath);
        const workspaceValue = workspace.getConfiguration('python').inspect('pythonPath').workspaceValue;
        assert.equal(workspaceValue, pythonPath, 'Workspace Python Path not updated');
    });

    test('Updating Workspace Python Path using the factor service should work', async () => {
        const workspaceUri = Uri.file(workspaceRoot);
        const factory = new PythonPathUpdaterServiceFactory();
        const workspaceUpdater = factory.getWorkspacePythonPathConfigurationService(workspace.getWorkspaceFolder(workspaceUri).uri);
        const pythonPath = `xWorkspacePythonPathFromFactory${new Date().getMilliseconds()}`;
        await workspaceUpdater.updatePythonPath(pythonPath);
        const workspaceValue = workspace.getConfiguration('python').inspect('pythonPath').workspaceValue;
        assert.equal(workspaceValue, pythonPath, 'Workspace Python Path not updated');
    });

    test('Updating Workspace Python Path using the PythonPathUpdaterService should work', async () => {
        const workspaceUri = Uri.file(workspaceRoot);
        const updaterService = new PythonPathUpdaterService(new PythonPathUpdaterServiceFactory(), new InterpreterVersionService());
        const pythonPath = `xWorkspacePythonPathFromUpdater${new Date().getMilliseconds()}`;
        await updaterService.updatePythonPath(pythonPath, ConfigurationTarget.Workspace, 'ui', workspace.getWorkspaceFolder(workspaceUri).uri);
        const workspaceValue = workspace.getConfiguration('python').inspect('pythonPath').workspaceValue;
        assert.equal(workspaceValue, pythonPath, 'Workspace Python Path not updated');
    });

    test('Python Path should be relative to workspace', async () => {
        const workspaceUri = workspace.getWorkspaceFolder(Uri.file(workspaceRoot)).uri;
        const pythonInterpreter = `xWorkspacePythonPath${new Date().getMilliseconds()}`;
        const pythonPath = path.join(workspaceUri.fsPath, 'x', 'y', 'z', pythonInterpreter);
        const workspaceUpdater = new WorkspacePythonPathUpdaterService(workspaceUri);
        await workspaceUpdater.updatePythonPath(pythonPath);
        const workspaceValue = workspace.getConfiguration('python').inspect('pythonPath').workspaceValue;
        // tslint:disable-next-line:no-invalid-template-strings
        assert.equal(workspaceValue, path.join('${workspaceRoot}', 'x', 'y', 'z', pythonInterpreter), 'Workspace Python Path not updated');
    });
});
