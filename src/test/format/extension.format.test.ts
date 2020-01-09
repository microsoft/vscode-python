// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import * as fs from 'fs-extra';
import * as path from 'path';
import { CancellationTokenSource, Position, Uri, window, workspace } from 'vscode';
import { IProcessServiceFactory, IPythonExecutionFactory } from '../../client/common/process/types';
import { AutoPep8Formatter } from '../../client/formatters/autoPep8Formatter';
import { BlackFormatter } from '../../client/formatters/blackFormatter';
import { YapfFormatter } from '../../client/formatters/yapfFormatter';
import { ICondaService } from '../../client/interpreter/contracts';
import { CondaService } from '../../client/interpreter/locators/services/condaService';
import { InterpreterHashProvider } from '../../client/interpreter/locators/services/hashProvider';
import { InterpeterHashProviderFactory } from '../../client/interpreter/locators/services/hashProviderFactory';
import { InterpreterFilter } from '../../client/interpreter/locators/services/interpreterFilter';
import { WindowsStoreInterpreter } from '../../client/interpreter/locators/services/windowsStoreInterpreter';
import { isPythonVersionInProcess } from '../common';
import { closeActiveWindows, initialize, initializeTest } from '../initialize';
import { MockProcessService } from '../mocks/proc';
import { UnitTestIocContainer } from '../testing/serviceRegistry';
import { compareFiles } from '../textUtils';

const ch = window.createOutputChannel('Tests');
const formatFilesPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'formatting');
const workspaceRootPath = path.join(__dirname, '..', '..', '..', 'src', 'test');
const originalUnformattedFile = path.join(formatFilesPath, 'fileToFormat.py');

const autoPep8FileToFormat = path.join(formatFilesPath, 'autoPep8FileToFormat.py');
const blackFileToFormat = path.join(formatFilesPath, 'blackFileToFormat.py');
const blackReferenceFile = path.join(formatFilesPath, 'blackFileReference.py');
const yapfFileToFormat = path.join(formatFilesPath, 'yapfFileToFormat.py');

let formattedYapf = '';
let formattedBlack = '';
let formattedAutoPep8 = '';

// tslint:disable-next-line:max-func-body-length
suite('Formatting - General', () => {
    let ioc: UnitTestIocContainer;

    suiteSetup(async () => {
        await initialize();
        initializeDI();
        [autoPep8FileToFormat, blackFileToFormat, blackReferenceFile, yapfFileToFormat].forEach(file => {
            fs.copySync(originalUnformattedFile, file, { overwrite: true });
        });
        fs.ensureDirSync(path.dirname(autoPep8FileToFormat));
        const pythonProcess = await ioc.serviceContainer.get<IPythonExecutionFactory>(IPythonExecutionFactory).create({ resource: Uri.file(workspaceRootPath) });
        const yapf = pythonProcess.execModule('yapf', [originalUnformattedFile], { cwd: workspaceRootPath });
        const autoPep8 = pythonProcess.execModule('autopep8', [originalUnformattedFile], { cwd: workspaceRootPath });
        const formatters = [yapf, autoPep8];
        if (await formattingTestIsBlackSupported()) {
            // Black doesn't support emitting only to stdout; it either works
            // through a pipe, emits a diff, or rewrites the file in-place.
            // Thus it's easier to let it do its in-place rewrite and then
            // read the reference file from there.
            const black = pythonProcess.execModule('black', [blackReferenceFile], { cwd: workspaceRootPath });
            formatters.push(black);
        }
        await Promise.all(formatters).then(async formattedResults => {
            formattedYapf = formattedResults[0].stdout;
            formattedAutoPep8 = formattedResults[1].stdout;
            if (await formattingTestIsBlackSupported()) {
                formattedBlack = fs.readFileSync(blackReferenceFile).toString();
            }
        });
    });

    async function formattingTestIsBlackSupported(): Promise<boolean> {
        const processService = await ioc.serviceContainer.get<IProcessServiceFactory>(IProcessServiceFactory).create(Uri.file(workspaceRootPath));
        return !(await isPythonVersionInProcess(processService, '2', '3.0', '3.1', '3.2', '3.3', '3.4', '3.5'));
    }

    setup(async () => {
        await initializeTest();
        initializeDI();
    });
    suiteTeardown(async () => {
        [autoPep8FileToFormat, blackFileToFormat, blackReferenceFile, yapfFileToFormat].forEach(file => {
            if (fs.existsSync(file)) {
                fs.unlinkSync(file);
            }
        });
        ch.dispose();
        await closeActiveWindows();
    });
    teardown(async () => {
        await ioc.dispose();
    });

    function initializeDI() {
        ioc = new UnitTestIocContainer();
        ioc.registerCommonTypes();
        ioc.registerVariableTypes();
        ioc.registerUnitTestTypes();
        ioc.registerFormatterTypes();

        ioc.serviceManager.addSingleton<WindowsStoreInterpreter>(WindowsStoreInterpreter, WindowsStoreInterpreter);
        ioc.serviceManager.addSingleton<InterpreterHashProvider>(InterpreterHashProvider, InterpreterHashProvider);
        ioc.serviceManager.addSingleton<InterpeterHashProviderFactory>(InterpeterHashProviderFactory, InterpeterHashProviderFactory);
        ioc.serviceManager.addSingleton<InterpreterFilter>(InterpreterFilter, InterpreterFilter);
        ioc.serviceManager.addSingleton<ICondaService>(ICondaService, CondaService);

        // Mocks.
        ioc.registerMockProcessTypes();
        ioc.registerMockInterpreterTypes();
    }

    async function injectFormatOutput(outputFileName: string) {
        const procService = (await ioc.serviceContainer.get<IProcessServiceFactory>(IProcessServiceFactory).create()) as MockProcessService;
        procService.onExecObservable((_file, args, _options, callback) => {
            if (args.indexOf('--diff') >= 0) {
                callback({
                    out: fs.readFileSync(path.join(formatFilesPath, outputFileName), 'utf8'),
                    source: 'stdout'
                });
            }
        });
    }

    async function testFormatting(formatter: AutoPep8Formatter | BlackFormatter | YapfFormatter, formattedContents: string, fileToFormat: string, outputFileName: string) {
        const textDocument = await workspace.openTextDocument(fileToFormat);
        const textEditor = await window.showTextDocument(textDocument);
        const options = { insertSpaces: textEditor.options.insertSpaces! as boolean, tabSize: textEditor.options.tabSize! as number };

        await injectFormatOutput(outputFileName);

        const edits = await formatter.formatDocument(textDocument, options, new CancellationTokenSource().token);
        await textEditor.edit(editBuilder => {
            edits.forEach(edit => editBuilder.replace(edit.range, edit.newText));
        });
        compareFiles(formattedContents, textEditor.document.getText());
    }

    test('AutoPep8', async () => {
        await testFormatting(new AutoPep8Formatter(ioc.serviceContainer), formattedAutoPep8, autoPep8FileToFormat, 'autopep8.output');
    });
    // tslint:disable-next-line:no-function-expression
    test('Black', async function() {
        if (!(await formattingTestIsBlackSupported())) {
            // Skip for versions of python below 3.6, as Black doesn't support them at all.
            // tslint:disable-next-line:no-invalid-this
            return this.skip();
        }
        await testFormatting(new BlackFormatter(ioc.serviceContainer), formattedBlack, blackFileToFormat, 'black.output');
    });
    test('Yapf', async () => testFormatting(new YapfFormatter(ioc.serviceContainer), formattedYapf, yapfFileToFormat, 'yapf.output'));

    test('Yapf on dirty file', async () => {
        const sourceDir = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'formatting');
        const targetDir = path.join(__dirname, '..', 'pythonFiles', 'formatting');

        const originalName = 'formatWhenDirty.py';
        const resultsName = 'formatWhenDirtyResult.py';
        const fileToFormat = path.join(targetDir, originalName);
        const formattedFile = path.join(targetDir, resultsName);

        if (!fs.pathExistsSync(targetDir)) {
            fs.mkdirpSync(targetDir);
        }
        fs.copySync(path.join(sourceDir, originalName), fileToFormat, { overwrite: true });
        fs.copySync(path.join(sourceDir, resultsName), formattedFile, { overwrite: true });

        const textDocument = await workspace.openTextDocument(fileToFormat);
        const textEditor = await window.showTextDocument(textDocument);
        await textEditor.edit(builder => {
            // Make file dirty. Trailing blanks will be removed.
            builder.insert(new Position(0, 0), '\n    \n');
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
