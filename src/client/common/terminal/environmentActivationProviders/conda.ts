// // Copyright (c) Microsoft Corporation. All rights reserved.
// // Licensed under the MIT License.

// import { inject, injectable } from 'inversify';
// import { InterpreterType, PythonInterpreter } from '../../../interpreter/contracts';
// import { IServiceContainer } from '../../../ioc/types';
// import { TerminalShellType } from '../types';
// import { BaseActivationCommandProvider } from './baseActivationProvider';

// @injectable()
// export class Conda extends BaseActivationCommandProvider {
//     constructor( @inject(IServiceContainer) serviceContainer: IServiceContainer) {
//         super(serviceContainer, []);
//     }
//     public isShellSupported(_targetShell: TerminalShellType): boolean {
//         return true;
//     }
//     public async getActivationCommands(interpreter: PythonInterpreter, _targetShell: TerminalShellType): Promise<string[] | undefined> {
//         return interpreter.type === InterpreterType.Conda && interpreter.envName && interpreter.envName.length > 0 ? [`conda activate ${interpreter.envName}`] : undefined;
//     }
// }
