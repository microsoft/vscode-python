// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-object-literal-type-assertion

import { expect } from 'chai';
import * as path from 'path';
import * as sinon from 'sinon';
import { anything, instance, mock, when } from 'ts-mockito';
import { CancellationToken, CancellationTokenSource, TextDocument, Uri } from 'vscode';
import { Product } from '../../client/common/types';
import { ServiceContainer } from '../../client/ioc/container';
import { parseLine } from '../../client/linters/baseLinter';
import { LinterManager } from '../../client/linters/linterManager';
import { MyPy, REGEX } from '../../client/linters/mypy';
import { ILinterManager, ILintMessage, LintMessageSeverity } from '../../client/linters/types';
import { MockOutputChannel } from '../mockClasses';

// This following is a real-world example. See gh=2380.
// tslint:disable:no-multiline-string no-any max-func-body-length
const output = `
provider.pyi:10: error: Incompatible types in assignment (expression has type "str", variable has type "int")
provider.pyi:11: error: Name 'not_declared_var' is not defined
provider.pyi:12:21: error: Expression has type "Any"
`;

suite('Linting - MyPy', () => {
    test('regex', async () => {
        const lines = output.split('\n');
        const tests: [string, ILintMessage][] = [
            [
                lines[1],
                {
                    code: undefined,
                    message: 'Incompatible types in assignment (expression has type "str", variable has type "int")',
                    column: 0,
                    line: 10,
                    type: 'error',
                    provider: 'mypy'
                } as ILintMessage
            ],
            [
                lines[2],
                {
                    code: undefined,
                    message: "Name 'not_declared_var' is not defined",
                    column: 0,
                    line: 11,
                    type: 'error',
                    provider: 'mypy'
                } as ILintMessage
            ],
            [
                lines[3],
                {
                    code: undefined,
                    message: 'Expression has type "Any"',
                    column: 21,
                    line: 12,
                    type: 'error',
                    provider: 'mypy'
                } as ILintMessage
            ]
        ];
        for (const [line, expected] of tests) {
            const msg = parseLine(line, REGEX, 'mypy');

            expect(msg).to.deep.equal(expected);
        }
    });
});

suite('Test Linter', () => {
    class TestMyPyLinter extends MyPy {
        // tslint:disable: no-unnecessary-override
        public async runLinter(document: TextDocument, cancellation: CancellationToken): Promise<ILintMessage[]> {
            return super.runLinter(document, cancellation);
        }
        public getWorkspaceRootPath(document: TextDocument): string {
            return super.getWorkspaceRootPath(document);
        }
        public async run(args: string[], document: TextDocument, cancellation: CancellationToken, regEx: string = REGEX): Promise<ILintMessage[]> {
            return super.run(args, document, cancellation, regEx);
        }
        public parseMessagesSeverity(error: string, severity: any): LintMessageSeverity {
            return super.parseMessagesSeverity(error, severity);
        }
    }

    let linter: TestMyPyLinter;
    let getWorkspaceRootPathStub: sinon.SinonStub<[TextDocument], string>;
    let runStub: sinon.SinonStub<[string[], TextDocument, CancellationToken, (string | undefined)?], Promise<ILintMessage[]>>;
    const token = new CancellationTokenSource().token;
    teardown(() => sinon.restore());
    setup(() => {
        const linterManager = mock(LinterManager);
        when(linterManager.getLinterInfo(anything())).thenReturn({ product: Product.mypy } as any);
        const serviceContainer = mock(ServiceContainer);
        when(serviceContainer.get<ILinterManager>(ILinterManager)).thenReturn(instance(linterManager));
        getWorkspaceRootPathStub = sinon.stub(TestMyPyLinter.prototype, 'getWorkspaceRootPath');
        runStub = sinon.stub(TestMyPyLinter.prototype, 'run');
        linter = new TestMyPyLinter(instance(mock(MockOutputChannel)), instance(serviceContainer));
    });

    test('Get cwd based on document', async () => {
        const fileUri = Uri.file(path.join('a', 'b', 'c', 'd', 'e', 'filename.py'));
        const cwd = path.join('a', 'b', 'c');
        const doc = ({ uri: fileUri } as any) as TextDocument;
        getWorkspaceRootPathStub.callsFake(() => cwd);
        runStub.callsFake(() => Promise.resolve([]));

        await linter.runLinter(doc, token);

        expect(getWorkspaceRootPathStub.callCount).to.equal(1);
        expect(getWorkspaceRootPathStub.args[0]).to.deep.equal([doc]);
    });
    test('Pass relative path of document to linter', async () => {
        const fileUri = Uri.file(path.join('a', 'b', 'c', 'd', 'e', 'filename.py'));
        const cwd = path.join('a', 'b', 'c');
        const doc = ({ uri: fileUri } as any) as TextDocument;
        getWorkspaceRootPathStub.callsFake(() => cwd);
        runStub.callsFake(() => Promise.resolve([]));

        await linter.runLinter(doc, token);

        expect(runStub.callCount).to.equal(1);
        expect(runStub.args[0]).to.deep.equal([[path.relative(cwd, fileUri.fsPath)], doc, token, REGEX]);
    });
    test('Return empty messages', async () => {
        const fileUri = Uri.file(path.join('a', 'b', 'c', 'd', 'e', 'filename.py'));
        const cwd = path.join('a', 'b', 'c');
        const doc = ({ uri: fileUri } as any) as TextDocument;
        getWorkspaceRootPathStub.callsFake(() => cwd);
        runStub.callsFake(() => Promise.resolve([]));

        const messages = await linter.runLinter(doc, token);

        expect(messages).to.be.deep.equal([]);
    });
});
