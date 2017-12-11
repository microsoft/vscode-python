import { injectable, multiInject } from 'inversify';
import { IVirtualEnvironmentIdentifier, IVirtualEnvironmentManager } from './types';

@injectable()
export class VirtualEnvironmentManager implements IVirtualEnvironmentManager {
    constructor( @multiInject(IVirtualEnvironmentIdentifier) private envs: IVirtualEnvironmentIdentifier[]) {
    }
    public detect(pythonPath: string): Promise<IVirtualEnvironmentIdentifier | void> {
        const promises = this.envs
            .map(item => item.detect(pythonPath)
                .then(result => {
                    return { env: item, result };
                }));

        return Promise.all(promises)
            .then(results => {
                const env = results.find(items => items.result === true);
                return env ? env.env : undefined;
            });
    }
}
