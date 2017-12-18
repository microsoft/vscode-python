import * as assert from 'assert';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as vscode from 'vscode';
import { CancellationTokenSource, Uri } from 'vscode';
import { IProcessService, IPythonExecutionFactory } from '../../client/common/process/types';
import { AutoPep8Formatter } from '../../client/formatters/autoPep8Formatter';
import { YapfFormatter } from '../../client/formatters/yapfFormatter';
import { closeActiveWindows, initialize, initializeTest } from '../initialize';
import { MockProcessService } from '../mocks/proc';
import { UnitTestIocContainer } from '../unittests/serviceRegistry';

const ch = vscode.window.createOutputChannel('Tests');
const formatFilesPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'formatting');
const workspaceRootPath = path.join(__dirname, '..', '..', '..', 'src', 'test');
const originalUnformattedFile = path.join(formatFilesPath, 'fileToFormat.py');

const autoPep8FileToFormat = path.join(formatFilesPath, 'autoPep8FileToFormat.py');
const autoPep8FileToAutoFormat = path.join(formatFilesPath, 'autoPep8FileToAutoFormat.py');
const yapfFileToFormat = path.join(formatFilesPath, 'yapfFileToFormat.py');
const yapfFileToAutoFormat = path.join(formatFilesPath, 'yapfFileToAutoFormat.py');

let formattedYapf = '';
let formattedAutoPep8 = '';

suite('Formatting', () => {
    let ioc: UnitTestIocContainer;

    suiteSetup(async () => {
        await initialize();
        initializeDI();
        [autoPep8FileToFormat, autoPep8FileToAutoFormat, yapfFileToFormat, yapfFileToAutoFormat].forEach(file => {
            fs.copySync(originalUnformattedFile, file, { overwrite: true });
        });
        fs.ensureDirSync(path.dirname(autoPep8FileToFormat));
        const pythonProcess = await ioc.serviceContainer.get<IPythonExecutionFactory>(IPythonExecutionFactory).create(Uri.file(workspaceRootPath));
        const yapf = pythonProcess.execModule('yapf', [originalUnformattedFile], { cwd: workspaceRootPath });
        const autoPep8 = pythonProcess.execModule('autopep8', [originalUnformattedFile], { cwd: workspaceRootPath });
        await Promise.all([yapf, autoPep8]).then(formattedResults => {
            formattedYapf = formattedResults[0].stdout;
            formattedAutoPep8 = formattedResults[1].stdout;
        });
    });
    setup(async () => {
        await initializeTest();
        initializeDI();
    });
    suiteTeardown(async () => {
        [autoPep8FileToFormat, autoPep8FileToAutoFormat, yapfFileToFormat, yapfFileToAutoFormat].forEach(file => {
            if (fs.existsSync(file)) {
                fs.unlinkSync(file);
            }
        });
        ch.dispose();
        await closeActiveWindows();
    });
    teardown(async () => {
        ioc.dispose();
        await closeActiveWindows();
    });

    function initializeDI() {
        ioc = new UnitTestIocContainer();
        ioc.registerCommonTypes();
        ioc.registerVariableTypes();
        ioc.registerUnitTestTypes();
        ioc.registerFormatterTypes();

        // Mocks.
        ioc.registerMockProcessTypes();
    }

    function injectFormatOutput(outputFileName: string) {
        const procService = ioc.serviceContainer.get<MockProcessService>(IProcessService);
        procService.onExecObservable((file, args, options, callback) => {
            if (args.indexOf('--diff') >= 0) {
                callback({
                    out: fs.readFileSync(path.join(formatFilesPath, outputFileName), 'utf8'),
                    source: 'stdout'
                });
            }
        });
    }

    async function testFormatting(formatter: AutoPep8Formatter | YapfFormatter, formattedContents: string, fileToFormat: string, outputFileName: string) {
        const textDocument = await vscode.workspace.openTextDocument(fileToFormat);
        const textEditor = await vscode.window.showTextDocument(textDocument);
        const options = { insertSpaces: textEditor.options.insertSpaces! as boolean, tabSize: textEditor.options.tabSize! as number };

        injectFormatOutput(outputFileName);

        const edits = await formatter.formatDocument(textDocument, options, new CancellationTokenSource().token);
        await textEditor.edit(editBuilder => {
            edits.forEach(edit => editBuilder.replace(edit.range, edit.newText));
        });
        assert.equal(textEditor.document.getText(), formattedContents, 'Formatted text is not the same');
    }
    test('AutoPep8', () => testFormatting(new AutoPep8Formatter(ioc.serviceContainer), formattedAutoPep8, autoPep8FileToFormat, 'autopep8.output'));

    test('Yapf', () => testFormatting(new YapfFormatter(ioc.serviceContainer), formattedYapf, yapfFileToFormat, 'yapf.output'));
});
