import { injectable } from 'inversify';
import * as path from 'path';
import { fsExistsAsync } from '../../common/utils';
import { InterpreterType } from '../contracts';
import { IVirtualEnvironmentIdentifier } from './types';

const OrigPrefixFile = 'orig-prefix.txt';

@injectable()
export class VirtualEnv implements IVirtualEnvironmentIdentifier {
    public readonly name: string = 'virtualenv';
    public readonly type = InterpreterType.VirtualEnv;
    public detect(pythonPath: string): Promise<boolean> {
        const dir = path.dirname(pythonPath);
        const origPrefixFile = path.join(dir, '..', 'lib', OrigPrefixFile);
        return fsExistsAsync(origPrefixFile);
    }
}
