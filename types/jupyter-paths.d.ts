declare module 'jupyter-paths' {}

interface JupyterPathsOptions {}
export function runtimeDir(opts?: JupyterPathsOptions): string;
