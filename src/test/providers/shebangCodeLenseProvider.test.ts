import * as assert from 'assert';
import * as child_process from 'child_process';
import * as path from 'path';
import * as vscode from 'vscode';
import { CancellationTokenSource } from 'vscode';
import { IS_WINDOWS, PythonSettings } from '../../client/common/configSettings';
import { IProcessService } from '../../client/common/process/types';
import { ShebangCodeLensProvider } from '../../client/interpreter/display/shebangCodeLensProvider';
import { getFirstNonEmptyLineFromMultilineString } from '../../client/interpreter/helpers';
import { closeActiveWindows, initialize, initializeTest } from '../initialize';
import { UnitTestIocContainer } from '../unittests/serviceRegistry';

const autoCompPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'shebang');
const fileShebang = path.join(autoCompPath, 'shebang.py');
const fileShebangEnv = path.join(autoCompPath, 'shebangEnv.py');
const fileShebangInvalid = path.join(autoCompPath, 'shebangInvalid.py');
const filePlain = path.join(autoCompPath, 'plain.py');

suite('Shebang detection', () => {
    let ioc: UnitTestIocContainer;
    suiteSetup(initialize);
    suiteTeardown(async () => {
        await initialize();
        await closeActiveWindows();
    });
    setup(async () => {
        initializeDI();
        await initializeTest();
    });
    teardown(() => ioc.dispose());
    function initializeDI() {
        ioc = new UnitTestIocContainer();
        ioc.registerCommonTypes();
        ioc.registerVariableTypes();
        ioc.registerProcessTypes();
    }
    test('A code lens will appear when sheban python and python in settings are different', async () => {
        const pythonPath = 'someUnknownInterpreter';
        const editor = await openFile(fileShebang);
        PythonSettings.getInstance(editor.document.uri).pythonPath = pythonPath;
        const codeLenses = await setupCodeLens(editor);

        assert.equal(codeLenses.length, 1, 'No CodeLens available');
        const codeLens = codeLenses[0];
        assert(codeLens.range.isSingleLine, 'Invalid CodeLens Range');
        assert.equal(codeLens.command!.command, 'python.setShebangInterpreter');
    });

    test('Code lens will not appear when sheban python and python in settings are the same', async () => {
        PythonSettings.dispose();
        const pythonPath = await getFullyQualifiedPathToInterpreter('python');
        const editor = await openFile(fileShebang);
        PythonSettings.getInstance(editor.document.uri).pythonPath = pythonPath!;
        const codeLenses = await setupCodeLens(editor);
        assert.equal(codeLenses.length, 0, 'CodeLens available although interpreters are equal');

    });

    test('Code lens will not appear when sheban python is invalid', async () => {
        const editor = await openFile(fileShebangInvalid);
        const codeLenses = await setupCodeLens(editor);
        assert.equal(codeLenses.length, 0, 'CodeLens available even when shebang is invalid');
    });

    if (!IS_WINDOWS) {
        test('A code lens will appear when shebang python uses env and python settings are different', async () => {
            const editor = await openFile(fileShebangEnv);
            PythonSettings.getInstance(editor.document.uri).pythonPath = 'p1';
            const codeLenses = await setupCodeLens(editor);

            assert.equal(codeLenses.length, 1, 'No CodeLens available');
            const codeLens = codeLenses[0];
            assert(codeLens.range.isSingleLine, 'Invalid CodeLens Range');
            assert.equal(codeLens.command!.command, 'python.setShebangInterpreter');

        });

        test('Code lens will not appear even when shebang python uses env and python settings are the same', async () => {
            const pythonPath = await getFullyQualifiedPathToInterpreter('python');
            const editor = await openFile(fileShebangEnv);
            PythonSettings.getInstance(editor.document.uri).pythonPath = pythonPath!;
            const codeLenses = await setupCodeLens(editor);
            assert.equal(codeLenses.length, 0, 'CodeLens available although interpreters are equal');
        });
    }

    test('Code lens will not appear as there is no shebang', async () => {
        const editor = await openFile(filePlain);
        const codeLenses = await setupCodeLens(editor);
        assert.equal(codeLenses.length, 0, 'CodeLens available although no shebang');
    });

    async function openFile(fileName: string) {
        const document = await vscode.workspace.openTextDocument(fileName);
        const editor = await vscode.window.showTextDocument(document);
        assert(vscode.window.activeTextEditor, 'No active editor');
        return editor;
    }
    async function getFullyQualifiedPathToInterpreter(pythonPath: string) {
        return new Promise<string>(resolve => {
            child_process.execFile(pythonPath, ['-c', 'import sys;print(sys.executable)'], (_, stdout) => {
                resolve(getFirstNonEmptyLineFromMultilineString(stdout));
            });
        }).catch(() => undefined);
    }

    async function setupCodeLens(editor: vscode.TextEditor) {
        const document = editor.document;
        const processService = ioc.serviceContainer.get<IProcessService>(IProcessService);
        const codeLensProvider = new ShebangCodeLensProvider(processService);
        return await codeLensProvider.provideCodeLenses(document, new CancellationTokenSource().token);
    }
});
