export declare class Graph<T> {
    private getIdentifier;
    private outgoing;
    private incoming;
    private _nodes;
    constructor(getIdentifier: (item: T) => string);
    addEdge(fromNode: T, toNode: T): void;
    readonly nodes: T[];
    topoSort(): T[];
}
