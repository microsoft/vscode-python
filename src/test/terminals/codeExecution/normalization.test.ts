// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:max-func-body-length
// tslint:disable:no-any

import { expect } from 'chai';
import * as fs from 'fs-extra';
import { EOL } from 'os';
import * as path from 'path';
import * as TypeMoq from 'typemoq';
import { TextDocument, TextEditor } from 'vscode';
import { IApplicationShell, IDocumentManager } from '../../../client/common/application/types';
import { EXTENSION_ROOT_DIR } from '../../../client/common/constants';
import { BufferDecoder } from '../../../client/common/process/decoder';
import { ProcessService } from '../../../client/common/process/proc';
import { IProcessService, IProcessServiceFactory } from '../../../client/common/process/types';
import { IConfigurationService, IPythonSettings } from '../../../client/common/types';
import { IEnvironmentVariablesProvider } from '../../../client/common/variables/types';
import { IServiceContainer } from '../../../client/ioc/types';
import { CodeExecutionHelper } from '../../../client/terminals/codeExecution/helper';
import { ICodeExecutionHelper } from '../../../client/terminals/types';
import { PYTHON_PATH } from '../../common';

suite('Normalization for Interpreter Tests', () => {
    let documentManager: TypeMoq.IMock<IDocumentManager>;
    let applicationShell: TypeMoq.IMock<IApplicationShell>;
    let helper: ICodeExecutionHelper;
    let document: TypeMoq.IMock<TextDocument>;
    let editor: TypeMoq.IMock<TextEditor>;
    let processService: TypeMoq.IMock<IProcessService>;
    let configService: TypeMoq.IMock<IConfigurationService>;
    const TEST_FILES_PATH = path.join(EXTENSION_ROOT_DIR, 'src', 'test', 'pythonFiles', 'terminalExec');

    setup(() => {
        const serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
        documentManager = TypeMoq.Mock.ofType<IDocumentManager>();
        applicationShell = TypeMoq.Mock.ofType<IApplicationShell>();
        const envVariablesProvider = TypeMoq.Mock.ofType<IEnvironmentVariablesProvider>();
        processService = TypeMoq.Mock.ofType<IProcessService>();
        configService = TypeMoq.Mock.ofType<IConfigurationService>();
        const pythonSettings = TypeMoq.Mock.ofType<IPythonSettings>();
        pythonSettings.setup(p => p.pythonPath).returns(() => PYTHON_PATH);
        processService.setup((x: any) => x.then).returns(() => undefined);
        configService.setup(c => c.getSettings(TypeMoq.It.isAny())).returns(() => pythonSettings.object);
        envVariablesProvider.setup(e => e.getEnvironmentVariables(TypeMoq.It.isAny())).returns(() => Promise.resolve({}));
        const processServiceFactory = TypeMoq.Mock.ofType<IProcessServiceFactory>();
        processServiceFactory.setup(p => p.create(TypeMoq.It.isAny())).returns(() => Promise.resolve(processService.object));
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IProcessServiceFactory), TypeMoq.It.isAny())).returns(() => processServiceFactory.object);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IDocumentManager), TypeMoq.It.isAny())).returns(() => documentManager.object);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IApplicationShell), TypeMoq.It.isAny())).returns(() => applicationShell.object);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IEnvironmentVariablesProvider), TypeMoq.It.isAny())).returns(() => envVariablesProvider.object);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IConfigurationService), TypeMoq.It.isAny())).returns(() => configService.object);
        helper = new CodeExecutionHelper(serviceContainer.object);

        document = TypeMoq.Mock.ofType<TextDocument>();
        editor = TypeMoq.Mock.ofType<TextEditor>();
        editor.setup(e => e.document).returns(() => document.object);
    });

    async function ensureBlankLinesAreRemoved(source: string, expectedSource: string) {
        const actualProcessService = new ProcessService(new BufferDecoder());
        processService.setup(p => p.exec(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns(async (file, args, options) => {
                return actualProcessService.exec.apply(actualProcessService, [file, args, options]);
            });
        const normalizedCode = await helper.normalizeLines(source);

        expectedSource = expectedSource.splitLines({ removeEmptyEntries: false, trim: false }).join(EOL);

        expect(normalizedCode)
            .to.be.equal(
                expectedSource,
                `Normalized code doesn't match.
                Normalized length = ${normalizedCode.length},
                expected length = ${expectedSource.length}`);
    }
    test('Ensure blank lines are NOT removed when code is not indented (simple)', async () => {
        const code = ['import sys', '', '', '', 'print(sys.executable)', '', 'print("1234")', '', '', 'print(1)', 'print(2)'];
        const expectedCode = code.filter(line => line.trim().length > 0).join(EOL);
        await ensureBlankLinesAreRemoved(code.join(EOL), expectedCode);
    });
    ['', '1', '2', '3', '4', '5', '6', '7'].forEach(fileNameSuffix => {
        test(`Ensure blank lines are removed (Sample${fileNameSuffix})`, async () => {
            const code = await fs.readFile(path.join(TEST_FILES_PATH, `sample${fileNameSuffix}_raw.py`), 'utf8');
            const expectedCode = await fs.readFile(path.join(TEST_FILES_PATH, `sample${fileNameSuffix}_normalized.py`), 'utf8');
            await ensureBlankLinesAreRemoved(code, expectedCode);
        });
        test(`Ensure last two blank lines are preserved (Sample${fileNameSuffix})`, async () => {
            const code = await fs.readFile(path.join(TEST_FILES_PATH, `sample${fileNameSuffix}_raw.py`), 'utf8');
            const expectedCode = await fs.readFile(path.join(TEST_FILES_PATH, `sample${fileNameSuffix}_normalized.py`), 'utf8');
            await ensureBlankLinesAreRemoved(code + EOL, expectedCode + EOL);
        });
        test(`Ensure last two blank lines are preserved even if we have more than 2 trailing blank lines (Sample${fileNameSuffix})`, async () => {
            const code = await fs.readFile(path.join(TEST_FILES_PATH, `sample${fileNameSuffix}_raw.py`), 'utf8');
            const expectedCode = await fs.readFile(path.join(TEST_FILES_PATH, `sample${fileNameSuffix}_normalized.py`), 'utf8');
            await ensureBlankLinesAreRemoved(code + EOL + EOL + EOL + EOL, expectedCode + EOL);
        });
    });
});
