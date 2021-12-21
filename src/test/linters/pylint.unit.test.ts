// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { assert } from 'chai';
import * as sinon from 'sinon';
import { mock } from 'ts-mockito';
import * as TypeMoq from 'typemoq';
import * as vscode from 'vscode';
import { IWorkspaceService } from '../../client/common/application/types';
import { IFileSystem, IPlatformService } from '../../client/common/platform/types';
import { IConfigurationService, IPythonSettings } from '../../client/common/types';
import { IServiceContainer } from '../../client/ioc/types';
import { Pylint } from '../../client/linters/pylint';
import { ILinterInfo, ILinterManager, ILintMessage, LinterId, LintMessageSeverity } from '../../client/linters/types';

suite('Pylint - Function runLinter()', () => {
    let fileSystem: TypeMoq.IMock<IFileSystem>;
    let serviceContainer: TypeMoq.IMock<IServiceContainer>;
    let workspaceService: TypeMoq.IMock<IWorkspaceService>;
    let configService: TypeMoq.IMock<IConfigurationService>;
    let manager: TypeMoq.IMock<ILinterManager>;
    let _info: TypeMoq.IMock<ILinterInfo>;
    let platformService: TypeMoq.IMock<IPlatformService>;
    let run: sinon.SinonStub;
    let parseMessagesSeverity: sinon.SinonStub;
    const doc = {
        uri: vscode.Uri.file('path/to/doc'),
    };
    const args = ['--reports=n', '--output-format=json', doc.uri.fsPath];
    class PylintTest extends Pylint {
        // eslint-disable-next-line class-methods-use-this
        public async run(
            _args: string[],
            _document: vscode.TextDocument,
            _cancellation: vscode.CancellationToken,
            _regEx: string,
        ): Promise<ILintMessage[]> {
            return [];
        }

        // eslint-disable-next-line class-methods-use-this
        public parseMessagesSeverity(_error: string, _categorySeverity: unknown): LintMessageSeverity {
            return ('Severity' as unknown) as LintMessageSeverity;
        }

        // eslint-disable-next-line class-methods-use-this
        public get info(): ILinterInfo {
            return _info.object;
        }

        public async runLinter(
            document: vscode.TextDocument,
            cancellation: vscode.CancellationToken,
        ): Promise<ILintMessage[]> {
            return super.runLinter(document, cancellation);
        }

        // eslint-disable-next-line class-methods-use-this
        public getWorkingDirectoryPath(_document: vscode.TextDocument): string {
            return 'path/to/workspaceRoot';
        }

        public async parseMessages(
            output: string,
            _document: vscode.TextDocument,
            _token: vscode.CancellationToken,
        ): Promise<ILintMessage[]> {
            return super.parseMessages(output, _document, _token, '');
        }
    }

    setup(() => {
        platformService = TypeMoq.Mock.ofType<IPlatformService>();
        _info = TypeMoq.Mock.ofType<ILinterInfo>();
        serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
        workspaceService = TypeMoq.Mock.ofType<IWorkspaceService>();
        configService = TypeMoq.Mock.ofType<IConfigurationService>();
        manager = TypeMoq.Mock.ofType<ILinterManager>();
        serviceContainer.setup((c) => c.get(TypeMoq.It.isValue(ILinterManager))).returns(() => manager.object);
        serviceContainer
            .setup((c) => c.get(TypeMoq.It.isValue(IConfigurationService)))
            .returns(() => configService.object);
        serviceContainer
            .setup((c) => c.get(TypeMoq.It.isValue(IWorkspaceService)))
            .returns(() => workspaceService.object);
        serviceContainer.setup((c) => c.get(TypeMoq.It.isValue(IFileSystem))).returns(() => fileSystem.object);
        serviceContainer
            .setup((c) => c.get(TypeMoq.It.isValue(IPlatformService)))
            .returns(() => platformService.object);
        fileSystem = TypeMoq.Mock.ofType<IFileSystem>();
        fileSystem
            .setup((x) => x.arePathsSame(TypeMoq.It.isAnyString(), TypeMoq.It.isAnyString()))
            .returns((a, b) => a === b);
        manager.setup((m) => m.getLinterInfo(TypeMoq.It.isAny())).returns(() => (undefined as unknown) as ILinterInfo);
        _info.setup((x) => x.id).returns(() => LinterId.PyLint);
    });

    teardown(() => {
        sinon.restore();
    });

    test('Test pylint with default settings.', async () => {
        const settings = {
            linting: {
                pylintEnabled: true,
            },
        };
        configService.setup((c) => c.getSettings(doc.uri)).returns(() => settings as IPythonSettings);
        _info.setup((info) => info.linterArgs(doc.uri)).returns(() => []);
        run = sinon.stub(PylintTest.prototype, 'run');
        run.callsFake(() => Promise.resolve([]));
        parseMessagesSeverity = sinon.stub(PylintTest.prototype, 'parseMessagesSeverity');
        parseMessagesSeverity.callsFake(() => 'Severity');
        const pylint = new PylintTest(serviceContainer.object);
        await pylint.runLinter(doc as vscode.TextDocument, mock(vscode.CancellationTokenSource).token);
        assert.deepEqual(run.args[0][0], args);
        assert.ok(parseMessagesSeverity.notCalled);
        assert.ok(run.calledOnce);
    });

    test('Message returned by runLinter() is as expected', async () => {
        const message = [
            {
                type: 'messageType',
            },
        ];
        const expectedResult = [
            {
                type: 'messageType',
                severity: 'LintMessageSeverity',
            },
        ];
        const settings = {
            linting: {
                pylintEnabled: true,
            },
        };
        configService.setup((c) => c.getSettings(doc.uri)).returns(() => settings as IPythonSettings);
        _info.setup((info) => info.linterArgs(doc.uri)).returns(() => []);
        run = sinon.stub(PylintTest.prototype, 'run');
        run.callsFake(() => Promise.resolve(message));
        parseMessagesSeverity = sinon.stub(PylintTest.prototype, 'parseMessagesSeverity');
        parseMessagesSeverity.callsFake(() => 'LintMessageSeverity');
        const pylint = new PylintTest(serviceContainer.object);
        const result = await pylint.runLinter(doc as vscode.TextDocument, mock(vscode.CancellationTokenSource).token);
        assert.deepEqual(result, (expectedResult as unknown) as ILintMessage[]);
        assert.ok(parseMessagesSeverity.calledOnce);
        assert.ok(run.calledOnce);
    });

    test('Parse json output', async () => {
        // If 'endLine' and 'endColumn' are missing in JSON output,
        // both should be set to 'undefined'
        const jsonOutput = `[
    {
        "type": "error",
        "module": "file",
        "obj": "Foo.meth3",
        "line": 26,
        "column": 15,
        "path": "file.py",
        "symbol": "no-member",
        "message": "Instance of 'Foo' has no 'blop' member",
        "message-id": "E1101"
    }
]`;
        const expectedMessages: ILintMessage[] = [
            {
                code: 'no-member',
                message: "Instance of 'Foo' has no 'blop' member",
                column: 15,
                line: 26,
                type: 'error',
                provider: LinterId.PyLint,
                endLine: undefined,
                endColumn: undefined,
            },
        ];
        const settings = {
            linting: {
                pylintEnabled: true,
            },
        };
        configService.setup((c) => c.getSettings(doc.uri)).returns(() => settings as IPythonSettings);
        const pylint = new PylintTest(serviceContainer.object);
        const result = await pylint.parseMessages(
            jsonOutput,
            doc as vscode.TextDocument,
            mock(vscode.CancellationTokenSource).token,
        );
        assert.deepEqual(result, expectedMessages);
    });

    test('Parse json output with endLine', async () => {
        const jsonOutput = `[
    {
        "type": "error",
        "module": "file",
        "obj": "Foo.meth3",
        "line": 26,
        "column": 15,
        "endLine": 26,
        "endColumn": 24,
        "path": "file.py",
        "symbol": "no-member",
        "message": "Instance of 'Foo' has no 'blop' member",
        "message-id": "E1101"
    }
]`;
        const expectedMessages: ILintMessage[] = [
            {
                code: 'no-member',
                message: "Instance of 'Foo' has no 'blop' member",
                column: 15,
                line: 26,
                type: 'error',
                provider: LinterId.PyLint,
                endLine: 26,
                endColumn: 24,
            },
        ];
        const settings = {
            linting: {
                pylintEnabled: true,
            },
        };
        configService.setup((c) => c.getSettings(doc.uri)).returns(() => settings as IPythonSettings);
        const pylint = new PylintTest(serviceContainer.object);
        const result = await pylint.parseMessages(
            jsonOutput,
            doc as vscode.TextDocument,
            mock(vscode.CancellationTokenSource).token,
        );
        assert.deepEqual(result, expectedMessages);
    });

    test('Parse json output with unknown endLine', async () => {
        // If 'endLine' and 'endColumn' are present in JSON output
        // but 'null', 'endLine' should be set to 'undefined'.
        // 'endColumn' defaults to 0.
        const jsonOutput = `[
    {
        "type": "error",
        "module": "file",
        "obj": "Foo.meth3",
        "line": 26,
        "column": 15,
        "endLine": null,
        "endColumn": null,
        "path": "file.py",
        "symbol": "no-member",
        "message": "Instance of 'Foo' has no 'blop' member",
        "message-id": "E1101"
    }
]`;
        const expectedMessages: ILintMessage[] = [
            {
                code: 'no-member',
                message: "Instance of 'Foo' has no 'blop' member",
                column: 15,
                line: 26,
                type: 'error',
                provider: LinterId.PyLint,
                endLine: undefined,
                endColumn: undefined,
            },
        ];
        const settings = {
            linting: {
                pylintEnabled: true,
            },
        };
        configService.setup((c) => c.getSettings(doc.uri)).returns(() => settings as IPythonSettings);
        const pylint = new PylintTest(serviceContainer.object);
        const result = await pylint.parseMessages(
            jsonOutput,
            doc as vscode.TextDocument,
            mock(vscode.CancellationTokenSource).token,
        );
        assert.deepEqual(result, expectedMessages);
    });
});
