// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { expect } from 'chai';
import { SemVer } from 'semver';
import * as TypeMoq from 'typemoq';
import { IFileSystem } from '../../../client/common/platform/types';
import { PythonExecutionService } from '../../../client/common/process/pythonProcess';
import { IProcessService } from '../../../client/common/process/types';
import { Architecture } from '../../../client/common/utils/platform';
import { IServiceContainer } from '../../../client/ioc/types';

suite('PythonExecutableService', () => {
    let processService: TypeMoq.IMock<IProcessService>;
    let executionService: PythonExecutionService;
    const pythonPath = 'path/to/python';

    setup(() => {
        processService = TypeMoq.Mock.ofType<IProcessService>(undefined, TypeMoq.MockBehavior.Strict);
        const serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>(undefined, TypeMoq.MockBehavior.Strict);
        const fileSystem = TypeMoq.Mock.ofType<IFileSystem>(undefined, TypeMoq.MockBehavior.Strict);

        serviceContainer.setup(s => s.get<IFileSystem>(IFileSystem)).returns(() => fileSystem.object);

        executionService = new PythonExecutionService(serviceContainer.object, processService.object, pythonPath);
    });

    test('getInterpreterInformation should return an object if the python path is valid', async () => {
        const json = {
            versionInfo: [3, 7, 5, 'candidate'],
            sysPrefix: '/path/of/sysprefix/versions/3.7.5rc1',
            version: '3.7.5rc1 (default, Oct 18 2019, 14:48:48) \n[Clang 11.0.0 (clang-1100.0.33.8)]',
            is64Bit: true
        };

        processService.setup(p => p.exec(pythonPath, TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve({ stdout: JSON.stringify(json) }));

        const result = await executionService.getInterpreterInformation();
        const expectedResult = {
            architecture: Architecture.x64,
            path: pythonPath,
            version: new SemVer('3.7.5-candidate'),
            sysPrefix: json.sysPrefix,
            sysVersion: undefined
        };

        expect(result).to.deep.equal(expectedResult, 'Incorrect value returned by getInterpreterInformation().');
    });

    test('getInterpreterInformation should return an object with the architecture value set to x86 if json.is64bit is not 64bit', async () => {
        const json = {
            versionInfo: [3, 7, 5, 'candidate'],
            sysPrefix: '/path/of/sysprefix/versions/3.7.5rc1',
            version: '3.7.5rc1 (default, Oct 18 2019, 14:48:48) \n[Clang 11.0.0 (clang-1100.0.33.8)]',
            is64Bit: false
        };

        processService.setup(p => p.exec(pythonPath, TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve({ stdout: JSON.stringify(json) }));

        const result = await executionService.getInterpreterInformation();
        const expectedResult = {
            architecture: Architecture.x86,
            path: pythonPath,
            version: new SemVer('3.7.5-candidate'),
            sysPrefix: json.sysPrefix,
            sysVersion: undefined
        };

        expect(result).to.deep.equal(expectedResult, 'Incorrect value returned by getInterpreterInformation() for x86b architecture.');
    });

    test('getInterpreterInformation should error out if interpreterInfo.py times out', async () => {
        // tslint:disable-next-line: no-any
        processService.setup(p => p.exec(pythonPath, TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve(undefined as any));

        const result = await executionService.getInterpreterInformation();

        expect(result).to.equal(undefined, 'getInterpreterInfo() should return undefined because interpreterInfo timed out.');
    });

    test('getInterpreterInformation should return undefined if the json value returned by interpreterInfo.py is not valid', async () => {
        processService.setup(p => p.exec(pythonPath, TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve({ stdout: 'bad json' }));

        const result = await executionService.getInterpreterInformation();

        expect(result).to.equal(undefined, 'getInterpreterInfo() should return undefined because of bad json.');
    });
});
