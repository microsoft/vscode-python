import { ICondaLocatorService } from '../../client/interpreter/contracts';

export class MockCondaLocator implements ICondaLocatorService {
    constructor(private condaFile: string = 'conda', private available: boolean = true, private version: string = '1') { }
    public async getCondaFile(): Promise<string> {
        return this.condaFile;
    }
    public async isCondaAvailable(): Promise<boolean> {
        return this.available;
    }
    public async getCondaVersion(): Promise<string | string> {
        return this.version;
    }
}
