import { inject, injectable } from 'inversify';
import * as path from 'path';
import { IPlatformService } from '../../../../common/platform/types';
import { ICurrentProcess, IPathUtils } from '../../../../common/types';
import { IKnownSearchPathsForInterpreters } from '../../../../interpreter/contracts';
import { IServiceContainer } from '../../../../ioc/types';

@injectable()
export class KnownSearchPathsForInterpreters implements IKnownSearchPathsForInterpreters {
    constructor(@inject(IServiceContainer) private readonly serviceContainer: IServiceContainer) {}

    /**
     * Return the paths where Python interpreters might be found.
     */
    public getSearchPaths(): string[] {
        const currentProcess = this.serviceContainer.get<ICurrentProcess>(ICurrentProcess);
        const platformService = this.serviceContainer.get<IPlatformService>(IPlatformService);
        const pathUtils = this.serviceContainer.get<IPathUtils>(IPathUtils);

        const searchPaths = currentProcess.env[platformService.pathVariableName]!.split(pathUtils.delimiter)
            .map((p) => p.trim())
            .filter((p) => p.length > 0);

        if (!platformService.isWindows) {
            ['/usr/local/bin', '/usr/bin', '/bin', '/usr/sbin', '/sbin', '/usr/local/sbin'].forEach((p) => {
                searchPaths.push(p);
                searchPaths.push(path.join(pathUtils.home, p));
            });
            // Add support for paths such as /Users/xxx/anaconda/bin.
            if (process.env.HOME) {
                searchPaths.push(path.join(pathUtils.home, 'anaconda', 'bin'));
                searchPaths.push(path.join(pathUtils.home, 'python', 'bin'));
            }
        }
        return searchPaths.filter((s) => !s.includes('WindowsApps'));
    }
}
