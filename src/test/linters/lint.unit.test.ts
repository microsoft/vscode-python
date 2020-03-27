// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import * as assert from 'assert';
import * as os from 'os';
import * as TypeMoq from 'typemoq';
import { CancellationTokenSource, TextDocument, TextLine } from 'vscode';
import { Product } from '../../client/common/installer/productInstaller';
import { ProductNames } from '../../client/common/installer/productNames';
import { ProductService } from '../../client/common/installer/productService';
import { IFileSystem, IPlatformService } from '../../client/common/platform/types';
import {
    IPythonExecutionFactory,
    IPythonExecutionService,
    IPythonToolExecutionService,
} from '../../client/common/process/types';
import { ProductType } from '../../client/common/types';
import { LINTERID_BY_PRODUCT } from '../../client/linters/constants';
import { ILintMessage, LintMessageSeverity } from '../../client/linters/types';
import { BaseTestFixture, getLinterID, getProductName, linterMessageAsLine, throwUnknownProduct } from './common';

const pylintMessagesToBeReturned: ILintMessage[] = [
    {
        line: 24,
        column: 0,
        severity: LintMessageSeverity.Information,
        code: 'I0011',
        message: 'Locally disabling no-member (E1101)',
        provider: '',
        type: 'warning',
    },
    {
        line: 30,
        column: 0,
        severity: LintMessageSeverity.Information,
        code: 'I0011',
        message: 'Locally disabling no-member (E1101)',
        provider: '',
        type: 'warning',
    },
    {
        line: 34,
        column: 0,
        severity: LintMessageSeverity.Information,
        code: 'I0012',
        message: 'Locally enabling no-member (E1101)',
        provider: '',
        type: 'warning',
    },
    {
        line: 40,
        column: 0,
        severity: LintMessageSeverity.Information,
        code: 'I0011',
        message: 'Locally disabling no-member (E1101)',
        provider: '',
        type: 'warning',
    },
    {
        line: 44,
        column: 0,
        severity: LintMessageSeverity.Information,
        code: 'I0012',
        message: 'Locally enabling no-member (E1101)',
        provider: '',
        type: 'warning',
    },
    {
        line: 55,
        column: 0,
        severity: LintMessageSeverity.Information,
        code: 'I0011',
        message: 'Locally disabling no-member (E1101)',
        provider: '',
        type: 'warning',
    },
    {
        line: 59,
        column: 0,
        severity: LintMessageSeverity.Information,
        code: 'I0012',
        message: 'Locally enabling no-member (E1101)',
        provider: '',
        type: 'warning',
    },
    {
        line: 62,
        column: 0,
        severity: LintMessageSeverity.Information,
        code: 'I0011',
        message: 'Locally disabling undefined-variable (E0602)',
        provider: '',
        type: 'warning',
    },
    {
        line: 70,
        column: 0,
        severity: LintMessageSeverity.Information,
        code: 'I0011',
        message: 'Locally disabling no-member (E1101)',
        provider: '',
        type: 'warning',
    },
    {
        line: 84,
        column: 0,
        severity: LintMessageSeverity.Information,
        code: 'I0011',
        message: 'Locally disabling no-member (E1101)',
        provider: '',
        type: 'warning',
    },
    {
        line: 87,
        column: 0,
        severity: LintMessageSeverity.Hint,
        code: 'C0304',
        message: 'Final newline missing',
        provider: '',
        type: 'warning',
    },
    {
        line: 11,
        column: 20,
        severity: LintMessageSeverity.Warning,
        code: 'W0613',
        message: "Unused argument 'arg'",
        provider: '',
        type: 'warning',
    },
    {
        line: 26,
        column: 14,
        severity: LintMessageSeverity.Error,
        code: 'E1101',
        message: "Instance of 'Foo' has no 'blop' member",
        provider: '',
        type: 'warning',
    },
    {
        line: 36,
        column: 14,
        severity: LintMessageSeverity.Error,
        code: 'E1101',
        message: "Instance of 'Foo' has no 'blip' member",
        provider: '',
        type: 'warning',
    },
    {
        line: 46,
        column: 18,
        severity: LintMessageSeverity.Error,
        code: 'E1101',
        message: "Instance of 'Foo' has no 'blip' member",
        provider: '',
        type: 'warning',
    },
    {
        line: 61,
        column: 18,
        severity: LintMessageSeverity.Error,
        code: 'E1101',
        message: "Instance of 'Foo' has no 'blip' member",
        provider: '',
        type: 'warning',
    },
    {
        line: 72,
        column: 18,
        severity: LintMessageSeverity.Error,
        code: 'E1101',
        message: "Instance of 'Foo' has no 'blip' member",
        provider: '',
        type: 'warning',
    },
    {
        line: 75,
        column: 18,
        severity: LintMessageSeverity.Error,
        code: 'E1101',
        message: "Instance of 'Foo' has no 'blip' member",
        provider: '',
        type: 'warning',
    },
    {
        line: 77,
        column: 14,
        severity: LintMessageSeverity.Error,
        code: 'E1101',
        message: "Instance of 'Foo' has no 'blip' member",
        provider: '',
        type: 'warning',
    },
    {
        line: 83,
        column: 14,
        severity: LintMessageSeverity.Error,
        code: 'E1101',
        message: "Instance of 'Foo' has no 'blip' member",
        provider: '',
        type: 'warning',
    },
];
const flake8MessagesToBeReturned: ILintMessage[] = [
    {
        line: 5,
        column: 1,
        severity: LintMessageSeverity.Error,
        code: 'E302',
        message: 'expected 2 blank lines, found 1',
        provider: '',
        type: 'E',
    },
    {
        line: 19,
        column: 15,
        severity: LintMessageSeverity.Error,
        code: 'E127',
        message: 'continuation line over-indented for visual indent',
        provider: '',
        type: 'E',
    },
    {
        line: 24,
        column: 23,
        severity: LintMessageSeverity.Error,
        code: 'E261',
        message: 'at least two spaces before inline comment',
        provider: '',
        type: 'E',
    },
    {
        line: 62,
        column: 30,
        severity: LintMessageSeverity.Error,
        code: 'E261',
        message: 'at least two spaces before inline comment',
        provider: '',
        type: 'E',
    },
    {
        line: 70,
        column: 22,
        severity: LintMessageSeverity.Error,
        code: 'E261',
        message: 'at least two spaces before inline comment',
        provider: '',
        type: 'E',
    },
    {
        line: 80,
        column: 5,
        severity: LintMessageSeverity.Error,
        code: 'E303',
        message: 'too many blank lines (2)',
        provider: '',
        type: 'E',
    },
    {
        line: 87,
        column: 24,
        severity: LintMessageSeverity.Warning,
        code: 'W292',
        message: 'no newline at end of file',
        provider: '',
        type: 'E',
    },
];
const pycodestyleMessagesToBeReturned: ILintMessage[] = [
    {
        line: 5,
        column: 1,
        severity: LintMessageSeverity.Error,
        code: 'E302',
        message: 'expected 2 blank lines, found 1',
        provider: '',
        type: 'E',
    },
    {
        line: 19,
        column: 15,
        severity: LintMessageSeverity.Error,
        code: 'E127',
        message: 'continuation line over-indented for visual indent',
        provider: '',
        type: 'E',
    },
    {
        line: 24,
        column: 23,
        severity: LintMessageSeverity.Error,
        code: 'E261',
        message: 'at least two spaces before inline comment',
        provider: '',
        type: 'E',
    },
    {
        line: 62,
        column: 30,
        severity: LintMessageSeverity.Error,
        code: 'E261',
        message: 'at least two spaces before inline comment',
        provider: '',
        type: 'E',
    },
    {
        line: 70,
        column: 22,
        severity: LintMessageSeverity.Error,
        code: 'E261',
        message: 'at least two spaces before inline comment',
        provider: '',
        type: 'E',
    },
    {
        line: 80,
        column: 5,
        severity: LintMessageSeverity.Error,
        code: 'E303',
        message: 'too many blank lines (2)',
        provider: '',
        type: 'E',
    },
    {
        line: 87,
        column: 24,
        severity: LintMessageSeverity.Warning,
        code: 'W292',
        message: 'no newline at end of file',
        provider: '',
        type: 'E',
    },
];
const pydocstyleMessagesToBeReturned: ILintMessage[] = [
    {
        code: 'D400',
        severity: LintMessageSeverity.Information,
        message: "First line should end with a period (not 'e')",
        column: 0,
        line: 1,
        type: '',
        provider: 'pydocstyle',
    },
    {
        code: 'D400',
        severity: LintMessageSeverity.Information,
        message: "First line should end with a period (not 't')",
        column: 0,
        line: 5,
        type: '',
        provider: 'pydocstyle',
    },
    {
        code: 'D102',
        severity: LintMessageSeverity.Information,
        message: 'Missing docstring in public method',
        column: 4,
        line: 8,
        type: '',
        provider: 'pydocstyle',
    },
    {
        code: 'D401',
        severity: LintMessageSeverity.Information,
        message: "First line should be in imperative mood ('thi', not 'this')",
        column: 4,
        line: 11,
        type: '',
        provider: 'pydocstyle',
    },
    {
        code: 'D403',
        severity: LintMessageSeverity.Information,
        message: "First word of the first line should be properly capitalized ('This', not 'this')",
        column: 4,
        line: 11,
        type: '',
        provider: 'pydocstyle',
    },
    {
        code: 'D400',
        severity: LintMessageSeverity.Information,
        message: "First line should end with a period (not 'e')",
        column: 4,
        line: 11,
        type: '',
        provider: 'pydocstyle',
    },
    {
        code: 'D403',
        severity: LintMessageSeverity.Information,
        message: "First word of the first line should be properly capitalized ('And', not 'and')",
        column: 4,
        line: 15,
        type: '',
        provider: 'pydocstyle',
    },
    {
        code: 'D400',
        severity: LintMessageSeverity.Information,
        message: "First line should end with a period (not 't')",
        column: 4,
        line: 15,
        type: '',
        provider: 'pydocstyle',
    },
    {
        code: 'D403',
        severity: LintMessageSeverity.Information,
        message: "First word of the first line should be properly capitalized ('Test', not 'test')",
        column: 4,
        line: 21,
        type: '',
        provider: 'pydocstyle',
    },
    {
        code: 'D400',
        severity: LintMessageSeverity.Information,
        message: "First line should end with a period (not 'g')",
        column: 4,
        line: 21,
        type: '',
        provider: 'pydocstyle',
    },
    {
        code: 'D403',
        severity: LintMessageSeverity.Information,
        message: "First word of the first line should be properly capitalized ('Test', not 'test')",
        column: 4,
        line: 28,
        type: '',
        provider: 'pydocstyle',
    },
    {
        code: 'D400',
        severity: LintMessageSeverity.Information,
        message: "First line should end with a period (not 'g')",
        column: 4,
        line: 28,
        type: '',
        provider: 'pydocstyle',
    },
    {
        code: 'D403',
        severity: LintMessageSeverity.Information,
        message: "First word of the first line should be properly capitalized ('Test', not 'test')",
        column: 4,
        line: 38,
        type: '',
        provider: 'pydocstyle',
    },
    {
        code: 'D400',
        severity: LintMessageSeverity.Information,
        message: "First line should end with a period (not 'g')",
        column: 4,
        line: 38,
        type: '',
        provider: 'pydocstyle',
    },
    {
        code: 'D403',
        severity: LintMessageSeverity.Information,
        message: "First word of the first line should be properly capitalized ('Test', not 'test')",
        column: 4,
        line: 53,
        type: '',
        provider: 'pydocstyle',
    },
    {
        code: 'D400',
        severity: LintMessageSeverity.Information,
        message: "First line should end with a period (not 'g')",
        column: 4,
        line: 53,
        type: '',
        provider: 'pydocstyle',
    },
    {
        code: 'D403',
        severity: LintMessageSeverity.Information,
        message: "First word of the first line should be properly capitalized ('Test', not 'test')",
        column: 4,
        line: 68,
        type: '',
        provider: 'pydocstyle',
    },
    {
        code: 'D400',
        severity: LintMessageSeverity.Information,
        message: "First line should end with a period (not 'g')",
        column: 4,
        line: 68,
        type: '',
        provider: 'pydocstyle',
    },
    {
        code: 'D403',
        severity: LintMessageSeverity.Information,
        message: "First word of the first line should be properly capitalized ('Test', not 'test')",
        column: 4,
        line: 80,
        type: '',
        provider: 'pydocstyle',
    },
    {
        code: 'D400',
        severity: LintMessageSeverity.Information,
        message: "First line should end with a period (not 'g')",
        column: 4,
        line: 80,
        type: '',
        provider: 'pydocstyle',
    },
];

class TestFixture extends BaseTestFixture {
    public platformService: TypeMoq.IMock<IPlatformService>;
    public filesystem: TypeMoq.IMock<IFileSystem>;
    public pythonToolExecService: TypeMoq.IMock<IPythonToolExecutionService>;
    public pythonExecService: TypeMoq.IMock<IPythonExecutionService>;
    public pythonExecFactory: TypeMoq.IMock<IPythonExecutionFactory>;

    constructor(workspaceDir = '.', printLogs = false) {
        const platformService = TypeMoq.Mock.ofType<IPlatformService>(undefined, TypeMoq.MockBehavior.Strict);
        const filesystem = TypeMoq.Mock.ofType<IFileSystem>(undefined, TypeMoq.MockBehavior.Strict);
        const pythonToolExecService = TypeMoq.Mock.ofType<IPythonToolExecutionService>(
            undefined,
            TypeMoq.MockBehavior.Strict
        );
        const pythonExecFactory = TypeMoq.Mock.ofType<IPythonExecutionFactory>(undefined, TypeMoq.MockBehavior.Strict);
        super(
            platformService.object,
            filesystem.object,
            pythonToolExecService.object,
            pythonExecFactory.object,
            undefined,
            undefined,
            true,
            workspaceDir,
            printLogs
        );

        this.platformService = platformService;
        this.filesystem = filesystem;
        this.pythonToolExecService = pythonToolExecService;
        this.pythonExecService = TypeMoq.Mock.ofType<IPythonExecutionService>(undefined, TypeMoq.MockBehavior.Strict);
        this.pythonExecFactory = pythonExecFactory;

        this.filesystem.setup((f) => f.fileExists(TypeMoq.It.isAny())).returns(() => Promise.resolve(true));

        // tslint:disable-next-line:no-any
        this.pythonExecService.setup((s: any) => s.then).returns(() => undefined);
        this.pythonExecService
            .setup((s) => s.isModuleInstalled(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(true));

        this.pythonExecFactory
            .setup((f) => f.create(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(this.pythonExecService.object));
    }

    public makeDocument(product: Product, filename: string): TextDocument {
        const doc = this.newMockDocument(filename);
        if (product === Product.pydocstyle) {
            const dummyLine = TypeMoq.Mock.ofType<TextLine>(undefined, TypeMoq.MockBehavior.Strict);
            dummyLine.setup((d) => d.text).returns(() => '    ...');
            doc.setup((s) => s.lineAt(TypeMoq.It.isAny())).returns(() => dummyLine.object);
        }
        return doc.object;
    }

    public setDefaultMessages(product: Product): ILintMessage[] {
        let messages: ILintMessage[];
        switch (product) {
            case Product.pylint: {
                messages = pylintMessagesToBeReturned;
                break;
            }
            case Product.flake8: {
                messages = flake8MessagesToBeReturned;
                break;
            }
            case Product.pycodestyle: {
                messages = pycodestyleMessagesToBeReturned;
                break;
            }
            case Product.pydocstyle: {
                messages = pydocstyleMessagesToBeReturned;
                break;
            }
            default: {
                throwUnknownProduct(product);
                return []; // to quiet tslint
            }
        }
        this.setMessages(messages, product);
        return messages;
    }

    public setMessages(messages: ILintMessage[], product?: Product) {
        if (messages.length === 0) {
            this.setStdout('');
            return;
        }

        const lines: string[] = [];
        for (const msg of messages) {
            if (msg.provider === '' && product) {
                msg.provider = getLinterID(product);
            }
            const line = linterMessageAsLine(msg);
            lines.push(line);
        }
        this.setStdout(lines.join(os.EOL) + os.EOL);
    }

    public setStdout(stdout: string) {
        this.pythonToolExecService
            .setup((s) => s.exec(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns(() => Promise.resolve({ stdout: stdout }));
    }
}

// tslint:disable-next-line:max-func-body-length
suite('Linting Scenarios', () => {
    // Note that these aren't actually unit tests.  Instead they are
    // integration tests with heavy usage of mocks.

    test('No linting with PyLint (enabled) when disabled at top-level', async () => {
        const product = Product.pylint;
        const fixture = new TestFixture();
        fixture.lintingSettings.enabled = false;
        fixture.setDefaultMessages(product);
        const linter = await fixture.getEnabledLinter(product);

        const messages = await linter.lint(
            fixture.makeDocument(product, 'spam.py'),
            new CancellationTokenSource().token
        );

        assert.equal(
            messages.length,
            0,
            `Unexpected linter errors when linting is disabled, Output - ${fixture.output}`
        );
    });

    test('No linting with Pylint disabled (and Flake8 enabled)', async () => {
        const product = Product.pylint;
        const fixture = new TestFixture();
        fixture.lintingSettings.enabled = true;
        fixture.lintingSettings.flake8Enabled = true;
        fixture.setDefaultMessages(Product.pylint);
        const linter = await fixture.getDisabledLinter(product);

        const messages = await linter.lint(
            fixture.makeDocument(product, 'spam.py'),
            new CancellationTokenSource().token
        );

        assert.equal(
            messages.length,
            0,
            `Unexpected linter errors when linting is disabled, Output - ${fixture.output}`
        );
    });

    async function testEnablingDisablingOfLinter(fixture: TestFixture, product: Product, enabled: boolean) {
        fixture.lintingSettings.enabled = true;
        fixture.setDefaultMessages(product);
        if (enabled) {
            fixture.setDefaultMessages(product);
        }
        const linter = await fixture.getLinter(product, enabled);

        const messages = await linter.lint(
            fixture.makeDocument(product, 'spam.py'),
            new CancellationTokenSource().token
        );

        if (enabled) {
            assert.notEqual(
                messages.length,
                0,
                `Expected linter errors when linter is enabled, Output - ${fixture.output}`
            );
        } else {
            assert.equal(
                messages.length,
                0,
                `Unexpected linter errors when linter is disabled, Output - ${fixture.output}`
            );
        }
    }
    for (const product of LINTERID_BY_PRODUCT.keys()) {
        for (const enabled of [false, true]) {
            test(`${enabled ? 'Enable' : 'Disable'} ${getProductName(product)} and run linter`, async function () {
                // tslint:disable-next-line:no-suspicious-comment
                // TODO: Add coverage for these linters.
                if ([Product.bandit, Product.mypy, Product.pylama, Product.prospector].some((p) => p === product)) {
                    // tslint:disable-next-line:no-invalid-this
                    this.skip();
                }

                const fixture = new TestFixture();
                await testEnablingDisablingOfLinter(fixture, product, enabled);
            });
        }
    }
    for (const useMinimal of [true, false]) {
        for (const enabled of [true, false]) {
            test(`PyLint ${enabled ? 'enabled' : 'disabled'} with${
                useMinimal ? '' : 'out'
            } minimal checkers`, async () => {
                const fixture = new TestFixture();
                fixture.lintingSettings.pylintUseMinimalCheckers = useMinimal;
                await testEnablingDisablingOfLinter(fixture, Product.pylint, enabled);
            });
        }
    }

    async function testLinterMessages(fixture: TestFixture, product: Product) {
        const messagesToBeReceived = fixture.setDefaultMessages(product);
        const linter = await fixture.getEnabledLinter(product);

        const messages = await linter.lint(
            fixture.makeDocument(product, 'spam.py'),
            new CancellationTokenSource().token
        );

        if (messagesToBeReceived.length === 0) {
            assert.equal(messages.length, 0, `No errors in linter, Output - ${fixture.output}`);
        } else {
            if (fixture.output.indexOf('ENOENT') === -1) {
                // Pylint for Python Version 2.7 could return 80 linter messages, where as in 3.5 it might only return 1.
                // Looks like pylint stops linting as soon as it comes across any ERRORS.
                assert.notEqual(messages.length, 0, `No errors in linter, Output - ${fixture.output}`);
            }
        }
    }
    for (const product of LINTERID_BY_PRODUCT.keys()) {
        test(`Check ${getProductName(product)} messages`, async function () {
            // tslint:disable-next-line:no-suspicious-comment
            // TODO: Add coverage for these linters.
            if ([Product.bandit, Product.mypy, Product.pylama, Product.prospector].some((p) => p === product)) {
                // tslint:disable-next-line:no-invalid-this
                this.skip();
            }

            const fixture = new TestFixture();
            await testLinterMessages(fixture, product);
        });
    }

    async function testLinterMessageCount(fixture: TestFixture, product: Product, messageCountToBeReceived: number) {
        fixture.setDefaultMessages(product);
        const linter = await fixture.getEnabledLinter(product);

        const messages = await linter.lint(
            fixture.makeDocument(product, 'spam.py'),
            new CancellationTokenSource().token
        );

        assert.equal(
            messages.length,
            messageCountToBeReceived,
            `Expected number of lint errors does not match lint error count, Output - ${fixture.output}`
        );
    }
    test('Three line output counted as one message (Pylint)', async () => {
        const maxErrors = 5;
        const fixture = new TestFixture();
        fixture.lintingSettings.maxNumberOfProblems = maxErrors;

        await testLinterMessageCount(fixture, Product.pylint, maxErrors);
    });
});

const PRODUCTS = Object.keys(Product)
    // tslint:disable-next-line:no-any
    .filter((key) => !isNaN(Number(Product[key as any])))
    // tslint:disable-next-line:no-any
    .map((key) => Product[key as any]);

// tslint:disable-next-line:max-func-body-length
suite('Linting Products', () => {
    const prodService = new ProductService();

    test('All linting products are represented by linters', async () => {
        for (const product of PRODUCTS) {
            // tslint:disable-next-line:no-any
            if (prodService.getProductType(product as any) !== ProductType.Linter) {
                continue;
            }
            // tslint:disable-next-line:no-any
            const found = LINTERID_BY_PRODUCT.get(product as any);
            // tslint:disable-next-line:no-any
            assert.notEqual(found, undefined, `did find linter ${Product[product as any]}`);
        }
    });

    test('All linters match linting products', async () => {
        for (const product of LINTERID_BY_PRODUCT.keys()) {
            const prodType = prodService.getProductType(product);
            assert.notEqual(prodType, undefined, `${Product[product]} is not not properly registered`);
            assert.equal(prodType, ProductType.Linter, `${Product[product]} is not a linter product`);
        }
    });

    test('All linting product names match linter IDs', async () => {
        for (const [product, linterID] of LINTERID_BY_PRODUCT) {
            const prodName = ProductNames.get(product);
            assert.equal(prodName, linterID, 'product name does not match linter ID');
        }
    });
});
