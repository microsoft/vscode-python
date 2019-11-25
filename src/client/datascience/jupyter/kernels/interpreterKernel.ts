// // Copyright (c) Microsoft Corporation. All rights reserved.
// // Licensed under the MIT License.

// 'use strict';

// import { inject, unmanaged } from 'inversify';
// import { IInstaller } from '../../../common/types';
// import { IInterpreterService, PythonInterpreter } from '../../../interpreter/contracts';

// export class InterprterKernelFactory {
//     constructor(@inject(IInterpreterService) private readonly interprterService: IInterpreterService) {}
//     /**
//      * Gets the Interpreter Kernel Service for a given Interpreter.
//      *
//      * @param {({pythonPath: string} | {interpreter: PythonInterpreter})} [interpreter]
//      * @returns {Promise<InterpreterKernelService>}
//      * @memberof InterprterKernelFactory
//      */
//     public async createInterpreterKernelService(interpreter?: { pythonPath: string } | { interpreter: PythonInterpreter }): Promise<InterpreterKernelService> {
//         let interpreterToUse: PythonInterpreter | undefined;
//         if (!interpreter) {
//             interpreterToUse = await this.interprterService.getActiveInterpreter(undefined);
//         } else if ('pythonPath' in interpreter) {
//             interpreterToUse = await this.interprterService.getInterpreterDetails(interpreter.pythonPath);
//         } else {
//             interpreterToUse = interpreter.interpreter;
//         }

//         if (!interpreterToUse) {
//             throw new Error('Unable to determine interpreter to use');
//         }

//         return new InterpreterKernelService(interpreterToUse);
//     }
// }

// /**
//  * Class that manages kernels for a specific interpreter.
//  *
//  * @export
//  * @class InterpreterKernelService
//  */
// export class InterpreterKernelService {
//     constructor(@unmanaged() private readonly interpreter: PythonInterpreter, @inject(IInstaller) private readonly installer: IInstaller) {}

//     public isIPyKernelInstalled(): Promise<boolean> {
//         return this.installer.isInstalled()
//     }
//     public installIPyKernel(): Promise<void> {}
//     public registerAsKernel(): Promise<void> {}
// }
