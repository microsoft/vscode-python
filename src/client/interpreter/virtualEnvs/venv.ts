import { injectable } from 'inversify';
import * as path from 'path';
import 'reflect-metadata';
import { fsExistsAsync } from '../../common/utils';
import { InterpreterType } from '../contracts';
import { IVirtualEnvironmentIdentifier } from './types';

const pyEnvCfgFileName = 'pyvenv.cfg';

@injectable()
export class VEnv implements IVirtualEnvironmentIdentifier {
    public readonly name: string = 'venv';
    public readonly type = InterpreterType.VEnv;
    public detect(pythonPath: string): Promise<boolean> {
        const dir = path.dirname(pythonPath);
        const pyEnvCfgPath = path.join(dir, '..', pyEnvCfgFileName);
        return fsExistsAsync(pyEnvCfgPath);
    }
}
