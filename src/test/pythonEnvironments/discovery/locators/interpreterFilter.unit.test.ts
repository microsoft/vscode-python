import { expect } from 'chai';
import { isHiddenInterpreter } from '../../../../client/pythonEnvironments/discovery/locators/services/interpreterFilter';
import { EnvironmentType, PythonEnvironment } from '../../../../client/pythonEnvironments/info';

// tslint:disable:no-unused-expression

suite('Interpreters - Filter', () => {
    const doNotHideThesePaths = [
        'python',
        'python.exe',
        'python2',
        'python2.exe',
        'python38',
        'python3.8.exe',
        'C:\\Users\\SomeUser\\AppData\\Local\\Microsoft\\WindowsApps\\python.exe',
        '%USERPROFILE%\\AppData\\Local\\Microsoft\\WindowsApps\\python.exe',
        '%LOCALAPPDATA%\\Microsoft\\WindowsApps\\python.exe',
    ];
    const hideThesePaths = [
        '%USERPROFILE%\\AppData\\Local\\Microsoft\\WindowsApps\\PythonSoftwareFoundation.Python.3.8_qbz5n2kfra8p0\\python.exe',
        'C:\\Users\\SomeUser\\AppData\\Local\\Microsoft\\WindowsApps\\PythonSoftwareFoundation.Python.3.8_qbz5n2kfra8p0\\python.exe',
        '%USERPROFILE%\\AppData\\Local\\Microsoft\\WindowsApps\\PythonSoftwareFoundation\\python.exe',
        'C:\\Users\\SomeUser\\AppData\\Local\\Microsoft\\WindowsApps\\PythonSoftwareFoundation\\python.exe',
        '%LOCALAPPDATA%\\Microsoft\\WindowsApps\\PythonSoftwareFoundation.Python.3.8_qbz5n2kfra8p0\\python.exe',
        '%LOCALAPPDATA%\\Microsoft\\WindowsApps\\PythonSoftwareFoundation\\python.exe',
        'C:\\Program Files\\WindowsApps\\python.exe',
        'C:\\Program Files\\WindowsApps\\PythonSoftwareFoundation.Python.3.8_qbz5n2kfra8p0\\python.exe',
        'C:\\Program Files\\WindowsApps\\PythonSoftwareFoundation\\python.exe',
    ];

    function getInterpreterFromPath(interpreterPath: string): PythonEnvironment {
        return {
            path: interpreterPath,
            sysVersion: '',
            sysPrefix: '',
            architecture: 1,
            companyDisplayName: '',
            displayName: 'python',
            envType: EnvironmentType.WindowsStore,
            envName: '',
            envPath: '',
            cachedEntry: false,
        };
    }

    doNotHideThesePaths.forEach((interpreterPath) => {
        test(`Interpreter path should NOT be hidden - ${interpreterPath}`, () => {
            const interpreter: PythonEnvironment = getInterpreterFromPath(interpreterPath);
            expect(isHiddenInterpreter(interpreter), `${interpreterPath} should NOT be treated as hidden.`).to.be.false;
        });
    });
    hideThesePaths.forEach((interpreterPath) => {
        test(`Interpreter path should be hidden - ${interpreterPath}`, () => {
            const interpreter: PythonEnvironment = getInterpreterFromPath(interpreterPath);
            expect(isHiddenInterpreter(interpreter), `${interpreterPath} should be treated as hidden.`).to.be.true;
        });
    });
});
