// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { assert } from 'chai';
import { IDisposable } from 'monaco-editor';
import { anything, instance, mock, when } from 'ts-mockito';
import * as typemoq from 'typemoq';
import { QuickPickItem, Uri } from 'vscode';
import { DebugService } from '../../client/common/application/debugService';
import { IApplicationShell } from '../../client/common/application/types';
import { WorkspaceService } from '../../client/common/application/workspace';
import { ConfigurationService } from '../../client/common/configuration/service';
import { IS_WINDOWS } from '../../client/common/platform/constants';
import { IDataScienceSettings, IExtensionContext } from '../../client/common/types';
import * as localize from '../../client/common/utils/localize';
import { noop } from '../../client/common/utils/misc';
import { MultiStepInputFactory } from '../../client/common/utils/multiStepInput';
import { generateCells } from '../../client/datascience/cellFactory';
import { CellMatcher } from '../../client/datascience/cellMatcher';
import { addToUriList, formatStreamText, stripComments } from '../../client/datascience/common';
import { Settings } from '../../client/datascience/constants';
import { DataScience } from '../../client/datascience/datascience';
import { DataScienceCodeLensProvider } from '../../client/datascience/editor-integration/codelensprovider';
import { NativeEditorProvider } from '../../client/datascience/interactive-ipynb/nativeEditorProvider';
import { JupyterSessionManagerFactory } from '../../client/datascience/jupyter/jupyterSessionManagerFactory';
import { expandWorkingDir } from '../../client/datascience/jupyter/jupyterUtils';
import { KernelSelector } from '../../client/datascience/jupyter/kernels/kernelSelector';
import { ServiceContainer } from '../../client/ioc/container';
import { InputHistory } from '../../datascience-ui/interactive-common/inputHistory';
import {
    createEmptyCell,
    CursorPos,
    extractInputText,
    ICellViewModel
} from '../../datascience-ui/interactive-common/mainState';
import { MockOutputChannel } from '../mockClasses';
import { MockMemento } from '../mocks/mementos';
import { defaultDataScienceSettings } from './helpers';
import { MockCommandManager } from './mockCommandManager';
import { MockDocumentManager } from './mockDocumentManager';
import { MockInputBox } from './mockInputBox';
import { MockQuickPick } from './mockQuickPick';

// tslint:disable: max-func-body-length
suite('Data Science Tests', () => {
    const workspaceService = mock(WorkspaceService);
    const kernelSelector = mock(KernelSelector);
    let quickPick: MockQuickPick | undefined;

    test('formatting stream text', async () => {
        assert.equal(formatStreamText('\rExecute\rExecute 1'), 'Execute 1');
        assert.equal(formatStreamText('\rExecute\r\nExecute 2'), 'Execute\nExecute 2');
        assert.equal(formatStreamText('\rExecute\rExecute\r\nExecute 3'), 'Execute\nExecute 3');
        assert.equal(formatStreamText('\rExecute\rExecute\nExecute 4'), 'Execute\nExecute 4');
        assert.equal(formatStreamText('\rExecute\r\r \r\rExecute\nExecute 5'), 'Execute\nExecute 5');
        assert.equal(formatStreamText('\rExecute\rExecute\nExecute 6\rExecute 7'), 'Execute\nExecute 7');
        assert.equal(formatStreamText('\rExecute\rExecute\nExecute 8\rExecute 9\r\r'), 'Execute\n');
        assert.equal(formatStreamText('\rExecute\rExecute\nExecute 10\rExecute 11\r\n'), 'Execute\nExecute 11\n');
    });

    // tslint:disable: no-invalid-template-strings
    test('expanding file variables', async function () {
        // tslint:disable-next-line: no-invalid-this
        this.timeout(10000);
        const uri = Uri.file('test/bar');
        const folder = { index: 0, name: '', uri };
        when(workspaceService.hasWorkspaceFolders).thenReturn(true);
        when(workspaceService.workspaceFolders).thenReturn([folder]);
        when(workspaceService.getWorkspaceFolder(anything())).thenReturn(folder);
        const inst = instance(workspaceService);
        const relativeFilePath = IS_WINDOWS ? '..\\xyz\\bip\\foo.baz' : '../xyz/bip/foo.baz';
        const relativeFileDir = IS_WINDOWS ? '..\\xyz\\bip' : '../xyz/bip';

        assert.equal(expandWorkingDir(undefined, 'bar/foo.baz', inst), 'bar');
        assert.equal(expandWorkingDir(undefined, 'bar/bip/foo.baz', inst), 'bar/bip');
        assert.equal(expandWorkingDir('${file}', 'bar/bip/foo.baz', inst), Uri.file('bar/bip/foo.baz').fsPath);
        assert.equal(expandWorkingDir('${fileDirname}', 'bar/bip/foo.baz', inst), Uri.file('bar/bip').fsPath);
        assert.equal(expandWorkingDir('${relativeFile}', 'test/xyz/bip/foo.baz', inst), relativeFilePath);
        assert.equal(expandWorkingDir('${relativeFileDirname}', 'test/xyz/bip/foo.baz', inst), relativeFileDir);
        assert.equal(expandWorkingDir('${cwd}', 'test/xyz/bip/foo.baz', inst), Uri.file('test/bar').fsPath);
        assert.equal(expandWorkingDir('${workspaceFolder}', 'test/xyz/bip/foo.baz', inst), Uri.file('test/bar').fsPath);
        assert.equal(expandWorkingDir('${cwd}-${file}', 'bar/bip/foo.baz', inst), `${Uri.file('test/bar').fsPath}-${Uri.file('bar/bip/foo.baz').fsPath}`);
    });

    test('input history', async () => {
        let history = new InputHistory();
        history.add('1', true);
        history.add('2', true);
        history.add('3', true);
        history.add('4', true);
        assert.equal(history.completeDown('5'), '5');
        history.add('5', true);
        assert.equal(history.completeUp(''), '5');
        history.add('5', false);
        assert.equal(history.completeUp('5'), '5');
        assert.equal(history.completeUp('4'), '4');
        assert.equal(history.completeUp('2'), '3');
        assert.equal(history.completeUp('1'), '2');
        assert.equal(history.completeUp(''), '1');

        // Add should reset position.
        history.add('6', true);
        assert.equal(history.completeUp(''), '6');
        assert.equal(history.completeUp(''), '5');
        assert.equal(history.completeUp(''), '4');
        assert.equal(history.completeUp(''), '3');
        assert.equal(history.completeUp(''), '2');
        assert.equal(history.completeUp(''), '1');
        history = new InputHistory();
        history.add('1', true);
        history.add('2', true);
        history.add('3', true);
        history.add('4', true);
        assert.equal(history.completeDown('5'), '5');
        assert.equal(history.completeDown(''), '');
        assert.equal(history.completeUp('1'), '4');
        assert.equal(history.completeDown('4'), '4');
        assert.equal(history.completeDown('4'), '4');
        assert.equal(history.completeUp('1'), '3');
        assert.equal(history.completeUp('4'), '2');
        assert.equal(history.completeDown('3'), '3');
        assert.equal(history.completeDown(''), '4');
        assert.equal(history.completeUp(''), '3');
        assert.equal(history.completeUp(''), '2');
        assert.equal(history.completeUp(''), '1');
        assert.equal(history.completeUp(''), '');
        assert.equal(history.completeUp('1'), '1');
        assert.equal(history.completeDown('1'), '2');
        assert.equal(history.completeDown('2'), '3');
        assert.equal(history.completeDown('3'), '4');
        assert.equal(history.completeDown(''), '');
        history.add('5', true);
        assert.equal(history.completeUp('1'), '5');
        assert.equal(history.completeUp('1'), '4');
        assert.equal(history.completeUp('1'), '3');
        history.add('3', false);
        assert.equal(history.completeUp('1'), '3');
        assert.equal(history.completeUp('1'), '2');
        assert.equal(history.completeUp('1'), '1');
        assert.equal(history.completeDown('1'), '2');
        assert.equal(history.completeUp('1'), '1');
        assert.equal(history.completeDown('1'), '2');
        assert.equal(history.completeDown('1'), '3');
        assert.equal(history.completeDown('1'), '4');
        assert.equal(history.completeDown('1'), '5');
        assert.equal(history.completeDown('1'), '3');
    });

    test('parsing cells', () => {
        let cells = generateCells(undefined, '#%%\na=1\na', 'foo', 0, true, '1');
        assert.equal(cells.length, 1, 'Simple cell, not right number found');
        cells = generateCells(undefined, '#%% [markdown]\na=1\na', 'foo', 0, true, '1');
        assert.equal(cells.length, 2, 'Split cell, not right number found');
        cells = generateCells(undefined, '#%% [markdown]\n# #a=1\n#a', 'foo', 0, true, '1');
        assert.equal(cells.length, 1, 'Markdown split wrong');
        assert.equal(cells[0].data.cell_type, 'markdown', 'Markdown cell not generated');
        cells = generateCells(undefined, '#%% [markdown]\n\'\'\'\n# a\nb\n\'\'\'', 'foo', 0, true, '1');
        assert.equal(cells.length, 1, 'Markdown cell multline failed');
        assert.equal(cells[0].data.cell_type, 'markdown', 'Markdown cell not generated');
        assert.equal(cells[0].data.source.length, 2, 'Lines for markdown not emitted');
        cells = generateCells(undefined, '#%% [markdown]\n\"\"\"\n# a\nb\n\"\"\"', 'foo', 0, true, '1');
        assert.equal(cells.length, 1, 'Markdown cell multline failed');
        assert.equal(cells[0].data.cell_type, 'markdown', 'Markdown cell not generated');
        assert.equal(cells[0].data.source.length, 2, 'Lines for markdown not emitted');
        cells = generateCells(undefined, '#%% \n\"\"\"\n# a\nb\n\"\"\"', 'foo', 0, true, '1');
        assert.equal(cells.length, 1, 'Code cell multline failed');
        assert.equal(cells[0].data.cell_type, 'code', 'Code cell not generated');
        assert.equal(cells[0].data.source.length, 5, 'Lines for cell not emitted');
        cells = generateCells(undefined, '#%% [markdown] \n\"\"\"# a\nb\n\"\"\"', 'foo', 0, true, '1');
        assert.equal(cells.length, 1, 'Markdown cell multline failed');
        assert.equal(cells[0].data.cell_type, 'markdown', 'Markdown cell not generated');
        assert.equal(cells[0].data.source.length, 2, 'Lines for cell not emitted');

        // tslint:disable-next-line: no-multiline-string
        const multilineCode = `#%%
myvar = """ # Lorem Ipsum
Lorem ipsum dolor sit amet, consectetur adipiscing elit.
Nullam eget varius ligula, eget fermentum mauris.
Cras ultrices, enim sit amet iaculis ornare, nisl nibh aliquet elit, sed ultrices velit ipsum dignissim nisl.
Nunc quis orci ante. Vivamus vel blandit velit.
Sed mattis dui diam, et blandit augue mattis vestibulum.
Suspendisse ornare interdum velit. Suspendisse potenti.
Morbi molestie lacinia sapien nec porttitor. Nam at vestibulum nisi.
"""`;
        // tslint:disable-next-line: no-multiline-string
        const multilineTwo = `#%%
""" # Lorem Ipsum
Lorem ipsum dolor sit amet, consectetur adipiscing elit.
Nullam eget varius ligula, eget fermentum mauris.
Cras ultrices, enim sit amet iaculis ornare, nisl nibh aliquet elit, sed ultrices velit ipsum dignissim nisl.
Nunc quis orci ante. Vivamus vel blandit velit.
Sed mattis dui diam, et blandit augue mattis vestibulum.
Suspendisse ornare interdum velit. Suspendisse potenti.
Morbi molestie lacinia sapien nec porttitor. Nam at vestibulum nisi.
""" print('bob')`;

        cells = generateCells(undefined, multilineCode, 'foo', 0, true, '1');
        assert.equal(cells.length, 1, 'code cell multline failed');
        assert.equal(cells[0].data.cell_type, 'code', 'Code cell not generated');
        assert.equal(cells[0].data.source.length, 10, 'Lines for cell not emitted');
        cells = generateCells(undefined, multilineTwo, 'foo', 0, true, '1');
        assert.equal(cells.length, 1, 'code cell multline failed');
        assert.equal(cells[0].data.cell_type, 'code', 'Code cell not generated');
        assert.equal(cells[0].data.source.length, 10, 'Lines for cell not emitted');
        // tslint:disable-next-line: no-multiline-string
        assert.equal(cells[0].data.source[9], `""" print('bob')`, 'Lines for cell not emitted');
        // tslint:disable-next-line: no-multiline-string
        const multilineMarkdown = `#%% [markdown]
# ## Block of Interest
#
# ### Take a look
#
#
#   1. Item 1
#
#     - Item 1-a
#       1. Item 1-a-1
#          - Item 1-a-1-a
#          - Item 1-a-1-b
#       2. Item 1-a-2
#          - Item 1-a-2-a
#          - Item 1-a-2-b
#       3. Item 1-a-3
#          - Item 1-a-3-a
#          - Item 1-a-3-b
#          - Item 1-a-3-c
#
#   2. Item 2`;
        cells = generateCells(undefined, multilineMarkdown, 'foo', 0, true, '1');
        assert.equal(cells.length, 1, 'markdown cell multline failed');
        assert.equal(cells[0].data.cell_type, 'markdown', 'markdown cell not generated');
        assert.equal(cells[0].data.source.length, 20, 'Lines for cell not emitted');
        assert.equal(cells[0].data.source[17], '          - Item 1-a-3-c\n', 'Lines for markdown not emitted');

        // tslint:disable-next-line: no-multiline-string
        const multilineQuoteWithOtherDelimiter = `#%% [markdown]
'''
### Take a look
  2. Item 2
""" Not a comment delimiter
'''
`;
        cells = generateCells(undefined, multilineQuoteWithOtherDelimiter, 'foo', 0, true, '1');
        assert.equal(cells.length, 1, 'markdown cell multline failed');
        assert.equal(cells[0].data.cell_type, 'markdown', 'markdown cell not generated');
        assert.equal(cells[0].data.source.length, 3, 'Lines for cell not emitted');
        assert.equal(cells[0].data.source[2], '""" Not a comment delimiter', 'Lines for markdown not emitted');

        // tslint:disable-next-line: no-multiline-string
        const multilineQuoteInFunc = `#%%
import requests
def download(url, filename):
    """ utility function to download a file """
    response = requests.get(url, stream=True)
    with open(filename, "wb") as handle:
        for data in response.iter_content():
            handle.write(data)
`;
        cells = generateCells(undefined, multilineQuoteInFunc, 'foo', 0, true, '1');
        assert.equal(cells.length, 1, 'cell multline failed');
        assert.equal(cells[0].data.cell_type, 'code', 'code cell not generated');
        assert.equal(cells[0].data.source.length, 9, 'Lines for cell not emitted');
        assert.equal(cells[0].data.source[3], '    """ utility function to download a file """\n', 'Lines for cell not emitted');

        // tslint:disable-next-line: no-multiline-string
        const multilineMarkdownWithCell = `#%% [markdown]
# # Define a simple class
class Pizza(object):
    def __init__(self, size, toppings, price, rating):
        self.size = size
        self.toppings = toppings
        self.price = price
        self.rating = rating
        `;

        cells = generateCells(undefined, multilineMarkdownWithCell, 'foo', 0, true, '1');
        assert.equal(cells.length, 2, 'cell split failed');
        assert.equal(cells[0].data.cell_type, 'markdown', 'markdown cell not generated');
        assert.equal(cells[0].data.source.length, 1, 'Lines for markdown not emitted');
        assert.equal(cells[1].data.cell_type, 'code', 'code cell not generated');
        assert.equal(cells[1].data.source.length, 7, 'Lines for code not emitted');
        assert.equal(cells[1].data.source[3], '        self.toppings = toppings\n', 'Lines for cell not emitted');

        // Non comments tests
        let nonComments = stripComments(multilineCode);
        assert.ok(nonComments.startsWith('myvar = """ # Lorem Ipsum'), 'Variable set to multiline string not working');
        nonComments = stripComments(multilineTwo);
        assert.equal(nonComments, '', 'Multline comment is not being stripped');
        nonComments = stripComments(multilineQuoteInFunc);
        assert.equal(nonComments.splitLines().length, 6, 'Splitting quote in func wrong number of lines');
    });

    function createDataScienceObject(quickPickSelection: string, inputSelection: string, updateCallback: (val: string) => void, mockStorage?: MockMemento): DataScience {
        const configService = mock(ConfigurationService);
        const serviceContainer = mock(ServiceContainer);
        const codeLensProvider = mock(DataScienceCodeLensProvider);
        const notebookProvider = mock(NativeEditorProvider);
        const jupyterSessionManagerFactory = mock(JupyterSessionManagerFactory);
        const disposableRegistry: IDisposable[] = [];
        const debugService = mock(DebugService);
        const applicationShell = typemoq.Mock.ofType<IApplicationShell>();
        const documentManager = new MockDocumentManager();
        const commandManager = new MockCommandManager();
        const storage = mockStorage ? mockStorage : new MockMemento();
        const context: typemoq.IMock<IExtensionContext> = typemoq.Mock.ofType<IExtensionContext>();
        quickPick = new MockQuickPick(quickPickSelection);
        const input = new MockInputBox(inputSelection);
        applicationShell.setup(a => a.createQuickPick()).returns(() => quickPick!);
        applicationShell.setup(a => a.createInputBox()).returns(() => input);
        const multiStepFactory = new MultiStepInputFactory(applicationShell.object);
        when(configService.updateSetting('dataScience.jupyterServerURI', anything(), anything(), anything())).thenCall((_a1, a2, _a3, _a4) => {
            updateCallback(a2);
            return Promise.resolve();
        });

        return new DataScience(
            instance(serviceContainer),
            commandManager,
            disposableRegistry,
            context.object,
            instance(codeLensProvider),
            instance(configService),
            documentManager,
            instance(workspaceService),
            [],
            instance(notebookProvider),
            instance(debugService),
            storage,
            instance(jupyterSessionManagerFactory),
            multiStepFactory,
            kernelSelector,
            new MockOutputChannel('Jupyter')
        );
    }

    test('Local pick server uri', async () => {
        let value = '';
        const ds = createDataScienceObject('$(zap) Default', '', (v) => value = v);
        await ds.selectJupyterURI();
        assert.equal(value, Settings.JupyterServerLocalLaunch, 'Default should pick local launch');

        // Try a second time.
        await ds.selectJupyterURI();
        assert.equal(value, Settings.JupyterServerLocalLaunch, 'Default should pick local launch');

        // Verify active items
        assert.equal(quickPick?.items.length, 2, 'Wrong number of items in the quick pick');
    });

    test('Quick pick MRU tests', async () => {
        const mockStorage = new MockMemento();
        const ds = createDataScienceObject('$(zap) Default', '', () => { noop(); }, mockStorage);

        await ds.selectJupyterURI();
        // Verify initial default items
        assert.equal(quickPick?.items.length, 2, 'Wrong number of items in the quick pick');

        // Add in a new server
        const serverA1 = { uri: 'ServerA', time: 1, date: new Date(1) };
        addToUriList(mockStorage, serverA1.uri, serverA1.time);

        await ds.selectJupyterURI();
        assert.equal(quickPick?.items.length, 3, 'Wrong number of items in the quick pick');
        quickPickCheck(quickPick?.items[2], serverA1);

        // Add in a second server, the newer server should be higher in the list due to newer time
        const serverB1 = { uri: 'ServerB', time: 2, date: new Date(2) };
        addToUriList(mockStorage, serverB1.uri, serverB1.time);
        await ds.selectJupyterURI();
        assert.equal(quickPick?.items.length, 4, 'Wrong number of items in the quick pick');
        quickPickCheck(quickPick?.items[2], serverB1);
        quickPickCheck(quickPick?.items[3], serverA1);

        // Reconnect to server A with a new time, it should now be higher in the list
        const serverA3 = { uri: 'ServerA', time: 3, date: new Date(3) };
        addToUriList(mockStorage, serverA3.uri, serverA3.time);
        await ds.selectJupyterURI();
        assert.equal(quickPick?.items.length, 4, 'Wrong number of items in the quick pick');
        quickPickCheck(quickPick?.items[3], serverB1);
        quickPickCheck(quickPick?.items[2], serverA1);

        // Verify that we stick to our settings limit
        for (let i = 0; i < (Settings.JupyterServerUriListMax + 10); i = i + 1) {
            addToUriList(mockStorage, i.toString(), i);
        }

        await ds.selectJupyterURI();
        // Need a plus 2 here for the two default items
        assert.equal(quickPick?.items.length, (Settings.JupyterServerUriListMax + 2), 'Wrong number of items in the quick pick');
    });

    function quickPickCheck(item: QuickPickItem | undefined, expected: { uri: string; time: Number; date: Date }) {
        assert.isOk(item, 'Quick pick item not defined');
        if (item) {
            assert.equal(item.label, expected.uri, 'Wrong URI value in quick pick');
            assert.equal(item.detail, localize.DataScience.jupyterSelectURIMRUDetail().format(expected.date.toLocaleString()), 'Wrong detail value in quick pick');
        }
    }

    test('Remote server uri', async () => {
        let value = '';
        const ds = createDataScienceObject('$(server) Existing', 'http://localhost:1111', (v) => value = v);
        await ds.selectJupyterURI();
        assert.equal(value, 'http://localhost:1111', 'Already running should end up with the user inputed value');
    });

    test('Invalid server uri', async () => {
        let value = '';
        const ds = createDataScienceObject('$(server) Existing', 'httx://localhost:1111', (v) => value = v);
        await ds.selectJupyterURI();
        assert.notEqual(value, 'httx://localhost:1111', 'Already running should validate');
        assert.equal(value, '', 'Validation failed');
    });

    function cloneVM(cvm: ICellViewModel, newCode: string, debugging?: boolean): ICellViewModel {
        const result = {
            ...cvm,
            cell: {
                ...cvm.cell,
                data: {
                    ...cvm.cell.data,
                    source: newCode
                }
            },
            inputBlockText: newCode,
            runDuringDebug: debugging
        };

        // Typecast so that the build works. ICell.MetaData doesn't like reassigning
        // tslint:disable-next-line: no-any
        return (result as any) as ICellViewModel;
    }

    test('ExtractInputText', () => {
        const settings: IDataScienceSettings = defaultDataScienceSettings();
        settings.stopOnFirstLineWhileDebugging = true;
        const cvm: ICellViewModel = {
            cell: createEmptyCell('1', null),
            inputBlockCollapseNeeded: false,
            inputBlockText: '',
            inputBlockOpen: false,
            inputBlockShow: false,
            editable: false,
            focused: false,
            selected: false,
            scrollCount: 0,
            cursorPos: CursorPos.Current,
            hasBeenRun: false
        };
        assert.equal(extractInputText(cloneVM(cvm, '# %%\na=1'), settings), 'a=1', 'Cell marker not removed');
        assert.equal(extractInputText(cloneVM(cvm, '# %%\nbreakpoint()\na=1'), settings), 'breakpoint()\na=1', 'Cell marker not removed');
        assert.equal(extractInputText(cloneVM(cvm, '# %%\nbreakpoint()\na=1', true), settings), 'a=1', 'Cell marker not removed');
    });

    test('CellMatcher', () => {
        const settings: IDataScienceSettings = defaultDataScienceSettings();
        const matcher1 = new CellMatcher(settings);
        assert.ok(matcher1.isCode('# %%'), 'Base code is wrong');
        assert.ok(matcher1.isMarkdown('# %% [markdown]'), 'Base markdown is wrong');
        assert.equal(matcher1.exec('# %% TITLE'), 'TITLE', 'Title not found');

        settings.defaultCellMarker = '# %% CODE HERE';
        const matcher2 = new CellMatcher(settings);
        assert.ok(matcher2.isCode('# %%'), 'Code not found');
        assert.ok(matcher2.isCode('# %% CODE HERE'), 'Code not found');
        assert.ok(matcher2.isCode('# %% CODE HERE TOO'), 'Code not found');
        assert.ok(matcher2.isMarkdown('# %% [markdown]'), 'Base markdown is wrong');
        assert.equal(matcher2.exec('# %% CODE HERE'), '', 'Should not have a title');
        assert.equal(matcher2.exec('# %% CODE HERE FOO'), 'FOO', 'Should have a title');
    });

});
