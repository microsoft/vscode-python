// Slickgrid requires jquery to be defined. Globally. So we do some hacks here.
// tslint:disable-next-line: no-var-requires no-require-imports
require('expose-loader?jQuery!slickgrid/lib/jquery-1.11.2.min');
// tslint:disable-next-line: no-var-requires no-require-imports
require('expose-loader?jQuery.fn.drag!slickgrid/lib/jquery.event.drag-2.3.0');

import 'slickgrid/slick.core';
import 'slickgrid/slick.dataview';
import 'slickgrid/slick.grid';

import 'slickgrid/plugins/slick.autotooltips';

import 'slickgrid/slick.grid.css';

export function createSlickGrid<T extends Slick.SlickData>() {
    class ExtendGrid extends Slick.Grid<T> {
        constructor(
            container: string|HTMLElement|JQuery,
            data: T[]|Slick.DataProvider<T>,
            columns: Slick.Column<T>[],
            options: Slick.GridOptions<T>) {
                super(container, data, columns, options);

                // tslint:disable-next-line: no-any
                const anyGrid = this as any;
            }

        public internalNavigate(): boolean {
            // tslint:disable-next-line: no-any
            const anyGrid = this as any;
            anyGrid.navigate('up');
            anyGrid.eval('navigate("up")');
            return true;
        }
    }

    return ExtendGrid;
}
//export function createJupyterWebSocket(cookieString?: string, allowUnauthorized?: boolean) {
    //class JupyterWebSocket extends WebSocketWS {
        //constructor(url: string, protocols?: string | string[] | undefined) {
            //let co: WebSocketWS.ClientOptions = {};

            //if (allowUnauthorized) {
                //co = {...co, rejectUnauthorized: false};
            //}

            //if (cookieString) {
                //co = {...co, headers: {
                    //Cookie: cookieString
                //}};
            //}

            //super(url, protocols, co);
        //}
    //}
    //return JupyterWebSocket;
//}
//interface IExtendedGrid {
    //internalNavigate(): boolean;
//}

//export class ExtendGrid<T extends Slick.SlickData> extends Slick.Grid<T> implements IExtendedGrid {
    ////public internalNavigate: () => boolean;

    //constructor(
        //container: string|HTMLElement|JQuery,
        //data: T[]|Slick.DataProvider<T>,
        //columns: Slick.Column<T>[],
        //options: Slick.GridOptions<T>) {

            //Slick.Grid.prototype.internalNavigate = function() { return false; };

            //super(container, data, columns, options);
            ////this.internalNavigate = function () {
                ////// tslint:disable-next-line: no-any
                //////(this as any).navigate('down');
                ////// tslint:disable-next-line: no-any
                ////const anyGrid = (this as any);
                ////anyGrid.navigate('down');
                ////return true;
            ////};
        //}

    //public internalNavigate(): boolean {
        //return
    //}
    ////public internalNavigate() {
        ////// tslint:disable-next-line: no-any
        ////(this as any).navigate('down');
    ////}
//}
