import { IDisposable } from '../../common/types';

export interface IDataViewerDataProvider {
    dispose(): void;
    getDataFrameInfo(): Promise<IDataFrameInfo>;
    getAllRows(): Promise<IRowsResponse>;
    getRows(start: number, end: number): Promise<IRowsResponse>;
}

export interface IDataFrameInfo {
    columns?: { key: string; type: ColumnType }[];
    indexColumn?: string;
    rowCount?: number;
}

export enum ColumnType {
    String = 'string',
    Number = 'number',
    Bool = 'bool'
}

// tslint:disable-next-line: no-any
export type IRowsResponse = any[];

export const IDataViewerFactory = Symbol('IDataViewerFactory');
export interface IDataViewerFactory {
    create(dataProvider: IDataViewerDataProvider, title: string): Promise<IDataViewer>;
}

export const IDataViewer = Symbol('IDataViewer');
export interface IDataViewer extends IDisposable {
    showData(dataProvider: IDataViewerDataProvider, title: string): Promise<void>;
}
