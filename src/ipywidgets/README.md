# This folder is based off the the sample `web3` from https://github.com/jupyter-widgets/ipywidgets/blob/master/examples/web3

* We have built a custom solution based on `web3` sample to host ipywidgets outside of `Jupyter Notebook`.

# Solution for IPywidgets

* IPywidgets traditionally use [requirejs](https://requirejs.org).
    * `traditionally` as there seems to be some ongoing work to use `commonjs2`, though unsure how this will work with 3rd party widgets.
* Using 3rd party widgets require:
    * [requirejs](https://requirejs.org) to be available in the current browser context (i.e. `window`)
    * Base `IPywidgets` to be defined using `define` in [requirejs](https://requirejs.org).

