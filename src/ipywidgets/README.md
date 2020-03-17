# This folder is based off the the sample `web3` from https://github.com/jupyter-widgets/ipywidgets/blob/master/examples/web3

* We have built a custom solution based on `web3` sample to host ipywidgets outside of `Jupyter Notebook`.

# Solution for IPywidgets

* IPywidgets traditionally use [requirejs](https://requirejs.org).
    * `traditionally` as there seems to be some ongoing work to use `commonjs2`, though unsure how this will work with 3rd party widgets.
* Using 3rd party widgets require:
    * [requirejs](https://requirejs.org) to be available in the current browser context (i.e. `window`)
    * Base `IPywidgets` to be defined using `define` in [requirejs](https://requirejs.org).
* Rather than bundling using `amd` or `umd` its easier to just import everything using `commonjs2`, then export for `requirejs` using `define` by hand.
    * `define('xyz', () => 'a')` is a simple way of declaring a named `xyz` module with the value `a` (using `requirejs`).
    * This is generally done using tools, however we'll hand craft this as it works better and easier.
    * `amd` is not what we want, as out `react ui` doesn't use `amd`.
    * `umd` is does not work as we have multiple `entry points` in `webpack`.
    * Heres' the solution `define('@jupyter-widgets/controls', () => widgets);`
* We bundling the widget controls into our JS and exposing them for AMD using `define`
    * We could instead include `https://unpkg.com/browse/@jupyter-widgets/html-manager@0.18.3/dist/embed-amd.js`
    * However this is a 3.2MB file.
    * Then our Widget manager also needs the widget controls. That would mean widget controls get included twice, once in our bundle and the other in the above mentioned `embed-amd.js` file.
    * Solution is to include everything thats in `embed-amd.js` into our bundle.
    * The `embed-amd.js` includes source from files other than the widget controls, those include `libembed-amd.js` and `embed-amd-render.js`.
        * The source for this can be found in [scripts/concat-amd-build.js](https://github.com/jupyter-widgets/ipywidgets/blob/857bee9c15ca25bd6b47b7777e8fcd07407214cf/packages/html-manager/scripts/concat-amd-build.js#L15)
