
declare module 'svg-to-pdfkit' {
    export = SVGtoPDF;
    function SVGtoPDF(doc: any, svg: string, x: number, y: number, options?: any): void;
}