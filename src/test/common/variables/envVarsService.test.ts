// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { expect, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as path from 'path';
import { isWindows } from '../../../client/common/platform/osinfo';
import { PathUtils } from '../../../client/common/platform/pathUtils';
import { IPathUtils } from '../../../client/common/types';
import { EnvironmentVariablesService } from '../../../client/common/variables/environment';
import { IEnvironmentVariablesService } from '../../../client/common/variables/types';

use(chaiAsPromised);

const envFilesFolderPath = path.join(__dirname, '..', '..', '..', '..', 'src', 'testMultiRootWkspc', 'workspace4');

// tslint:disable-next-line:max-func-body-length
suite('Environment Variables Service', () => {
    let pathUtils: IPathUtils;
    let variablesService: IEnvironmentVariablesService;
    setup(() => {
        pathUtils = new PathUtils(isWindows());
        variablesService = new EnvironmentVariablesService(pathUtils);
    });

    test('Custom variables should be undefined with non-existent files', async () => {
        const vars = await variablesService.parseFile(path.join(envFilesFolderPath, 'abcd'));
        expect(vars).to.equal(undefined, 'Variables should be undefined');
    });

    test('Custom variables should be undefined when folder name is passed instead of a file name', async () => {
        const vars = await variablesService.parseFile(envFilesFolderPath);
        expect(vars).to.equal(undefined, 'Variables should be undefined');
    });

    test('Custom variables should be not undefined with a valid environment file', async () => {
        const vars = await variablesService.parseFile(path.join(envFilesFolderPath, '.env'));
        expect(vars).to.not.equal(undefined, 'Variables should be undefined');
    });

    test('Custom variables should be parsed from env file', async () => {
        const vars = await variablesService.parseFile(path.join(envFilesFolderPath, '.env'));

        expect(vars).to.not.equal(undefined, 'Variables is is undefiend');
        expect(Object.keys(vars!)).lengthOf(2, 'Incorrect number of variables');
        expect(vars).to.have.property('X1234PYEXTUNITTESTVAR', '1234', 'X1234PYEXTUNITTESTVAR value is invalid');
        expect(vars).to.have.property('PYTHONPATH', '../workspace5', 'PYTHONPATH value is invalid');
    });

    test('PATH and PYTHONPATH from env file should be returned as is', async () => {
        const vars = await variablesService.parseFile(path.join(envFilesFolderPath, '.env5'));
        const expectedPythonPath = '/usr/one/three:/usr/one/four';
        const expectedPath = '/usr/x:/usr/y';
        expect(vars).to.not.equal(undefined, 'Variables is is undefiend');
        expect(Object.keys(vars!)).lengthOf(5, 'Incorrect number of variables');
        expect(vars).to.have.property('X', '1', 'X value is invalid');
        expect(vars).to.have.property('Y', '2', 'Y value is invalid');
        expect(vars).to.have.property('PYTHONPATH', expectedPythonPath, 'PYTHONPATH value is invalid');
        expect(vars).to.have.property('PATH', expectedPath, 'PATH value is invalid');
    });

    test('Ensure variables are merged', async () => {
        const vars1 = { ONE: '1', TWO: 'TWO' };
        const vars2 = { ONE: 'ONE', THREE: '3' };
        variablesService.mergeVariables(vars1, vars2);
        expect(Object.keys(vars1)).lengthOf(2, 'Source variables modified');
        expect(Object.keys(vars2)).lengthOf(3, 'Variables not merged');
        expect(vars2).to.have.property('ONE', 'ONE', 'Variable overwritten');
        expect(vars2).to.have.property('TWO', 'TWO', 'Incorrect value');
        expect(vars2).to.have.property('THREE', '3', 'Variable not merged');
    });

    test('Ensure path variabnles variables are not merged into target', async () => {
        const pathVariable = pathUtils.getPathVariableName();
        const vars1 = { ONE: '1', TWO: 'TWO', PYTHONPATH: 'PYTHONPATH' };
        vars1[pathVariable] = 'PATH';
        const vars2 = { ONE: 'ONE', THREE: '3' };
        variablesService.mergeVariables(vars1, vars2);
        expect(Object.keys(vars1)).lengthOf(4, 'Source variables modified');
        expect(Object.keys(vars2)).lengthOf(3, 'Variables not merged');
        expect(vars2).to.have.property('ONE', 'ONE', 'Variable overwritten');
        expect(vars2).to.have.property('TWO', 'TWO', 'Incorrect value');
        expect(vars2).to.have.property('THREE', '3', 'Variable not merged');
    });

    test('Ensure path variabnles variables in target are left untouched', async () => {
        const pathVariable = pathUtils.getPathVariableName();
        const vars1 = { ONE: '1', TWO: 'TWO' };
        const vars2 = { ONE: 'ONE', THREE: '3', PYTHONPATH: 'PYTHONPATH' };
        vars2[pathVariable] = 'PATH';
        variablesService.mergeVariables(vars1, vars2);
        expect(Object.keys(vars1)).lengthOf(2, 'Source variables modified');
        expect(Object.keys(vars2)).lengthOf(5, 'Variables not merged');
        expect(vars2).to.have.property('ONE', 'ONE', 'Variable overwritten');
        expect(vars2).to.have.property('TWO', 'TWO', 'Incorrect value');
        expect(vars2).to.have.property('THREE', '3', 'Variable not merged');
        expect(vars2).to.have.property('PYTHONPATH', 'PYTHONPATH', 'Incorrect value');
        expect(vars2).to.have.property(pathVariable, 'PATH', 'Incorrect value');
    });

    test('Ensure appending PATH has no effect if an undefined value or empty string is provided and PATH does not exist in vars object', async () => {
        const vars = { ONE: '1' };
        variablesService.appendPath(vars);
        expect(Object.keys(vars)).lengthOf(1, 'Incorrect number of variables');
        expect(vars).to.have.property('ONE', '1', 'Incorrect value');

        variablesService.appendPath(vars, '');
        expect(Object.keys(vars)).lengthOf(1, 'Incorrect number of variables');
        expect(vars).to.have.property('ONE', '1', 'Incorrect value');

        variablesService.appendPath(vars, ' ', '');
        expect(Object.keys(vars)).lengthOf(1, 'Incorrect number of variables');
        expect(vars).to.have.property('ONE', '1', 'Incorrect value');
    });

    test('Ensure appending PYTHONPATH has no effect if an undefined value or empty string is provided and PYTHONPATH does not exist in vars object', async () => {
        const vars = { ONE: '1' };
        variablesService.appendPythonPath(vars);
        expect(Object.keys(vars)).lengthOf(1, 'Incorrect number of variables');
        expect(vars).to.have.property('ONE', '1', 'Incorrect value');

        variablesService.appendPythonPath(vars, '');
        expect(Object.keys(vars)).lengthOf(1, 'Incorrect number of variables');
        expect(vars).to.have.property('ONE', '1', 'Incorrect value');

        variablesService.appendPythonPath(vars, ' ', '');
        expect(Object.keys(vars)).lengthOf(1, 'Incorrect number of variables');
        expect(vars).to.have.property('ONE', '1', 'Incorrect value');
    });

    test('Ensure appending PATH has no effect if an empty string is provided and path does not exist in vars object', async () => {
        const pathVariable = pathUtils.getPathVariableName();
        const vars = { ONE: '1' };
        vars[pathVariable] = 'PATH';
        variablesService.appendPath(vars);
        expect(Object.keys(vars)).lengthOf(2, 'Incorrect number of variables');
        expect(vars).to.have.property('ONE', '1', 'Incorrect value');
        expect(vars).to.have.property(pathVariable, 'PATH', 'Incorrect value');

        variablesService.appendPath(vars, '');
        expect(Object.keys(vars)).lengthOf(2, 'Incorrect number of variables');
        expect(vars).to.have.property('ONE', '1', 'Incorrect value');
        expect(vars).to.have.property(pathVariable, 'PATH', 'Incorrect value');

        variablesService.appendPath(vars, ' ', '');
        expect(Object.keys(vars)).lengthOf(2, 'Incorrect number of variables');
        expect(vars).to.have.property('ONE', '1', 'Incorrect value');
        expect(vars).to.have.property(pathVariable, 'PATH', 'Incorrect value');
    });

    test('Ensure appending PYTHONPATH has no effect if an empty string is provided and PYTHONPATH does not exist in vars object', async () => {
        const vars = { ONE: '1', PYTHONPATH: 'PYTHONPATH' };
        variablesService.appendPythonPath(vars);
        expect(Object.keys(vars)).lengthOf(2, 'Incorrect number of variables');
        expect(vars).to.have.property('ONE', '1', 'Incorrect value');
        expect(vars).to.have.property('PYTHONPATH', 'PYTHONPATH', 'Incorrect value');

        variablesService.appendPythonPath(vars, '');
        expect(Object.keys(vars)).lengthOf(2, 'Incorrect number of variables');
        expect(vars).to.have.property('ONE', '1', 'Incorrect value');
        expect(vars).to.have.property('PYTHONPATH', 'PYTHONPATH', 'Incorrect value');

        variablesService.appendPythonPath(vars, ' ', '');
        expect(Object.keys(vars)).lengthOf(2, 'Incorrect number of variables');
        expect(vars).to.have.property('ONE', '1', 'Incorrect value');
        expect(vars).to.have.property('PYTHONPATH', 'PYTHONPATH', 'Incorrect value');
    });

    test('Ensure PATH is appeneded', async () => {
        const pathVariable = pathUtils.getPathVariableName();
        const vars = { ONE: '1' };
        vars[pathVariable] = 'PATH';
        const pathToAppend = `/usr/one${path.delimiter}/usr/three`;
        variablesService.appendPath(vars, pathToAppend);
        expect(Object.keys(vars)).lengthOf(2, 'Incorrect number of variables');
        expect(vars).to.have.property('ONE', '1', 'Incorrect value');
        expect(vars).to.have.property(pathVariable, `PATH${path.delimiter}${pathToAppend}`, 'Incorrect value');
    });

    test('Ensure appending PYTHONPATH has no effect if an empty string is provided and PYTHONPATH does not exist in vars object', async () => {
        const vars = { ONE: '1', PYTHONPATH: 'PYTHONPATH' };
        const pathToAppend = `/usr/one${path.delimiter}/usr/three`;
        variablesService.appendPythonPath(vars, pathToAppend);
        expect(Object.keys(vars)).lengthOf(2, 'Incorrect number of variables');
        expect(vars).to.have.property('ONE', '1', 'Incorrect value');
        expect(vars).to.have.property('PYTHONPATH', `PYTHONPATH${path.delimiter}${pathToAppend}`, 'Incorrect value');
    });
});
