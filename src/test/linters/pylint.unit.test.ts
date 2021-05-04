// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { assert } from 'chai';
import * as sinon from 'sinon';
import { mock } from 'ts-mockito';
import * as TypeMoq from 'typemoq';
import * as vscode from 'vscode';
import { IWorkspaceService } from '../../client/common/application/types';
import { IFileSystem, IPlatformService } from '../../client/common/platform/types';
import { IConfigurationService, IOutputChannel } from '../../client/common/types';
import { IServiceContainer } from '../../client/ioc/types';
import { Pylint } from '../../client/linters/pylint';
import { ILinterInfo, ILinterManager, ILintMessage, LintMessageSeverity } from '../../client/linters/types';

suite('Pylint - Function runLinter()', () => {
    let fileSystem: TypeMoq.IMock<IFileSystem>;
    let serviceContainer: TypeMoq.IMock<IServiceContainer>;
    let workspaceService: TypeMoq.IMock<IWorkspaceService>;
    let configService: TypeMoq.IMock<IConfigurationService>;
    let manager: TypeMoq.IMock<ILinterManager>;
    let output: TypeMoq.IMock<IOutputChannel>;
    let _info: TypeMoq.IMock<ILinterInfo>;
    let platformService: TypeMoq.IMock<IPlatformService>;
    let run: sinon.SinonStub<any>;
    let parseMessagesSeverity: sinon.SinonStub<any>;
    const doc = {
        uri: vscode.Uri.file('path/to/doc'),
    };
    const args = [
        "--msg-template='{line},{column},{category},{symbol}:{msg}'",
        '--reports=n',
        '--output-format=text',
        doc.uri.fsPath,
    ];
    class PylintTest extends Pylint {
        public async run(
            _args: string[],
            _document: vscode.TextDocument,
            _cancellation: vscode.CancellationToken,
            _regEx: string,
        ): Promise<ILintMessage[]> {
            return [];
        }
        public parseMessagesSeverity(_error: string, _categorySeverity: any): LintMessageSeverity {
            return 'Severity' as any;
        }
        public get info(): ILinterInfo {
            return _info.object;
        }

        public async runLinter(
            document: vscode.TextDocument,
            cancellation: vscode.CancellationToken,
        ): Promise<ILintMessage[]> {
            return super.runLinter(document, cancellation);
        }
        public getWorkingDirectoryPath(_document: vscode.TextDocument): string {
            return 'path/to/workspaceRoot';
        }
    }

    setup(() => {
        platformService = TypeMoq.Mock.ofType<IPlatformService>();
        _info = TypeMoq.Mock.ofType<ILinterInfo>();
        output = TypeMoq.Mock.ofType<IOutputChannel>();
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
        manager.setup((m) => m.getLinterInfo(TypeMoq.It.isAny())).returns(() => undefined as any);
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
        configService.setup((c) => c.getSettings(doc.uri)).returns(() => settings as any);
        _info.setup((info) => info.linterArgs(doc.uri)).returns(() => []);
        run = sinon.stub(PylintTest.prototype, 'run');
        run.callsFake(() => Promise.resolve([]));
        parseMessagesSeverity = sinon.stub(PylintTest.prototype, 'parseMessagesSeverity');
        parseMessagesSeverity.callsFake(() => 'Severity');
        const pylint = new PylintTest(output.object, serviceContainer.object);
        await pylint.runLinter(doc as any, mock(vscode.CancellationTokenSource).token);
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
        configService.setup((c) => c.getSettings(doc.uri)).returns(() => settings as any);
        _info.setup((info) => info.linterArgs(doc.uri)).returns(() => []);
        run = sinon.stub(PylintTest.prototype, 'run');
        run.callsFake(() => Promise.resolve(message as any));
        parseMessagesSeverity = sinon.stub(PylintTest.prototype, 'parseMessagesSeverity');
        parseMessagesSeverity.callsFake(() => 'LintMessageSeverity');
        const pylint = new PylintTest(output.object, serviceContainer.object);
        const result = await pylint.runLinter(doc as any, mock(vscode.CancellationTokenSource).token);
        assert.deepEqual(result, expectedResult as any);
        assert.ok(parseMessagesSeverity.calledOnce);
        assert.ok(run.calledOnce);
    });
});
