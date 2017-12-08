import { ICondaLocatorService } from '../../client/interpreter/contracts';

export class MockCondaLocator implements ICondaLocatorService {
    constructor(private condaFile: string = 'conda') { }
    public async getCondaFile(): Promise<string> {
        return this.condaFile;
    }
}
