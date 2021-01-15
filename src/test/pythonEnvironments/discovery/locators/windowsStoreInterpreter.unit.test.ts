// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import { anything, instance, mock, when } from 'ts-mockito';
import { WindowsStoreInterpreter } from '../../../../client/pythonEnvironments/discovery/locators/services/windowsStoreInterpreter';

// We use this for mocking.
class ComponentAdapter {
    // eslint-disable-next-line class-methods-use-this, @typescript-eslint/no-unused-vars
    public async isWindowsStoreInterpreter(_pythonPath: string): Promise<boolean | undefined> {
        return undefined;
    }
}

suite('Interpreters - Windows Store Interpreter', () => {
    let windowsStoreInterpreter: WindowsStoreInterpreter;
    let pyenvs: ComponentAdapter;
    setup(() => {
        pyenvs = mock(ComponentAdapter);
        when(pyenvs.isWindowsStoreInterpreter(anything())).thenReturn(Promise.resolve(undefined));
        windowsStoreInterpreter = new WindowsStoreInterpreter(instance(pyenvs));
    });
    const windowsStoreInterpreters = [
        '\\\\Program Files\\WindowsApps\\Something\\Python.exe',
        '..\\Program Files\\WindowsApps\\Something\\Python.exe',
        '..\\one\\Program Files\\WindowsApps\\Something\\Python.exe',
        'C:\\Program Files\\WindowsApps\\Something\\Python.exe',
        'C:\\Program Files\\WindowsApps\\Python.exe',
        'C:\\Microsoft\\WindowsApps\\Something\\Python.exe',
        'C:\\Microsoft\\WindowsApps\\Python.exe',
        'C:\\Microsoft\\WindowsApps\\PythonSoftwareFoundation\\Python.exe',
        'C:\\microsoft\\WindowsApps\\PythonSoftwareFoundation\\Something\\Python.exe',
    ];

    async function isWindowsStoreInterpreter(interpreter: string) {
        return windowsStoreInterpreter.isWindowsStoreInterpreter(interpreter);
    }

    function isHiddenInterpreter(interpreter: string) {
        return windowsStoreInterpreter.isHiddenInterpreter(interpreter);
    }

    for (const interpreter of windowsStoreInterpreters) {
        test(`${interpreter} must be identified as a Windows Store interpreter`, async () => {
            expect(await isWindowsStoreInterpreter(interpreter)).to.equal(true, 'Must be true');
        });

        test(`${interpreter.toLowerCase()} must be identified as a Windows Store interpreter (lower case)`, async () => {
            expect(await isWindowsStoreInterpreter(interpreter.toLowerCase())).to.equal(true, 'Must be true');
            expect(await isWindowsStoreInterpreter(interpreter.toUpperCase())).to.equal(true, 'Must be true');
        });

        const otherDrive = `D${interpreter.substring(1)}`;
        test(`${otherDrive} must be identified as a Windows Store interpreter (ignoring driver letter)`, async () => {
            expect(await isWindowsStoreInterpreter(otherDrive)).to.equal(true, 'Must be true');
        });

        const ignorePathSeparator = interpreter.replace(/\\/g, '/');
        test(`${ignorePathSeparator} must be identified as a Windows Store interpreter (ignoring path separator)`, async () => {
            expect(await isWindowsStoreInterpreter(ignorePathSeparator)).to.equal(true, 'Must be true');
        });
    }

    const nonWindowsStoreInterpreters = [
        '..\\Program Filess\\WindowsApps\\Something\\Python.exe',
        'C:\\Program Filess\\WindowsApps\\Something\\Python.exe',
        'C:\\Program Files\\WindowsAppss\\Python.exe',
        'C:\\Microsofts\\WindowsApps\\Something\\Python.exe',
        'C:\\Microsoft\\WindowsAppss\\Python.exe',
        'C:\\Microsofts\\WindowsApps\\PythonSoftwareFoundation\\Python.exe',
        'C:\\microsoft\\WindowsAppss\\PythonSoftwareFoundation\\Something\\Python.exe',
        'C:\\Python\\python.exe',
        'C:\\Program Files\\Python\\python.exe',
        'C:\\Program Files\\Microsoft\\Python\\python.exe',
        '..\\apps\\Python.exe',
        'C:\\Apps\\Python.exe',
    ];
    for (const interpreter of nonWindowsStoreInterpreters) {
        test(`${interpreter} must not be identified as a Windows Store interpreter`, async () => {
            const ignorePathSeparator = interpreter.replace(/\\/g, '/');

            expect(isHiddenInterpreter(interpreter)).to.equal(false, 'Must be false');
            expect(isHiddenInterpreter(ignorePathSeparator)).to.equal(false, 'Must be false');

            expect(await isWindowsStoreInterpreter(interpreter)).to.equal(false, 'Must be false');
            expect(await isWindowsStoreInterpreter(ignorePathSeparator)).to.equal(false, 'Must be false');

            expect(isHiddenInterpreter(interpreter.toLowerCase())).to.equal(false, 'Must be false');
            expect(await isWindowsStoreInterpreter(interpreter.toUpperCase())).to.equal(false, 'Must be false');
            expect(await isWindowsStoreInterpreter(`D${interpreter.substring(1)}`)).to.equal(false, 'Must be false');
        });
    }
    const windowsStoreHiddenInterpreters = [
        'C:\\Program Files\\WindowsApps\\Something\\Python.exe',
        'C:\\Program Files\\WindowsApps\\Python.exe',
        'C:\\Microsoft\\WindowsApps\\PythonSoftwareFoundation\\Python.exe',
        'C:\\microsoft\\WindowsApps\\PythonSoftwareFoundation\\Something\\Python.exe',
    ];
    for (const interpreter of windowsStoreHiddenInterpreters) {
        test(`${interpreter} must be identified as a Windows Store (hidden) interpreter`, () => {
            expect(isHiddenInterpreter(interpreter)).to.equal(true, 'Must be true');
        });

        test(`${interpreter.toLowerCase()} must be identified as a Windows Store (hidden) interpreter (ignoring case)`, () => {
            expect(isHiddenInterpreter(interpreter.toLowerCase())).to.equal(true, 'Must be true');
            expect(isHiddenInterpreter(interpreter.toUpperCase())).to.equal(true, 'Must be true');
        });

        const otherDrive = `D${interpreter.substring(1)}`;
        test(`${otherDrive} must be identified as a Windows Store (hidden) interpreter (ignoring driver letter)`, () => {
            expect(isHiddenInterpreter(otherDrive)).to.equal(true, 'Must be true');
        });
    }
    const nonWindowsStoreHiddenInterpreters = [
        'C:\\Microsofts\\WindowsApps\\Something\\Python.exe',
        'C:\\Microsoft\\WindowsAppss\\Python.exe',
    ];
    for (const interpreter of nonWindowsStoreHiddenInterpreters) {
        test(`${interpreter} must not be identified as a Windows Store (hidden) interpreter`, () => {
            expect(isHiddenInterpreter(interpreter)).to.equal(false, 'Must be true');
        });
    }
});
