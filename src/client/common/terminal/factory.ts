import { inject, injectable } from 'inversify';
import { IServiceContainer } from '../../ioc/types';
import { IPlatformService } from '../platform/types';
import { TerminalService } from './service';
import { ITerminalService, ITerminalServiceFactory } from './types';

@injectable()
export class TerminalServiceFactory implements ITerminalServiceFactory {
    private terminalServices: Map<string, ITerminalService>;

    constructor( @inject(IServiceContainer) private serviceContainer: IServiceContainer,
        @inject(ITerminalService) private defaultTerminalService: ITerminalService,
        @inject(IPlatformService) private platformService: IPlatformService) {

        this.terminalServices = new Map<string, ITerminalService>();
    }
    public getTerminalService(title?: string): ITerminalService {
        if (typeof title !== 'string' || title.trim().length === 0) {
            return this.defaultTerminalService;
        }
        if (!this.terminalServices.has(title)) {
            const terminalService = new TerminalService(this.serviceContainer, this.platformService, title);
            this.terminalServices.set(title, terminalService);
        }
        return this.terminalServices.get(title)!;
    }
}
