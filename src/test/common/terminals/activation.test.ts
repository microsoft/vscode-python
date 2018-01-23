// // Copyright (c) Microsoft Corporation. All rights reserved.
// // Licensed under the MIT License.

// import { expect } from 'chai';
// import * as path from 'path';
// import * as TypeMoq from 'typemoq';
// import { EnumEx } from '../../../client/common/enumUtils';
// import { IFileSystem } from '../../../client/common/platform/types';
// import { Bash } from '../../../client/common/terminal/environmentActivationProviders/bash';
// import { TerminalShellType } from '../../../client/common/terminal/types';
// import { InterpreterType } from '../../../client/interpreter/contracts';
// import { IServiceContainer } from '../../../client/ioc/types';

// // tslint:disable-next-line:max-func-body-length
// suite('Terminal Environment Activation', () => {
//     // let serviceContainer: TypeMoq.IMock<IServiceContainer>;
//     // let fileSystem: TypeMoq.IMock<IFileSystem>;
//     // setup(() => {
//     //     serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
//     //     fileSystem = TypeMoq.Mock.ofType<IFileSystem>();
//     //     serviceContainer.setup(c => c.get(IFileSystem)).returns(() => fileSystem.object);
//     // });

//     // ['usr/bin/activate', 'usr/bin/activate.sh'].forEach(activationScript => {
//     //     EnumEx.getNamesAndValues<TerminalShellType>(TerminalShellType).forEach(shellType => {
//     //         test(`Ensure bash Activation command returns activation command (Shell ${shellType.name})`, async () => {
//     //             const bash = new Bash(serviceContainer.object);

//     //             const supported = bash.isShellSupported(shellType.value);
//     //             if (shellType.value === TerminalShellType.bash) {
//     //                 expect(supported).to.be.equal(true, 'Bash shell not supported');
//     //             } else {
//     //                 expect(supported).to.be.equal(false, `${shellType.name} incorrectly supported by bash`);
//     //             }

//     //             fileSystem.setup(fs => fs.fileExistsAsync(TypeMoq.It.isValue(activationScript))).returns(() => Promise.resolve(true));
//     //             const command = await bash.getActivationCommands({ path: 'usr/bin/python', version: '', type: InterpreterType.Unknown }, shellType.value);

//     //             if (shellType.value === TerminalShellType.bash) {
//     //                 expect(command).to.be.equal(`source ${activationScript}`, 'Invalid command');
//     //             } else {
//     //                 expect(command).to.be.equal(undefined, 'Invalid command (expected undefined)');
//     //             }
//     //         });
//     //     });
//     // });

//     // ['usr/bin/env paths/activate', 'usr/bin/env paths/activate.sh'].forEach(activationScript => {
//     //     EnumEx.getNamesAndValues<TerminalShellType>(TerminalShellType).forEach(shellType => {
//     //         test(`Ensure bash Activation command returns quoted activation command (Shell ${shellType.name})`, async () => {
//     //             const conda = new Conda(serviceContainer.object);
//     //             fileSystem.setup(fs => fs.fileExistsAsync(TypeMoq.It.isValue(activationScript))).returns(() => Promise.resolve(true));
//     //             const command = await conda.getActivationCommand({ path: 'usr/bin/env paths/python', version: '', type: InterpreterType.Unknown }, shellType.value);
//     //             expect(command).to.be.equal(`source "${activationScript}"`, 'Invalid command');
//     //         });
//     //     });
//     // });

//     // ['usr/bin/env paths/activate', 'usr/bin/env paths/activate.sh'].forEach(activationScript => {
//     //     EnumEx.getNamesAndValues<TerminalShellType>(TerminalShellType).forEach(shellType => {
//     //         test(`Ensure bash Activation command returns undefined (Shell ${shellType.name})`, async () => {
//     //             const conda = new Conda(serviceContainer.object);
//     //             fileSystem.setup(fs => fs.fileExistsAsync(TypeMoq.It.isValue(activationScript))).returns(() => Promise.resolve(true));
//     //             fileSystem.setup(fs => fs.fileExistsAsync(TypeMoq.It.isValue(path.join('usr/bin/python', 'activate')))).returns(() => Promise.resolve(false));
//     //             fileSystem.setup(fs => fs.fileExistsAsync(TypeMoq.It.isValue(path.join('usr/bin/python', 'activate.sh')))).returns(() => Promise.resolve(false));

//     //             const command = await conda.getActivationCommand({ path: 'usr/bin/python', version: '', type: InterpreterType.Unknown }, shellType.value);
//     //             expect(command).to.be.equal(undefined, 'Invalid command');
//     //         });
//     //     });
//     // });
// });
