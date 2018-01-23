// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { expect } from 'chai';
import * as path from 'path';
import * as TypeMoq from 'typemoq';
import { EnumEx } from '../../../client/common/enumUtils';
import { IFileSystem } from '../../../client/common/platform/types';
import { Bash } from '../../../client/common/terminal/environmentActivationProviders/bash';
import { ITerminalActivationCommandProvider, TerminalShellType } from '../../../client/common/terminal/types';
import { InterpreterType } from '../../../client/interpreter/contracts';
import { IServiceContainer } from '../../../client/ioc/types';

// tslint:disable-next-line:max-func-body-length
suite('Terminal Environment Activation (bash)', () => {
    let serviceContainer: TypeMoq.IMock<IServiceContainer>;
    let fileSystem: TypeMoq.IMock<IFileSystem>;
    let bash: ITerminalActivationCommandProvider;
    setup(() => {
        serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
        fileSystem = TypeMoq.Mock.ofType<IFileSystem>();
        serviceContainer.setup(c => c.get(IFileSystem)).returns(() => fileSystem.object);
        bash = new Bash(serviceContainer.object);
    });

    [undefined, 'dummyEnvName'].forEach(environmentName => {
        const environmentSuiteTitle = environmentName ? 'When there is no environment Name' : 'When there is an environment name';
        suite(environmentSuiteTitle, () => {
            ['usr/bin/python', 'usr/bin/env with spaces/env more/python'].forEach(pythonPath => {
                const hasSpaces = pythonPath.indexOf(' ') > 0;
                const suiteTitle = hasSpaces ? 'When there are spaces in the script file (pythonpath)' : 'When there are no spaces in the script file (pythonpath)';
                suite(suiteTitle, () => {
                    ['activate', 'activate.sh', 'activate.csh', 'activate.fish', 'activate.bat', 'activate.ps1'].forEach(scriptFileName => {
                        suite(`When script file is ${scriptFileName}`, () => {
                            EnumEx.getNamesAndValues<TerminalShellType>(TerminalShellType).forEach(shellType => {
                                const isScriptFileSupported = ['activate', 'activate.sh', 'activate.csh', 'activate.fish'].indexOf(scriptFileName) >= 0;
                                const titleTitle = isScriptFileSupported ? `Ensure bash Activation command returns activation command (Shell: ${shellType.name})` :
                                    `Ensure bash Activation command returns undefined (Shell: ${shellType.name})`;

                                test(titleTitle, async () => {
                                    bash = new Bash(serviceContainer.object);

                                    const supported = bash.isShellSupported(shellType.value);
                                    switch (shellType.value) {
                                        case TerminalShellType.bash:
                                        case TerminalShellType.cshell:
                                        case TerminalShellType.fish: {
                                            expect(supported).to.be.equal(true, `${shellType.name} shell not supported (it should be)`);
                                            break;
                                        }
                                        default: {
                                            expect(supported).to.be.equal(false, `${shellType.name} incorrectly supported (should not be)`);
                                            // No point proceeding with other tests.
                                            return;
                                        }
                                    }

                                    const pathToScriptFile = path.join(path.dirname(pythonPath), scriptFileName);
                                    fileSystem.setup(fs => fs.fileExistsAsync(TypeMoq.It.isValue(pathToScriptFile))).returns(() => Promise.resolve(true));
                                    const command = await bash.getActivationCommands({ path: pythonPath, version: '', type: InterpreterType.Unknown, envName: environmentName }, shellType.value);

                                    if (isScriptFileSupported) {
                                        // Ensure the script file is of the following form:
                                        // source "<path to script file>" <environment name>
                                        // Ensure the path is quoted if it contains any spaces.
                                        // Ensure it contains the name of the environment as an argument to the script file.

                                        const envName = environmentName ? environmentName! : '';
                                        const quotedScriptFile = pathToScriptFile.indexOf(' ') > 0 ? `"${pathToScriptFile}"` : pathToScriptFile;
                                        expect(command).to.be.equal(`source ${quotedScriptFile} ${envName}`.trim(), 'Invalid command');
                                    } else {
                                        expect(command).to.be.equal(undefined, 'Command should be undefined');
                                    }
                                });
                            });
                        });
                    });
                });
            });
        });
    });
});
