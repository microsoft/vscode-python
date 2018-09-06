import { inject, injectable } from 'inversify';
import * as _ from 'lodash';
import * as path from 'path';
import { Uri } from 'vscode';
import { fsExistsAsync } from '../../../../utils/fs';
import { IS_WINDOWS } from '../../../common/util';
import { IServiceContainer } from '../../../ioc/types';
import { IInterpreterHelper, IKnownSearchPathsForInterpreters, InterpreterType, PythonInterpreter } from '../../contracts';
import { lookForInterpretersInDirectory } from '../helpers';
import { CacheableLocatorService } from './cacheableLocatorService';

// tslint:disable-next-line:no-require-imports no-var-requires
const untildify = require('untildify');

/**
 * Locates "known" paths.
 */
@injectable()
export class KnownPathsService extends CacheableLocatorService {
    public constructor(
        @inject(IKnownSearchPathsForInterpreters) private knownSearchPaths: string[],
        @inject(IInterpreterHelper) private helper: IInterpreterHelper,
        @inject(IServiceContainer) serviceContainer: IServiceContainer
    ) {
        super('KnownPathsService', serviceContainer);
    }

    /**
     * Release any held resources.
     *
     * Called by VS Code to indicate it is done with the resource.
     */
    // tslint:disable-next-line:no-empty
    public dispose() { }

    /**
     * Return the located interpreters.
     *
     * This is used by CacheableLocatorService.getInterpreters().
     */
    protected getInterpretersImplementation(resource?: Uri): Promise<PythonInterpreter[]> {
        return this.suggestionsFromKnownPaths();
    }

    /**
     * Return the located interpreters.
     */
    private suggestionsFromKnownPaths() {
        const promises = this.knownSearchPaths.map(dir => this.getInterpretersInDirectory(dir));
        return Promise.all<string[]>(promises)
            // tslint:disable-next-line:underscore-consistent-invocation
            .then(listOfInterpreters => _.flatten(listOfInterpreters))
            .then(interpreters => interpreters.filter(item => item.length > 0))
            .then(interpreters => Promise.all(interpreters.map(interpreter => this.getInterpreterDetails(interpreter))))
            .then(interpreters => interpreters.filter(interpreter => !!interpreter).map(interpreter => interpreter!));
    }

    /**
     * Return the information about the identified interpreter binary.
     */
    private async getInterpreterDetails(interpreter: string) {
        const details = await this.helper.getInterpreterInformation(interpreter);
        if (!details) {
            return;
        }
        return {
            ...(details as PythonInterpreter),
            path: interpreter,
            type: InterpreterType.Unknown
        };
    }

    /**
     * Return the interpreters in the given directory.
     */
    private getInterpretersInDirectory(dir: string) {
        return fsExistsAsync(dir)
            .then(exists => exists ? lookForInterpretersInDirectory(dir) : Promise.resolve<string[]>([]));
    }
}

/**
 * Return the paths where Python interpreters might be found.
 */
export function getKnownSearchPathsForInterpreters(): string[] {
    if (IS_WINDOWS) {
        return [];
    } else {
        const paths = ['/usr/local/bin', '/usr/bin', '/bin', '/usr/sbin', '/sbin', '/usr/local/sbin'];
        paths.forEach(p => {
            paths.push(untildify(`~${p}`));
        });
        // Add support for paths such as /Users/xxx/anaconda/bin.
        if (process.env.HOME) {
            paths.push(path.join(process.env.HOME, 'anaconda', 'bin'));
            paths.push(path.join(process.env.HOME, 'python', 'bin'));
        }
        return paths;
    }
}
