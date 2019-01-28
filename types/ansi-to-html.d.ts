declare module 'ansi-to-html' {
    export = ansiToHtml;
    class ansiToHtml {
        constructor(options?: any);
        opts: any;
        stack: any;
        stickyStack: any;
        toHtml(input: any): any;
    }
}
