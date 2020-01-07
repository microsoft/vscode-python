// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as path from 'path';
import { FileSystem } from '../../../client/common/platform/fileSystem';
import { PathUtils } from '../../../client/common/platform/pathUtils';
import { PlatformService } from '../../../client/common/platform/platformService';
import { IPathUtils } from '../../../client/common/types';
import { OSType } from '../../../client/common/utils/platform';
import { EnvironmentVariablesService, parseEnvFile } from '../../../client/common/variables/environment';
import { IEnvironmentVariablesService } from '../../../client/common/variables/types';
import { getOSType } from '../../common';

use(chaiAsPromised);

const envFilesFolderPath = path.join(__dirname, '..', '..', '..', '..', 'src', 'testMultiRootWkspc', 'workspace4');

// tslint:disable-next-line:max-func-body-length
suite('Environment Variables Service', () => {
    let pathUtils: IPathUtils;
    let variablesService: IEnvironmentVariablesService;
    setup(() => {
        pathUtils = new PathUtils(getOSType() === OSType.Windows);
        const fs = new FileSystem(new PlatformService());
        variablesService = new EnvironmentVariablesService(pathUtils, fs);
    });

    test('Custom variables should be undefined with no argument', async () => {
        const vars = await variablesService.parseFile(undefined);
        expect(vars).to.equal(undefined, 'Variables should be undefined');
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

    test('Simple variable substitution is supported', async () => {
        const vars = await variablesService.parseFile(path.join(envFilesFolderPath, '.env6'), { BINDIR: '/usr/bin' });

        expect(vars).to.not.equal(undefined, 'Variables is undefiend');
        expect(Object.keys(vars!)).lengthOf(3, 'Incorrect number of variables');
        expect(vars).to.have.property('REPO', '/home/user/git/foobar', 'value is invalid');
        expect(vars).to.have.property('PYTHONPATH', '/home/user/git/foobar/foo:/home/user/git/foobar/bar', 'value is invalid');
        expect(vars).to.have.property('PYTHON', '/usr/bin/python3', 'value is invalid');
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
        // tslint:disable-next-line:no-any
        (vars1 as any)[pathVariable] = 'PATH';
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
        // tslint:disable-next-line:no-any
        (vars2 as any)[pathVariable] = 'PATH';
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
        // tslint:disable-next-line:no-any
        (vars as any)[pathVariable] = 'PATH';
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
        // tslint:disable-next-line:no-any
        (vars as any)[pathVariable] = 'PATH';
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

// tslint:disable-next-line:max-func-body-length
suite('Parsing Environment Variables Files', () => {
    test('Custom variables should be parsed from env file', () => {
        // tslint:disable-next-line:no-multiline-string
        const vars = parseEnvFile(`
X1234PYEXTUNITTESTVAR=1234
PYTHONPATH=../workspace5
            `);

        expect(vars).to.not.equal(undefined, 'Variables is undefiend');
        expect(Object.keys(vars!)).lengthOf(2, 'Incorrect number of variables');
        expect(vars).to.have.property('X1234PYEXTUNITTESTVAR', '1234', 'X1234PYEXTUNITTESTVAR value is invalid');
        expect(vars).to.have.property('PYTHONPATH', '../workspace5', 'PYTHONPATH value is invalid');
    });

    test('PATH and PYTHONPATH from env file should be returned as is', () => {
        // tslint:disable-next-line:no-multiline-string
        const vars = parseEnvFile(`
X=1
Y=2
PYTHONPATH=/usr/one/three:/usr/one/four
# Unix PATH variable
PATH=/usr/x:/usr/y
# Windows Path variable
Path=/usr/x:/usr/y
            `);

        const expectedPythonPath = '/usr/one/three:/usr/one/four';
        const expectedPath = '/usr/x:/usr/y';
        expect(vars).to.not.equal(undefined, 'Variables is undefiend');
        expect(Object.keys(vars!)).lengthOf(5, 'Incorrect number of variables');
        expect(vars).to.have.property('X', '1', 'X value is invalid');
        expect(vars).to.have.property('Y', '2', 'Y value is invalid');
        expect(vars).to.have.property('PYTHONPATH', expectedPythonPath, 'PYTHONPATH value is invalid');
        expect(vars).to.have.property('PATH', expectedPath, 'PATH value is invalid');
    });

    test('Variable names must be alpha + alnum/underscore', () => {
        // tslint:disable-next-line:no-multiline-string
        const vars = parseEnvFile(`
SPAM=1234
ham=5678
Eggs=9012
_bogus1=...
1bogus2=...
bogus 3=...
bogus.4=...
bogus-5=...
bogus~6=...
VAR1=3456
VAR_2=7890
            `);

        expect(vars).to.not.equal(undefined, 'Variables is undefiend');
        expect(Object.keys(vars!)).lengthOf(5, 'Incorrect number of variables');
        expect(vars).to.have.property('SPAM', '1234', 'value is invalid');
        expect(vars).to.have.property('ham', '5678', 'value is invalid');
        expect(vars).to.have.property('Eggs', '9012', 'value is invalid');
        expect(vars).to.have.property('VAR1', '3456', 'value is invalid');
        expect(vars).to.have.property('VAR_2', '7890', 'value is invalid');
    });

    test('Empty values become empty string', () => {
        // tslint:disable-next-line:no-multiline-string
        const vars = parseEnvFile(`
SPAM=
            `);

        expect(vars).to.not.equal(undefined, 'Variables is undefiend');
        expect(Object.keys(vars!)).lengthOf(1, 'Incorrect number of variables');
        expect(vars).to.have.property('SPAM', '', 'value is invalid');
    });

    test('Outer quotation marks are removed', () => {
        // tslint:disable-next-line:no-multiline-string
        const vars = parseEnvFile(`
SPAM=1234
HAM='5678'
EGGS="9012"
FOO='"3456"'
BAR="'7890'"
BAZ="\"ABCD"
VAR1="EFGH
VAR2=IJKL"
VAR3='MN'OP'
VAR4="QR"ST"
            `);

        expect(vars).to.not.equal(undefined, 'Variables is undefiend');
        expect(Object.keys(vars!)).lengthOf(10, 'Incorrect number of variables');
        expect(vars).to.have.property('SPAM', '1234', 'value is invalid');
        expect(vars).to.have.property('HAM', '5678', 'value is invalid');
        expect(vars).to.have.property('EGGS', '9012', 'value is invalid');
        expect(vars).to.have.property('FOO', '"3456"', 'value is invalid');
        expect(vars).to.have.property('BAR', "'7890'", 'value is invalid');
        expect(vars).to.have.property('BAZ', '"ABCD', 'value is invalid');
        expect(vars).to.have.property('VAR1', '"EFGH', 'value is invalid');
        expect(vars).to.have.property('VAR2', 'IJKL"', 'value is invalid');
        // tslint:disable-next-line:no-suspicious-comment
        // TODO: Should the outer marks be left?
        expect(vars).to.have.property('VAR3', "MN'OP", 'value is invalid');
        expect(vars).to.have.property('VAR4', 'QR"ST', 'value is invalid');
    });

    test('Whitespace is ignored', () => {
        // tslint:disable:no-trailing-whitespace
        // tslint:disable-next-line:no-multiline-string
        const vars = parseEnvFile(`
SPAM=1234
HAM =5678
EGGS= 9012
FOO = 3456
  BAR=7890
  BAZ = ABCD
VAR1=EFGH  ...
VAR2=IJKL
VAR3='  MNOP  '
            `);
        // tslint:enable:no-trailing-whitespace

        expect(vars).to.not.equal(undefined, 'Variables is undefiend');
        expect(Object.keys(vars!)).lengthOf(9, 'Incorrect number of variables');
        expect(vars).to.have.property('SPAM', '1234', 'value is invalid');
        expect(vars).to.have.property('HAM', '5678', 'value is invalid');
        expect(vars).to.have.property('EGGS', '9012', 'value is invalid');
        expect(vars).to.have.property('FOO', '3456', 'value is invalid');
        expect(vars).to.have.property('BAR', '7890', 'value is invalid');
        expect(vars).to.have.property('BAZ', 'ABCD', 'value is invalid');
        expect(vars).to.have.property('VAR1', 'EFGH  ...', 'value is invalid');
        expect(vars).to.have.property('VAR2', 'IJKL', 'value is invalid');
        expect(vars).to.have.property('VAR3', '  MNOP  ', 'value is invalid');
    });

    test('Blank lines are ignored', () => {
        // tslint:disable:no-trailing-whitespace
        // tslint:disable-next-line:no-multiline-string
        const vars = parseEnvFile(`

SPAM=1234

HAM=5678


            `);
        // tslint:enable:no-trailing-whitespace

        expect(vars).to.not.equal(undefined, 'Variables is undefiend');
        expect(Object.keys(vars!)).lengthOf(2, 'Incorrect number of variables');
        expect(vars).to.have.property('SPAM', '1234', 'value is invalid');
        expect(vars).to.have.property('HAM', '5678', 'value is invalid');
    });

    test('Comments are ignored', () => {
        // tslint:disable-next-line:no-multiline-string
        const vars = parseEnvFile(`
# step 1
SPAM=1234
  # step 2
HAM=5678
#step 3
EGGS=9012  # ...
#  done
            `);

        expect(vars).to.not.equal(undefined, 'Variables is undefiend');
        expect(Object.keys(vars!)).lengthOf(3, 'Incorrect number of variables');
        expect(vars).to.have.property('SPAM', '1234', 'value is invalid');
        expect(vars).to.have.property('HAM', '5678', 'value is invalid');
        expect(vars).to.have.property('EGGS', '9012  # ...', 'value is invalid');
    });

    // Substitution
    // tslint:disable:no-invalid-template-strings

    test('Basic substitution syntax', () => {
        // tslint:disable-next-line:no-multiline-string
        const vars = parseEnvFile('\
REPO=/home/user/git/foobar \n\
PYTHONPATH=${REPO}/foo:${REPO}/bar \n\
            ');

        expect(vars).to.not.equal(undefined, 'Variables is undefiend');
        expect(Object.keys(vars!)).lengthOf(2, 'Incorrect number of variables');
        expect(vars).to.have.property('REPO', '/home/user/git/foobar', 'value is invalid');
        expect(vars).to.have.property('PYTHONPATH', '/home/user/git/foobar/foo:/home/user/git/foobar/bar', 'value is invalid');
    });

    test('Curly braces are required for substitution', () => {
        // tslint:disable-next-line:no-multiline-string
        const vars = parseEnvFile('\
SPAM=1234 \n\
EGGS=$SPAM \n\
            ');

        expect(vars).to.not.equal(undefined, 'Variables is undefiend');
        expect(Object.keys(vars!)).lengthOf(2, 'Incorrect number of variables');
        expect(vars).to.have.property('SPAM', '1234', 'value is invalid');
        expect(vars).to.have.property('EGGS', '$SPAM', 'value is invalid');
    });

    test('Nested substitution is not supported', () => {
        // tslint:disable-next-line:no-multiline-string
        const vars = parseEnvFile(
            '\
SPAM=EGGS \n\
EGGS=??? \n\
HAM1="-- ${${SPAM}} --"\n\
abcEGGSxyz=!!! \n\
HAM2="-- ${abc${SPAM}xyz} --"\n\
HAM3="-- ${${SPAM} --"\n\
HAM4="-- ${${SPAM}} ${EGGS} --"\n\
            '
        );

        expect(vars).to.not.equal(undefined, 'Variables is undefiend');
        expect(Object.keys(vars!)).lengthOf(7, 'Incorrect number of variables');
        expect(vars).to.have.property('SPAM', 'EGGS', 'value is invalid');
        expect(vars).to.have.property('EGGS', '???', 'value is invalid');
        expect(vars).to.have.property('HAM1', '-- ${${SPAM}} --', 'value is invalid');
        expect(vars).to.have.property('abcEGGSxyz', '!!!', 'value is invalid');
        expect(vars).to.have.property('HAM2', '-- ${abc${SPAM}xyz} --', 'value is invalid');
        expect(vars).to.have.property('HAM3', '-- ${${SPAM} --', 'value is invalid');
        expect(vars).to.have.property('HAM4', '-- ${${SPAM}} ${EGGS} --', 'value is invalid');
    });

    test('Other bad substitution syntax', () => {
        // tslint:disable-next-line:no-multiline-string
        const vars = parseEnvFile('\
SPAM=EGGS \n\
EGGS=??? \n\
HAM1=${} \n\
HAM2=${ \n\
HAM3=${SPAM+EGGS} \n\
HAM4=$SPAM \n\
            ');

        expect(vars).to.not.equal(undefined, 'Variables is undefiend');
        expect(Object.keys(vars!)).lengthOf(6, 'Incorrect number of variables');
        expect(vars).to.have.property('SPAM', 'EGGS', 'value is invalid');
        expect(vars).to.have.property('EGGS', '???', 'value is invalid');
        expect(vars).to.have.property('HAM1', '${}', 'value is invalid');
        expect(vars).to.have.property('HAM2', '${', 'value is invalid');
        expect(vars).to.have.property('HAM3', '${SPAM+EGGS}', 'value is invalid');
        expect(vars).to.have.property('HAM4', '$SPAM', 'value is invalid');
    });

    test('Recursive substitution is allowed', () => {
        // tslint:disable-next-line:no-multiline-string
        const vars = parseEnvFile('\
REPO=/home/user/git/foobar \n\
PYTHONPATH=${REPO}/foo \n\
PYTHONPATH=${PYTHONPATH}:${REPO}/bar \n\
            ');

        expect(vars).to.not.equal(undefined, 'Variables is undefiend');
        expect(Object.keys(vars!)).lengthOf(2, 'Incorrect number of variables');
        expect(vars).to.have.property('REPO', '/home/user/git/foobar', 'value is invalid');
        expect(vars).to.have.property('PYTHONPATH', '/home/user/git/foobar/foo:/home/user/git/foobar/bar', 'value is invalid');
    });

    test('Substitution may be escaped', () => {
        // tslint:disable-next-line:no-multiline-string
        const vars = parseEnvFile('\
SPAM=1234 \n\
EGGS=\\${SPAM}/foo:\\${SPAM}/bar \n\
HAM=$ ... $$ \n\
            ');

        expect(vars).to.not.equal(undefined, 'Variables is undefiend');
        expect(Object.keys(vars!)).lengthOf(3, 'Incorrect number of variables');
        expect(vars).to.have.property('SPAM', '1234', 'value is invalid');
        expect(vars).to.have.property('EGGS', '${SPAM}/foo:${SPAM}/bar', 'value is invalid');
        expect(vars).to.have.property('HAM', '$ ... $$', 'value is invalid');
    });

    test('base substitution variables', () => {
        // tslint:disable-next-line:no-multiline-string
        const vars = parseEnvFile('\
PYTHONPATH=${REPO}/foo:${REPO}/bar \n\
            ', {
            REPO: '/home/user/git/foobar'
        });

        expect(vars).to.not.equal(undefined, 'Variables is undefiend');
        expect(Object.keys(vars!)).lengthOf(1, 'Incorrect number of variables');
        expect(vars).to.have.property('PYTHONPATH', '/home/user/git/foobar/foo:/home/user/git/foobar/bar', 'value is invalid');
    });

    // tslint:enable:no-invalid-template-strings
});
