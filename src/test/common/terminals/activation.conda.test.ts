// // Copyright (c) Microsoft Corporation. All rights reserved.
// // Licensed under the MIT License.

// import { expect } from 'chai';
// import * as TypeMoq from 'typemoq';
// import { EnumEx } from '../../../client/common/enumUtils';
// import { Conda } from '../../../client/common/terminal/environmentActivationProviders/conda';
// import { TerminalShellType } from '../../../client/common/terminal/types';
// import { InterpreterType } from '../../../client/interpreter/contracts';
// import { IServiceContainer } from '../../../client/ioc/types';

// // tslint:disable-next-line:max-func-body-length
// suite('Terminal Environment Activation (conda)', () => {
//     EnumEx.getNamesAndValues<TerminalShellType>(TerminalShellType).forEach(shellType => {
//         test(`Ensure conda Activation command is undefined, when environment name is not available for a Conda Environment (Shell ${shellType.name})`, async () => {
//             const conda = new Conda(TypeMoq.Mock.ofType<IServiceContainer>().object);
//             const command = await conda.getActivationCommands({ path: '', version: '', type: InterpreterType.Conda }, shellType.value);
//             expect(command).to.be.equal(undefined, 'Invalid command');
//         });
//     });

//     EnumEx.getNamesAndValues<TerminalShellType>(TerminalShellType).forEach(shellType => {
//         EnumEx.getNamesAndValues<InterpreterType>(InterpreterType).forEach(interpreter => {
//             if (interpreter.value === InterpreterType.Conda) {
//                 return;
//             }
//             test(`Ensure conda Activation command is undefined, when environment name is not available for a non Conda Environment (Shell ${shellType.name})`, async () => {
//                 const conda = new Conda(TypeMoq.Mock.ofType<IServiceContainer>().object);
//                 const command = await conda.getActivationCommands({ path: '', version: '', type: interpreter.value }, shellType.value);
//                 expect(command).to.be.equal(undefined, 'Invalid command');
//             });
//         });
//     });

//     EnumEx.getNamesAndValues<TerminalShellType>(TerminalShellType).forEach(shellType => {
//         EnumEx.getNamesAndValues<InterpreterType>(InterpreterType).forEach(interpreter => {
//             if (interpreter.value === InterpreterType.Conda) {
//                 return;
//             }
//             test(`Ensure conda Activation command is undefined, when environment name is available for a non Conda Environment (Shell ${shellType.name})`, async () => {
//                 const conda = new Conda(TypeMoq.Mock.ofType<IServiceContainer>().object);
//                 const command = await conda.getActivationCommands({ path: '', version: '', type: interpreter.value, envName: 'nonCondaEnv' }, shellType.value);
//                 expect(command).to.be.equal(undefined, 'Invalid command');
//             });
//         });
//     });

//     EnumEx.getNamesAndValues<TerminalShellType>(TerminalShellType).forEach(shellType => {
//         test(`Ensure conda Activation command is undefined, when environment name is available for a Conda Environment (Shell ${shellType.name})`, async () => {
//             const conda = new Conda(TypeMoq.Mock.ofType<IServiceContainer>().object);
//             const command = await conda.getActivationCommands({ path: '', version: '', type: InterpreterType.Conda, envName: 'condaEnvName' }, shellType.value);
//             expect(command).to.be.equal('conda activate condaEnvName', 'Invalid command');
//         });
//     });
// });
