export = ansi_to_html;
declare class ansi_to_html {
    constructor(options?: any);
    opts: any;
    stack: any;
    stickyStack: any;
    toHtml(input: any): any;
}
