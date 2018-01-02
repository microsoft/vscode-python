import { injectable } from 'inversify';
import * as path from 'path';
import { ITestVisitor, TestFile, TestFolder, TestFunction, TestSuite } from '../types';

@injectable()
export class TestFolderGenerationVisitor implements ITestVisitor {
    // tslint:disable-next-line:variable-name
    private _testFolders: TestFolder[] = [];
    // tslint:disable-next-line:variable-name
    private _rootTestFolders: TestFolder[] = [];
    private folderMap = new Map<string, TestFolder>();
    public get testFolders(): Readonly<TestFolder[]> {
        return [...this._testFolders];
    }
    public get rootTestFolders(): Readonly<TestFolder[]> {
        return [...this._rootTestFolders];
    }
    // tslint:disable-next-line:no-empty
    public visitTestFunction(testFunction: TestFunction): void { }
    // tslint:disable-next-line:no-empty
    public visitTestSuite(testSuite: TestSuite): void { }
    public visitTestFile(testFile: TestFile): void {
        // First get all the unique folders
        const dir = path.dirname(testFile.name);
        if (this.folderMap.has(dir)) {
            const folder = this.folderMap.get(dir)!;
            folder.testFiles.push(testFile);
            return;
        }

        dir.split(path.sep).reduce((accumulatedPath, currentName, index) => {
            let newPath = currentName;
            let parentFolder: TestFolder | undefined;
            if (accumulatedPath.length > 0) {
                parentFolder = this.folderMap.get(accumulatedPath);
                newPath = path.join(accumulatedPath, currentName);
            }
            if (!this.folderMap.has(newPath)) {
                const testFolder: TestFolder = { name: newPath, testFiles: [], folders: [], nameToRun: newPath, time: 0 };
                this.folderMap.set(newPath, testFolder);
                if (parentFolder) {
                    parentFolder.folders.push(testFolder);
                } else {
                    this._rootTestFolders.push(testFolder);
                }
                this._testFolders.push(testFolder);
            }
            return newPath;
        }, '');

        // tslint:disable-next-line:no-non-null-assertion
        this.folderMap.get(dir)!.testFiles.push(testFile);
    }
    // tslint:disable-next-line:no-empty
    public visitTestFolder(testFile: TestFolder) { }
}
