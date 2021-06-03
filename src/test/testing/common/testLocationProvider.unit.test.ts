// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import * as typeMoq from 'typemoq';
import * as path from 'path';
import { Uri, Range, Position } from 'vscode';
import { PythonExecutionService } from '../../../client/common/process/pythonExecutionService';
import {
    ExecutionFactoryCreateWithEnvironmentOptions,
    ExecutionFactoryCreationOptions,
    IProcessService,
    IPythonExecutionFactory,
    IPythonExecutionService,
} from '../../../client/common/process/types';
import { TestRangeProvider } from '../../../client/testing/common/testLocationProvider';
import { EXTENSION_ROOT_DIR_FOR_TESTS } from '../../constants';

suite('Test Location Provider', () => {
    const testFileUri = Uri.file(
        path.join(EXTENSION_ROOT_DIR_FOR_TESTS, 'src', 'test', 'pythonFiles', 'testing', 'test_location.py'),
    );

    // data below comes from running 'symbolProvider.py' on `src\test\pythonFiles\testing\test_location.py`
    const testData =
        '[{"namespace": "", "name": "test_numbers", "range": {"start": {"line": 4, "character": 0}, "end": {"line": 5, "character": 4}}}, {"namespace": "", "name": "test_numbers2", "range": {"start": {"line": 9, "character": 0}, "end": {"line": 10, "character": 4}}}, {"namespace": "", "name": "test_numbers_skip", "range": {"start": {"line": 14, "character": 0}, "end": {"line": 15, "character": 4}}}, {"namespace": "", "name": "StringTest", "range": {"start": {"line": 18, "character": 0}, "end": {"line": 24, "character": 8}}}, {"namespace": "StringTest", "name": "test_str", "range": {"start": {"line": 19, "character": 4}, "end": {"line": 20, "character": 8}}}, {"namespace": "StringTest", "name": "test_str_skip", "range": {"start": {"line": 23, "character": 4}, "end": {"line": 24, "character": 8}}}]';

    class TestPythonExecutionFactory implements IPythonExecutionFactory {
        constructor(private readonly proc: IPythonExecutionService) {}

        create(_options: ExecutionFactoryCreationOptions): Promise<IPythonExecutionService> {
            return Promise.resolve(this.proc);
        }

        createActivatedEnvironment(
            _options: ExecutionFactoryCreateWithEnvironmentOptions,
        ): Promise<IPythonExecutionService> {
            return Promise.resolve(this.proc);
        }

        createCondaExecutionService(
            _pythonPath: string,
            _processService?: IProcessService,
            _resource?: Uri,
        ): Promise<IPythonExecutionService | undefined> {
            return Promise.resolve(this.proc);
        }
    }

    test('Test function location', async () => {
        const pythonExecService = typeMoq.Mock.ofType<IPythonExecutionService>(PythonExecutionService);
        pythonExecService
            .setup((f) => f.exec(typeMoq.It.isAny(), typeMoq.It.isAny()))
            .returns(() => Promise.resolve({ stdout: testData }));

        const testLocationProvider = new TestRangeProvider(new TestPythonExecutionFactory(pythonExecService.object));

        const expectedData = [
            new Range(new Position(4, 0), new Position(5, 4)),
            new Range(new Position(9, 0), new Position(10, 4)),
            new Range(new Position(14, 0), new Position(15, 4)),
            new Range(new Position(18, 0), new Position(24, 8)),
            new Range(new Position(19, 4), new Position(20, 8)),
            new Range(new Position(23, 4), new Position(24, 8)),
            undefined,
        ];
        const actual = await testLocationProvider.getRange(testFileUri, [
            'test_numbers',
            'test_numbers2',
            'test_numbers_skip',
            'StringTest',
            'test_str',
            'test_str_skip',
            'test_does_not_exist',
        ]);
        assert.deepStrictEqual(actual, expectedData);
    });

    test('Test function location - parsing error', async () => {
        const pythonExecService = typeMoq.Mock.ofType<IPythonExecutionService>(PythonExecutionService);
        pythonExecService
            .setup((f) => f.exec(typeMoq.It.isAny(), typeMoq.It.isAny()))
            .returns(() => Promise.resolve({ stdout: '[{]' }));

        const testLocationProvider = new TestRangeProvider(new TestPythonExecutionFactory(pythonExecService.object));

        const expectedData = [undefined, undefined, undefined, undefined, undefined, undefined, undefined];
        const actual = await testLocationProvider.getRange(testFileUri, [
            'test_numbers',
            'test_numbers2',
            'test_numbers_skip',
            'StringTest',
            'test_str',
            'test_str_skip',
            'test_does_not_exist',
        ]);
        assert.deepStrictEqual(actual, expectedData);
    });
});
