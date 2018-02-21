import * as fs from 'fs-extra';
import * as path from 'path';
import * as vscode from 'vscode';
import { CancellationTokenSource, Uri } from 'vscode';
import { IProcessService, IPythonExecutionFactory } from '../../client/common/process/types';
import { AutoPep8Formatter } from '../../client/formatters/autoPep8Formatter';
import { YapfFormatter } from '../../client/formatters/yapfFormatter';
import { closeActiveWindows, initialize, initializeTest } from '../initialize';
import { MockProcessService } from '../mocks/proc';
import { compareFiles } from '../textUtils';
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

// tslint:disable-next-line:max-func-body-length
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
        compareFiles(formattedContents, textEditor.document.getText());
    }

    test('AutoPep8', async () => await testFormatting(new AutoPep8Formatter(ioc.serviceContainer), formattedAutoPep8, autoPep8FileToFormat, 'autopep8.output'));
    test('Yapf', async () => await testFormatting(new YapfFormatter(ioc.serviceContainer), formattedYapf, yapfFileToFormat, 'yapf.output'));

    test('Yapf on dirty file', async () => {
        const sourceDir = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'formatting');
        const targetDir = path.join(__dirname, '..', 'pythonFiles', 'formatting');

        const originalName = 'formatWhenDirty.py';
        const resultsName = 'formatWhenDirtyResult.py';
        const fileToFormat = path.join(targetDir, originalName);
        const formattedFile = path.join(targetDir, resultsName);

        if (!fs.pathExistsSync(targetDir)) {
            fs.mkdirSync(targetDir);
        }
        fs.copySync(path.join(sourceDir, originalName), fileToFormat, { overwrite: true });
        fs.copySync(path.join(sourceDir, resultsName), formattedFile, { overwrite: true });

        const textDocument = await vscode.workspace.openTextDocument(fileToFormat);
        const textEditor = await vscode.window.showTextDocument(textDocument);
        await textEditor.edit(builder => {
            // Make file dirty. Trailing blanks will be removed.
            builder.insert(new vscode.Position(0, 0), '\n    \n');
        });

        const dir = path.dirname(fileToFormat);
        const configFile = path.join(dir, '.style.yapf');
        try {
            // Create yapf configuration file
            const content = '[style]\nbased_on_style = pep8\nindent_width=5\n';
            fs.writeFileSync(configFile, content);

            const options = { insertSpaces: textEditor.options.insertSpaces! as boolean, tabSize: 1 };
            const formatter = new YapfFormatter(ioc.serviceContainer);
            const edits = await formatter.formatDocument(textDocument, options, new CancellationTokenSource().token);
            await textEditor.edit(editBuilder => {
                edits.forEach(edit => editBuilder.replace(edit.range, edit.newText));
            });

            const expected = fs.readFileSync(formattedFile).toString();
            const actual = textEditor.document.getText();
            compareFiles(expected, actual);
        } finally {
            if (fs.existsSync(configFile)) {
                fs.unlinkSync(configFile);
            }
        }
    });
});
