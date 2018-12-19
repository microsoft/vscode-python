import * as assert from 'assert';
import * as child_process from 'child_process';
import * as path from 'path';
import { CancellationTokenSource, TextDocument, workspace } from 'vscode';
import { PythonSettings } from '../../client/common/configSettings';
import { ShebangCodeLensProvider } from '../../client/interpreter/display/shebangCodeLensProvider';
import { getFirstNonEmptyLineFromMultilineString } from '../../client/interpreter/helpers';
import { getOSType, OSType } from '../common';
import { closeActiveWindows, initialize, initializeTest } from '../initialize';
import { UnitTestIocContainer } from '../unittests/serviceRegistry';

const autoCompPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'shebang');
const fileShebang = path.join(autoCompPath, 'shebang.py');
const fileShebangEnv = path.join(autoCompPath, 'shebangEnv.py');
const fileShebangInvalid = path.join(autoCompPath, 'shebangInvalid.py');
const filePlain = path.join(autoCompPath, 'plain.py');

// tslint:disable-next-line:max-func-body-length
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
        const document = await openFile(fileShebang);
        PythonSettings.getInstance(document.uri).pythonPath = pythonPath;
        const codeLenses = await setupCodeLens(document);

        assert.equal(codeLenses.length, 1, 'No CodeLens available');
        const codeLens = codeLenses[0];
        assert(codeLens.range.isSingleLine, 'Invalid CodeLens Range');
        assert.equal(codeLens.command!.command, 'python.setShebangInterpreter');
    });

    test('Code lens will not appear when sheban python and python in settings are the same', async () => {
        PythonSettings.dispose();
        const pythonPath = await getFullyQualifiedPathToInterpreter('python');
        const document = await openFile(fileShebang);
        PythonSettings.getInstance(document.uri).pythonPath = pythonPath!;
        const codeLenses = await setupCodeLens(document);
        assert.equal(codeLenses.length, 0, 'CodeLens available although interpreters are equal');

    });

    test('Code lens will not appear when sheban python is invalid', async () => {
        const document = await openFile(fileShebangInvalid);
        const codeLenses = await setupCodeLens(document);
        assert.equal(codeLenses.length, 0, 'CodeLens available even when shebang is invalid');
    });

    if (getOSType() !== OSType.Windows) {
        test('A code lens will appear when shebang python uses env and python settings are different', async () => {
            const document = await openFile(fileShebangEnv);
            PythonSettings.getInstance(document.uri).pythonPath = 'p1';
            const codeLenses = await setupCodeLens(document);

            assert.equal(codeLenses.length, 1, 'No CodeLens available');
            const codeLens = codeLenses[0];
            assert(codeLens.range.isSingleLine, 'Invalid CodeLens Range');
            assert.equal(codeLens.command!.command, 'python.setShebangInterpreter');

        });

        test('Code lens will not appear even when shebang python uses env and python settings are the same', async () => {
            const pythonPath = await getFullyQualifiedPathToInterpreter('python');
            const document = await openFile(fileShebangEnv);
            PythonSettings.getInstance(document.uri).pythonPath = pythonPath!;
            const codeLenses = await setupCodeLens(document);
            assert.equal(codeLenses.length, 0, 'CodeLens available although interpreters are equal');
        });
    }

    test('Code lens will not appear as there is no shebang', async () => {
        const document = await openFile(filePlain);
        const codeLenses = await setupCodeLens(document);
        assert.equal(codeLenses.length, 0, 'CodeLens available although no shebang');
    });

    async function openFile(fileName: string) {
        return workspace.openTextDocument(fileName);
    }
    async function getFullyQualifiedPathToInterpreter(pythonPath: string) {
        return new Promise<string>(resolve => {
            child_process.execFile(pythonPath, ['-c', 'import sys;print(sys.executable)'], (_, stdout) => {
                resolve(getFirstNonEmptyLineFromMultilineString(stdout));
            });
        }).catch(() => undefined);
    }

    async function setupCodeLens(document: TextDocument) {
        const codeLensProvider = new ShebangCodeLensProvider(ioc.serviceContainer);
        return codeLensProvider.provideCodeLenses(document, new CancellationTokenSource().token);
    }
});
