# Purpose of the bootstrap extension
* Haven't found a way to pass command line arguments to VSC when using selenium.
* We need to open a workspace folder when launching VSC.
* As we cannot (don't yet know) do this via CLI, the approach is simple:
    * Create a simple extension that will activate when VSC loads
    * Look for a file that contains the path to the workspace folder that needs to be opened.
    * Next use VSC API to re-load VSC by opening that folder.

* Hacky, but it works, at least until we know how to pass CLI args when using `selenium`
