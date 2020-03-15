export interface Notebook {
    cells: Cell[];
}
export interface Cell {
    cell_type: 'code' | 'markdown';
    execution_count: number;
    source: string[];
}
export declare function cellCode(nb: Notebook): string[];
export declare const vvNotebook: Notebook;
export declare const titanicNotebook: Notebook;
export declare const titanicNotebook2: Notebook;
export declare const pimaNotebook: Notebook;
export declare const evalModelsNotebook: Notebook;
export declare const evalModelsExpectedNotebook: Notebook;
export declare const featureEngineeringNotebook: Notebook;
export declare const featureEngineeringExpectedNotebook: Notebook;
