# Notes:

* Why do have delays of >= 120 seconds when using LS.
    * 1. This is to provide LS sufficient time to analyze the entire workspace.
    * E.g. when using a `conda` environment, LS takes a long time to complete analysis.
    * This results in delays in responsiveness of LS, i.e. features such as `intellisense`, `code navigation`, etc might not be ready or won't respond in time.
    * To determine whether the LS has completed analysis, we ensure the statusbar item `Analyzing in background` is no longer visible.
    * 2. Also, it takes time to download & extract the Language Server
