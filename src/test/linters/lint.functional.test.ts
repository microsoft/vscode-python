// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as assert from 'assert';
import * as childProcess from 'child_process';
import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import * as sinon from 'sinon';
import { instance, mock } from 'ts-mockito';
import * as TypeMoq from 'typemoq';
import { CancellationTokenSource, TextDocument, TextLine, Uri } from 'vscode';
import { Product } from '../../client/common/installer/productInstaller';
import { FileSystem } from '../../client/common/platform/fileSystem';
import { PlatformService } from '../../client/common/platform/platformService';
import { IFileSystem } from '../../client/common/platform/types';
import { BufferDecoder } from '../../client/common/process/decoder';
import { ProcessServiceFactory } from '../../client/common/process/processFactory';
import { PythonExecutionFactory } from '../../client/common/process/pythonExecutionFactory';
import { PythonToolExecutionService } from '../../client/common/process/pythonToolService';
import {
    IBufferDecoder,
    IProcessLogger,
    IPythonExecutionFactory,
    IPythonToolExecutionService,
} from '../../client/common/process/types';
import { IConfigurationService, IDisposableRegistry, IExperimentService } from '../../client/common/types';
import { IEnvironmentVariablesProvider } from '../../client/common/variables/types';
import { IEnvironmentActivationService } from '../../client/interpreter/activation/types';
import { IComponentAdapter, ICondaService, IInterpreterService } from '../../client/interpreter/contracts';
import { IServiceContainer } from '../../client/ioc/types';
import { LINTERID_BY_PRODUCT } from '../../client/linters/constants';
import { ILintMessage, LinterId, LintMessageSeverity } from '../../client/linters/types';
import { deleteFile, PYTHON_PATH } from '../common';
import { BaseTestFixture, getLinterID, getProductName, newMockDocument, throwUnknownProduct } from './common';
import * as ExperimentHelpers from '../../client/common/experiments/helpers';

const workspaceDir = path.join(__dirname, '..', '..', '..', 'src', 'test');
const workspaceUri = Uri.file(workspaceDir);
const pythonFilesDir = path.join(workspaceDir, 'pythonFiles', 'linting');
const fileToLint = path.join(pythonFilesDir, 'file.py');

const linterConfigDirs = new Map<LinterId, string>([
    [LinterId.Flake8, path.join(pythonFilesDir, 'flake8config')],
    [LinterId.PyCodeStyle, path.join(pythonFilesDir, 'pycodestyleconfig')],
    [LinterId.PyDocStyle, path.join(pythonFilesDir, 'pydocstyleconfig27')],
    [LinterId.PyLint, path.join(pythonFilesDir, 'pylintconfig')],
]);
const linterConfigRCFiles = new Map<LinterId, string>([
    [LinterId.PyLint, '.pylintrc'],
    [LinterId.PyDocStyle, '.pydocstyle'],
]);

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

const filteredFlake8MessagesToBeReturned: ILintMessage[] = [
    {
        line: 87,
        column: 24,
        severity: LintMessageSeverity.Warning,
        code: 'W292',
        message: 'no newline at end of file',
        provider: '',
        type: '',
    },
];
const filteredPycodestyleMessagesToBeReturned: ILintMessage[] = [
    {
        line: 87,
        column: 24,
        severity: LintMessageSeverity.Warning,
        code: 'W292',
        message: 'no newline at end of file',
        provider: '',
        type: '',
    },
];

function getMessages(product: Product): ILintMessage[] {
    switch (product) {
        case Product.pylint: {
            return pylintMessagesToBeReturned;
        }
        case Product.flake8: {
            return flake8MessagesToBeReturned;
        }
        case Product.pycodestyle: {
            return pycodestyleMessagesToBeReturned;
        }
        case Product.pydocstyle: {
            return pydocstyleMessagesToBeReturned;
        }
        default: {
            throwUnknownProduct(product);
            return []; // to quiet tslint
        }
    }
}

async function getInfoForConfig(product: Product) {
    const prodID = getLinterID(product);
    const dirname = linterConfigDirs.get(prodID);
    assert.notEqual(dirname, undefined, `tests not set up for ${Product[product]}`);

    const filename = path.join(dirname!, product === Product.pylint ? 'file2.py' : 'file.py');
    let messagesToBeReceived: ILintMessage[] = [];
    switch (product) {
        case Product.flake8: {
            messagesToBeReceived = filteredFlake8MessagesToBeReturned;
            break;
        }
        case Product.pycodestyle: {
            messagesToBeReceived = filteredPycodestyleMessagesToBeReturned;
            break;
        }
        default: {
            break;
        }
    }
    const basename = linterConfigRCFiles.get(prodID);
    return {
        filename,
        messagesToBeReceived,
        origRCFile: basename ? path.join(dirname!, basename) : '',
    };
}

class TestFixture extends BaseTestFixture {
    constructor(printLogs = false) {
        const serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>(undefined, TypeMoq.MockBehavior.Strict);
        const configService = TypeMoq.Mock.ofType<IConfigurationService>(undefined, TypeMoq.MockBehavior.Strict);
        const processLogger = TypeMoq.Mock.ofType<IProcessLogger>(undefined, TypeMoq.MockBehavior.Strict);
        const filesystem = new FileSystem();
        processLogger
            .setup((p) => p.logProcess(TypeMoq.It.isAnyString(), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns(() => {
                /** No body */
            });
        serviceContainer
            .setup((s) => s.get(TypeMoq.It.isValue(IProcessLogger), TypeMoq.It.isAny()))
            .returns(() => processLogger.object);
        serviceContainer
            .setup((s) => s.get(TypeMoq.It.isValue(IFileSystem), TypeMoq.It.isAny()))
            .returns(() => filesystem);

        const platformService = new PlatformService();

        super(
            platformService,
            filesystem,
            TestFixture.newPythonToolExecService(serviceContainer.object),
            TestFixture.newPythonExecFactory(serviceContainer, configService.object),
            configService,
            serviceContainer,
            false,
            workspaceDir,
            printLogs,
        );

        this.pythonSettings.setup((s) => s.pythonPath).returns(() => PYTHON_PATH);
    }

    private static newPythonToolExecService(serviceContainer: IServiceContainer): IPythonToolExecutionService {
        // We do not worry about the IProcessServiceFactory possibly
        // needed by PythonToolExecutionService.
        return new PythonToolExecutionService(serviceContainer);
    }

    private static newPythonExecFactory(
        serviceContainer: TypeMoq.IMock<IServiceContainer>,
        configService: IConfigurationService,
    ): IPythonExecutionFactory {
        const envVarsService = TypeMoq.Mock.ofType<IEnvironmentVariablesProvider>(
            undefined,
            TypeMoq.MockBehavior.Strict,
        );
        envVarsService
            .setup((e) => e.getEnvironmentVariables(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(process.env));
        serviceContainer
            .setup((c) => c.get(TypeMoq.It.isValue(IEnvironmentVariablesProvider), TypeMoq.It.isAny()))
            .returns(() => envVarsService.object);
        const disposableRegistry: IDisposableRegistry = [];
        serviceContainer
            .setup((c) => c.get(TypeMoq.It.isValue(IDisposableRegistry), TypeMoq.It.isAny()))
            .returns(() => disposableRegistry);

        const envActivationService = TypeMoq.Mock.ofType<IEnvironmentActivationService>(
            undefined,
            TypeMoq.MockBehavior.Strict,
        );

        const decoder = new BufferDecoder();
        serviceContainer
            .setup((c) => c.get(TypeMoq.It.isValue(IBufferDecoder), TypeMoq.It.isAny()))
            .returns(() => decoder);

        const interpreterService = TypeMoq.Mock.ofType<IInterpreterService>(undefined, TypeMoq.MockBehavior.Strict);
        interpreterService.setup((i) => i.hasInterpreters).returns(() => Promise.resolve(true));
        serviceContainer
            .setup((c) => c.get(TypeMoq.It.isValue(IInterpreterService), TypeMoq.It.isAny()))
            .returns(() => interpreterService.object);

        const condaService = TypeMoq.Mock.ofType<ICondaService>(undefined, TypeMoq.MockBehavior.Strict);
        condaService
            .setup((c) => c.getCondaEnvironment(TypeMoq.It.isAnyString()))
            .returns(() => Promise.resolve(undefined));
        condaService.setup((c) => c.getCondaVersion()).returns(() => Promise.resolve(undefined));
        condaService.setup((c) => c.getCondaFile()).returns(() => Promise.resolve('conda'));

        const processLogger = TypeMoq.Mock.ofType<IProcessLogger>(undefined, TypeMoq.MockBehavior.Strict);
        processLogger
            .setup((p) => p.logProcess(TypeMoq.It.isAnyString(), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns(() => {
                /** No body */
            });
        const procServiceFactory = new ProcessServiceFactory(
            envVarsService.object,
            processLogger.object,
            decoder,
            disposableRegistry,
        );
        const pyenvs: IComponentAdapter = mock<IComponentAdapter>();

        const experimentService = TypeMoq.Mock.ofType<IExperimentService>(undefined, TypeMoq.MockBehavior.Strict);

        const inDiscoveryExperimentStub = sinon.stub(ExperimentHelpers, 'inDiscoveryExperiment');
        inDiscoveryExperimentStub.resolves(false);

        return new PythonExecutionFactory(
            serviceContainer.object,
            envActivationService.object,
            procServiceFactory,
            configService,
            condaService.object,
            decoder,
            instance(pyenvs),
            experimentService.object,
        );
    }

    // eslint-disable-next-line class-methods-use-this
    public makeDocument(filename: string): TextDocument {
        const doc = newMockDocument(filename);

        doc.setup((d) => d.lineAt(TypeMoq.It.isAny())).returns((lno) => {
            const lines = fs.readFileSync(filename).toString().split(os.EOL);
            const textline = TypeMoq.Mock.ofType<TextLine>(undefined, TypeMoq.MockBehavior.Strict);
            textline.setup((t) => t.text).returns(() => lines[lno]);
            return textline.object;
        });

        return doc.object;
    }
}

suite('Linting Functional Tests', () => {
    teardown(() => {
        sinon.restore();
    });

    const pythonPath = childProcess.execSync(`${PYTHON_PATH} -c "import sys;print(sys.executable)"`);

    console.log(`Testing linter with python ${pythonPath}`);

    // These are integration tests that mock out everything except
    // the filesystem and process execution.

    async function testLinterMessages(
        fixture: TestFixture,
        product: Product,
        pythonFile: string,
        messagesToBeReceived: ILintMessage[],
    ) {
        const doc = fixture.makeDocument(pythonFile);
        await fixture.linterManager.setActiveLintersAsync([product], doc.uri);
        const linter = await fixture.linterManager.createLinter(
            product,
            fixture.outputChannel.object,
            fixture.serviceContainer.object,
        );

        const messages = await linter.lint(doc, new CancellationTokenSource().token);

        if (messagesToBeReceived.length === 0) {
            assert.equal(messages.length, 0, `No errors in linter, Output - ${fixture.output}`);
        } else if (fixture.output.indexOf('ENOENT') === -1) {
            // Pylint for Python Version 2.7 could return 80 linter messages, where as in 3.5 it might only return 1.
            // Looks like pylint stops linting as soon as it comes across any ERRORS.
            assert.notEqual(messages.length, 0, `No errors in linter, Output - ${fixture.output}`);
        }
    }
    for (const product of LINTERID_BY_PRODUCT.keys()) {
        test(getProductName(product), async function () {
            if ([Product.bandit, Product.mypy, Product.pylama, Product.prospector].some((p) => p === product)) {
                return this.skip();
            }

            const fixture = new TestFixture();
            const messagesToBeReturned = getMessages(product);
            await testLinterMessages(fixture, product, fileToLint, messagesToBeReturned);

            return undefined;
        });
    }
    for (const product of LINTERID_BY_PRODUCT.keys()) {
        test(`${getProductName(product)} with config in root`, async function () {
            if ([Product.bandit, Product.mypy, Product.pylama, Product.prospector].some((p) => p === product)) {
                return this.skip();
            }

            const fixture = new TestFixture();
            if (product === Product.pydocstyle) {
                fixture.lintingSettings.pylintUseMinimalCheckers = false;
            }

            const { filename, messagesToBeReceived, origRCFile } = await getInfoForConfig(product);
            let rcfile = '';
            async function cleanUp() {
                if (rcfile !== '') {
                    await deleteFile(rcfile);
                }
            }
            if (origRCFile !== '') {
                rcfile = path.join(workspaceUri.fsPath, path.basename(origRCFile));
                await fs.copy(origRCFile, rcfile);
            }

            try {
                await testLinterMessages(fixture, product, filename, messagesToBeReceived);
            } finally {
                await cleanUp();
            }

            return undefined;
        });
    }

    async function testLinterMessageCount(
        fixture: TestFixture,
        product: Product,
        pythonFile: string,
        messageCountToBeReceived: number,
    ) {
        const doc = fixture.makeDocument(pythonFile);
        await fixture.linterManager.setActiveLintersAsync([product], doc.uri);
        const linter = await fixture.linterManager.createLinter(
            product,
            fixture.outputChannel.object,
            fixture.serviceContainer.object,
        );

        const messages = await linter.lint(doc, new CancellationTokenSource().token);

        assert.equal(
            messages.length,
            messageCountToBeReceived,
            'Expected number of lint errors does not match lint error count',
        );
    }
    test('Three line output counted as one message', async () => {
        const maxErrors = 5;
        const fixture = new TestFixture();
        fixture.lintingSettings.maxNumberOfProblems = maxErrors;
        await testLinterMessageCount(
            fixture,
            Product.pylint,
            path.join(pythonFilesDir, 'threeLineLints.py'),
            maxErrors,
        );
    });
});
