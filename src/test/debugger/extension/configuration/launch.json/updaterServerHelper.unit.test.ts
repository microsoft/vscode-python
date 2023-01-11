// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as assert from 'assert';
import * as sinon from 'sinon';
import { instance, mock, when } from 'ts-mockito';
import * as typemoq from 'typemoq';
import {
    CancellationTokenSource,
    DebugConfiguration,
    Position,
    Range,
    TextDocument,
    TextEditor,
    TextLine,
    Uri,
} from 'vscode';
import { PythonDebugConfigurationService } from '../../../../../client/debugger/extension/configuration/debugConfigurationService';
import { LaunchJsonUpdaterServiceHelper } from '../../../../../client/debugger/extension/configuration/launch.json/updaterServiceHelper';
import { IDebugConfigurationService } from '../../../../../client/debugger/extension/types';
import * as windowApis from '../../../../../client/common/vscodeApis/windowApis';
import * as workspaceApis from '../../../../../client/common/vscodeApis/workspaceApis';
import * as commandApis from '../../../../../client/common/vscodeApis/commandApis';

type LaunchJsonSchema = {
    version: string;
    configurations: DebugConfiguration[];
};

suite('Debugging - launch.json Updater Service', () => {
    let helper: LaunchJsonUpdaterServiceHelper;
    let getWorkspaceFolderStub: sinon.SinonStub;
    let getActiveTextEditorStub: sinon.SinonStub;
    let applyEditStub: sinon.SinonStub;
    let executeCommandStub: sinon.SinonStub;
    let debugConfigService: IDebugConfigurationService;

    const sandbox = sinon.createSandbox();
    setup(() => {
        getWorkspaceFolderStub = sinon.stub(workspaceApis, 'getWorkspaceFolder');
        getActiveTextEditorStub = sinon.stub(windowApis, 'getActiveTextEditor');
        applyEditStub = sinon.stub(workspaceApis, 'applyEdit');
        executeCommandStub = sinon.stub(commandApis, 'executeCommand');

        debugConfigService = mock(PythonDebugConfigurationService);
        sandbox.stub(LaunchJsonUpdaterServiceHelper, 'isCommaImmediatelyBeforeCursor').returns(false);
        helper = new LaunchJsonUpdaterServiceHelper(instance(debugConfigService));
    });
    teardown(() => {
        sandbox.restore();
        sinon.restore();
    });

    test('Configuration Array is detected as being empty', async () => {
        const document = typemoq.Mock.ofType<TextDocument>();
        const config: LaunchJsonSchema = {
            version: '',
            configurations: [],
        };
        document.setup((doc) => doc.getText(typemoq.It.isAny())).returns(() => JSON.stringify(config));

        const isEmpty = LaunchJsonUpdaterServiceHelper.isConfigurationArrayEmpty(document.object);
        assert.strictEqual(isEmpty, true);
    });
    test('Configuration Array is not empty', async () => {
        const document = typemoq.Mock.ofType<TextDocument>();
        const config: LaunchJsonSchema = {
            version: '',
            configurations: [
                {
                    name: '',
                    request: 'launch',
                    type: 'python',
                },
            ],
        };
        document.setup((doc) => doc.getText(typemoq.It.isAny())).returns(() => JSON.stringify(config));

        const isEmpty = LaunchJsonUpdaterServiceHelper.isConfigurationArrayEmpty(document.object);
        assert.strictEqual(isEmpty, false);
    });
    test('Cursor is not positioned in the configurations array', async () => {
        const document = typemoq.Mock.ofType<TextDocument>();
        const config: LaunchJsonSchema = {
            version: '',
            configurations: [
                {
                    name: '',
                    request: 'launch',
                    type: 'python',
                },
            ],
        };
        document.setup((doc) => doc.getText(typemoq.It.isAny())).returns(() => JSON.stringify(config));
        document.setup((doc) => doc.offsetAt(typemoq.It.isAny())).returns(() => 10);

        const cursorPosition = LaunchJsonUpdaterServiceHelper.getCursorPositionInConfigurationsArray(
            document.object,
            new Position(0, 0),
        );
        assert.strictEqual(cursorPosition, undefined);
    });
    test('Cursor is positioned in the empty configurations array', async () => {
        const document = typemoq.Mock.ofType<TextDocument>();
        const json = `{
        "version": "0.1.0",
        "configurations": [
            # Cursor Position
        ]
    }`;
        document.setup((doc) => doc.getText(typemoq.It.isAny())).returns(() => json);
        document.setup((doc) => doc.offsetAt(typemoq.It.isAny())).returns(() => json.indexOf('#'));

        const cursorPosition = LaunchJsonUpdaterServiceHelper.getCursorPositionInConfigurationsArray(
            document.object,
            new Position(0, 0),
        );
        assert.strictEqual(cursorPosition, 'InsideEmptyArray');
    });
    test('Cursor is positioned before an item in the configurations array', async () => {
        const document = typemoq.Mock.ofType<TextDocument>();
        const json = `{
    "version": "0.1.0",
    "configurations": [
        {
            "name":"wow"
        }
    ]
}`;
        document.setup((doc) => doc.getText(typemoq.It.isAny())).returns(() => json);
        document.setup((doc) => doc.offsetAt(typemoq.It.isAny())).returns(() => json.lastIndexOf('{') - 1);

        const cursorPosition = LaunchJsonUpdaterServiceHelper.getCursorPositionInConfigurationsArray(
            document.object,
            new Position(0, 0),
        );
        assert.strictEqual(cursorPosition, 'BeforeItem');
    });
    test('Cursor is positioned before an item in the middle of the configurations array', async () => {
        const document = typemoq.Mock.ofType<TextDocument>();
        const json = `{
    "version": "0.1.0",
    "configurations": [
        {
            "name":"wow"
        },{
            "name":"wow"
        }
    ]
}`;
        document.setup((doc) => doc.getText(typemoq.It.isAny())).returns(() => json);
        document.setup((doc) => doc.offsetAt(typemoq.It.isAny())).returns(() => json.indexOf(',{') + 1);

        const cursorPosition = LaunchJsonUpdaterServiceHelper.getCursorPositionInConfigurationsArray(
            document.object,
            new Position(0, 0),
        );
        assert.strictEqual(cursorPosition, 'BeforeItem');
    });
    test('Cursor is positioned after an item in the configurations array', async () => {
        const document = typemoq.Mock.ofType<TextDocument>();
        const json = `{
    "version": "0.1.0",
    "configurations": [
        {
            "name":"wow"
        }]
}`;
        document.setup((doc) => doc.getText(typemoq.It.isAny())).returns(() => json);
        document.setup((doc) => doc.offsetAt(typemoq.It.isAny())).returns(() => json.lastIndexOf('}]') + 1);

        const cursorPosition = LaunchJsonUpdaterServiceHelper.getCursorPositionInConfigurationsArray(
            document.object,
            new Position(0, 0),
        );
        assert.strictEqual(cursorPosition, 'AfterItem');
    });
    test('Cursor is positioned after an item in the middle of the configurations array', async () => {
        const document = typemoq.Mock.ofType<TextDocument>();
        const json = `{
    "version": "0.1.0",
    "configurations": [
        {
            "name":"wow"
        },{
            "name":"wow"
        }
    ]
}`;
        document.setup((doc) => doc.getText(typemoq.It.isAny())).returns(() => json);
        document.setup((doc) => doc.offsetAt(typemoq.It.isAny())).returns(() => json.indexOf('},') + 1);

        const cursorPosition = LaunchJsonUpdaterServiceHelper.getCursorPositionInConfigurationsArray(
            document.object,
            new Position(0, 0),
        );
        assert.strictEqual(cursorPosition, 'AfterItem');
    });
    test('Text to be inserted must be prefixed with a comma', async () => {
        const config = {} as DebugConfiguration;
        const expectedText = `,${JSON.stringify(config)}`;

        const textToInsert = LaunchJsonUpdaterServiceHelper.getTextForInsertion(config, 'AfterItem');

        assert.strictEqual(textToInsert, expectedText);
    });
    test('Text to be inserted must not be prefixed with a comma (as a comma already exists)', async () => {
        const config = {} as DebugConfiguration;
        const expectedText = JSON.stringify(config);

        const textToInsert = LaunchJsonUpdaterServiceHelper.getTextForInsertion(config, 'AfterItem', 'BeforeCursor');

        assert.strictEqual(textToInsert, expectedText);
    });
    test('Text to be inserted must be suffixed with a comma', async () => {
        const config = {} as DebugConfiguration;
        const expectedText = `${JSON.stringify(config)},`;

        const textToInsert = LaunchJsonUpdaterServiceHelper.getTextForInsertion(config, 'BeforeItem');

        assert.strictEqual(textToInsert, expectedText);
    });
    test('Text to be inserted must not be prefixed nor suffixed with commas', async () => {
        const config = {} as DebugConfiguration;
        const expectedText = JSON.stringify(config);

        const textToInsert = LaunchJsonUpdaterServiceHelper.getTextForInsertion(config, 'InsideEmptyArray');

        assert.strictEqual(textToInsert, expectedText);
    });
    test('When inserting the debug config into the json file format the document', async () => {
        const json = `{
            "version": "0.1.0",
            "configurations": [
                {
            "name":"wow"
        },{
            "name":"wow"
        }
    ]
}`;
        const config = {} as DebugConfiguration;
        const document = typemoq.Mock.ofType<TextDocument>();
        document.setup((doc) => doc.getText(typemoq.It.isAny())).returns(() => json);
        document.setup((doc) => doc.offsetAt(typemoq.It.isAny())).returns(() => json.indexOf('},') + 1);
        applyEditStub.returns(undefined);
        executeCommandStub.withArgs('editor.action.formatDocument').resolves();

        await LaunchJsonUpdaterServiceHelper.insertDebugConfiguration(document.object, new Position(0, 0), config);

        sinon.assert.calledOnce(applyEditStub);
        sinon.assert.calledOnce(executeCommandStub.withArgs('editor.action.formatDocument'));
    });
    test('No changes to configuration if there is not active document', async () => {
        const document = typemoq.Mock.ofType<TextDocument>();
        const position = new Position(0, 0);
        const { token } = new CancellationTokenSource();
        getActiveTextEditorStub.returns(undefined);
        let debugConfigInserted = false;
        LaunchJsonUpdaterServiceHelper.insertDebugConfiguration = async () => {
            debugConfigInserted = true;
        };

        await helper.selectAndInsertDebugConfig(document.object, position, token);

        sinon.assert.calledOnce(getActiveTextEditorStub);
        sinon.assert.notCalled(getWorkspaceFolderStub);
        assert.strictEqual(debugConfigInserted, false);
    });
    test('No changes to configuration if the active document is not same as the document passed in', async () => {
        const document = typemoq.Mock.ofType<TextDocument>();
        const position = new Position(0, 0);
        const { token } = new CancellationTokenSource();
        const textEditor = typemoq.Mock.ofType<TextEditor>();
        textEditor
            .setup((t) => t.document)
            .returns(() => ('x' as unknown) as TextDocument)
            .verifiable(typemoq.Times.atLeastOnce());
        getActiveTextEditorStub.returns(textEditor.object);
        let debugConfigInserted = false;
        LaunchJsonUpdaterServiceHelper.insertDebugConfiguration = async () => {
            debugConfigInserted = true;
        };

        await helper.selectAndInsertDebugConfig(document.object, position, token);

        sinon.assert.calledOnce(getActiveTextEditorStub);
        sinon.assert.notCalled(getWorkspaceFolderStub);
        textEditor.verifyAll();
        assert.strictEqual(debugConfigInserted, false);
    });
    test('No changes to configuration if cancellation token has been cancelled', async () => {
        const document = typemoq.Mock.ofType<TextDocument>();
        const position = new Position(0, 0);
        const tokenSource = new CancellationTokenSource();
        tokenSource.cancel();
        const { token } = tokenSource;
        const textEditor = typemoq.Mock.ofType<TextEditor>();
        const docUri = Uri.file(__filename);
        const folderUri = Uri.file('Folder Uri');
        const folder = { name: '', index: 0, uri: folderUri };
        document
            .setup((doc) => doc.uri)
            .returns(() => docUri)
            .verifiable(typemoq.Times.atLeastOnce());
        textEditor
            .setup((t) => t.document)
            .returns(() => document.object)
            .verifiable(typemoq.Times.atLeastOnce());
        getActiveTextEditorStub.returns(textEditor.object);
        getWorkspaceFolderStub.returns(folder);
        when(debugConfigService.provideDebugConfigurations!(folder, token)).thenResolve(([''] as unknown) as void);
        let debugConfigInserted = false;
        LaunchJsonUpdaterServiceHelper.insertDebugConfiguration = async () => {
            debugConfigInserted = true;
        };

        await helper.selectAndInsertDebugConfig(document.object, position, token);

        sinon.assert.calledOnce(getActiveTextEditorStub);
        sinon.assert.calledOnce(getWorkspaceFolderStub);
        textEditor.verifyAll();
        document.verifyAll();
        assert.strictEqual(debugConfigInserted, false);
    });
    test('No changes to configuration if no configuration items are returned', async () => {
        const document = typemoq.Mock.ofType<TextDocument>();
        const position = new Position(0, 0);
        const tokenSource = new CancellationTokenSource();
        const { token } = tokenSource;
        const textEditor = typemoq.Mock.ofType<TextEditor>();
        const docUri = Uri.file(__filename);
        const folderUri = Uri.file('Folder Uri');
        const folder = { name: '', index: 0, uri: folderUri };
        document
            .setup((doc) => doc.uri)
            .returns(() => docUri)
            .verifiable(typemoq.Times.atLeastOnce());
        textEditor
            .setup((t) => t.document)
            .returns(() => document.object)
            .verifiable(typemoq.Times.atLeastOnce());

        getActiveTextEditorStub.returns(textEditor.object);
        getWorkspaceFolderStub.returns(folder);

        when(debugConfigService.provideDebugConfigurations!(folder, token)).thenResolve(([] as unknown) as void);
        let debugConfigInserted = false;
        LaunchJsonUpdaterServiceHelper.insertDebugConfiguration = async () => {
            debugConfigInserted = true;
        };

        await helper.selectAndInsertDebugConfig(document.object, position, token);

        sinon.assert.calledOnce(getActiveTextEditorStub);
        sinon.assert.calledOnce(getWorkspaceFolderStub.withArgs(docUri));
        textEditor.verifyAll();
        document.verifyAll();
        assert.strictEqual(debugConfigInserted, false);
    });
    test('Changes are made to the configuration', async () => {
        const document = typemoq.Mock.ofType<TextDocument>();
        const position = new Position(0, 0);
        const tokenSource = new CancellationTokenSource();
        const { token } = tokenSource;
        const textEditor = typemoq.Mock.ofType<TextEditor>();
        const docUri = Uri.file(__filename);
        const folderUri = Uri.file('Folder Uri');
        const folder = { name: '', index: 0, uri: folderUri };
        document
            .setup((doc) => doc.uri)
            .returns(() => docUri)
            .verifiable(typemoq.Times.atLeastOnce());
        textEditor
            .setup((t) => t.document)
            .returns(() => document.object)
            .verifiable(typemoq.Times.atLeastOnce());
        getActiveTextEditorStub.returns(textEditor.object);
        getWorkspaceFolderStub.withArgs(docUri).returns(folder);
        when(debugConfigService.provideDebugConfigurations!(folder, token)).thenResolve(([
            'config',
        ] as unknown) as void);
        let debugConfigInserted = false;
        LaunchJsonUpdaterServiceHelper.insertDebugConfiguration = async () => {
            debugConfigInserted = true;
        };

        await helper.selectAndInsertDebugConfig(document.object, position, token);

        sinon.assert.called(getActiveTextEditorStub);
        sinon.assert.calledOnce(getWorkspaceFolderStub.withArgs(docUri));
        textEditor.verifyAll();
        document.verifyAll();
        assert.strictEqual(debugConfigInserted, true);
    });
    test('If cursor is at the begining of line 1 then there is no comma before cursor', async () => {
        sandbox.restore();
        const document = typemoq.Mock.ofType<TextDocument>();
        const position = new Position(1, 0);
        document
            .setup((doc) => doc.lineAt(1))
            .returns(() => ({ range: new Range(1, 0, 1, 1) } as TextLine))
            .verifiable(typemoq.Times.atLeastOnce());
        document
            .setup((doc) => doc.getText(typemoq.It.isAny()))
            .returns(() => '')
            .verifiable(typemoq.Times.atLeastOnce());

        const isBeforeCursor = LaunchJsonUpdaterServiceHelper.isCommaImmediatelyBeforeCursor(document.object, position);

        assert.ok(!isBeforeCursor);
        document.verifyAll();
    });
    test('If cursor is positioned after some text (not a comma) then detect this', async () => {
        sandbox.restore();
        const document = typemoq.Mock.ofType<TextDocument>();
        const position = new Position(2, 2);
        document
            .setup((doc) => doc.lineAt(2))
            .returns(() => ({ range: new Range(2, 0, 1, 5) } as TextLine))
            .verifiable(typemoq.Times.atLeastOnce());
        document
            .setup((doc) => doc.getText(typemoq.It.isAny()))
            .returns(() => 'Hello')
            .verifiable(typemoq.Times.atLeastOnce());

        const isBeforeCursor = LaunchJsonUpdaterServiceHelper.isCommaImmediatelyBeforeCursor(document.object, position);

        assert.ok(!isBeforeCursor);
        document.verifyAll();
    });
    test('If cursor is positioned after a comma then detect this', async () => {
        sandbox.restore();
        const document = typemoq.Mock.ofType<TextDocument>();
        const position = new Position(2, 2);
        document
            .setup((doc) => doc.lineAt(2))
            .returns(() => ({ range: new Range(2, 0, 2, 3) } as TextLine))
            .verifiable(typemoq.Times.atLeastOnce());
        document
            .setup((doc) => doc.getText(typemoq.It.isAny()))
            .returns(() => '}, ')
            .verifiable(typemoq.Times.atLeastOnce());

        const isBeforeCursor = LaunchJsonUpdaterServiceHelper.isCommaImmediatelyBeforeCursor(document.object, position);

        assert.ok(isBeforeCursor);
        document.verifyAll();
    });
    test('If cursor is positioned in an empty line and previous line ends with comma, then detect this', async () => {
        sandbox.restore();
        const document = typemoq.Mock.ofType<TextDocument>();
        const position = new Position(2, 2);
        document
            .setup((doc) => doc.lineAt(1))
            .returns(() => ({ range: new Range(1, 0, 1, 3), text: '}, ' } as TextLine))
            .verifiable(typemoq.Times.atLeastOnce());
        document
            .setup((doc) => doc.lineAt(2))
            .returns(() => ({ range: new Range(2, 0, 2, 3), text: '   ' } as TextLine))
            .verifiable(typemoq.Times.atLeastOnce());
        document
            .setup((doc) => doc.getText(typemoq.It.isAny()))
            .returns(() => '   ')
            .verifiable(typemoq.Times.atLeastOnce());

        const isBeforeCursor = LaunchJsonUpdaterServiceHelper.isCommaImmediatelyBeforeCursor(document.object, position);

        assert.ok(isBeforeCursor);
        document.verifyAll();
    });
    test('If cursor is positioned in an empty line and previous line does not end with comma, then detect this', async () => {
        sandbox.restore();
        const document = typemoq.Mock.ofType<TextDocument>();
        const position = new Position(2, 2);
        document
            .setup((doc) => doc.lineAt(1))
            .returns(() => ({ range: new Range(1, 0, 1, 3), text: '} ' } as TextLine))
            .verifiable(typemoq.Times.atLeastOnce());
        document
            .setup((doc) => doc.lineAt(2))
            .returns(() => ({ range: new Range(2, 0, 2, 3), text: '   ' } as TextLine))
            .verifiable(typemoq.Times.atLeastOnce());
        document
            .setup((doc) => doc.getText(typemoq.It.isAny()))
            .returns(() => '   ')
            .verifiable(typemoq.Times.atLeastOnce());

        const isBeforeCursor = LaunchJsonUpdaterServiceHelper.isCommaImmediatelyBeforeCursor(document.object, position);

        assert.ok(!isBeforeCursor);
        document.verifyAll();
    });
});
