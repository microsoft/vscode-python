# Hosting ipywidgets in non-notebook context

-   Much of the work is influenced by sample `web3` from https://github.com/jupyter-widgets/ipywidgets/blob/master/examples/web3
-   Displaying `ipywidgets` in non notebook context requires 3 things:
    -   [requirejs](https://requirejs.org)
    -   [HTML Manager](https://github.com/jupyter-widgets/ipywidgets/blob/master/examples/web3/src/manager.ts)
    -   Live Kerne (the widget manager plugs directly into the `kernel` messages to read/write and build data for displaying the data)

# Kernel

-   As the kernel connection is only available in back end (`extension code`), the HTML manager will not work.
-   To get this working, all we need to do is create a `proxy kernel` connection in the `react` layer.
-   Thats what the code in this folder does (wraps the html manager + custom kernel connection)
-   Kernel messages from the extension are sent to this layer using the `postoffice`
-   Similarly messages from sent from html manager via the kernel are sent to the actual kernel via the postoffice.
-   However, the sequence and massaging of the kernel messages requires a lot of work. Basically majority of the message processing from `/node_modules/@jupyterlab/services/lib/kernel/*.js`
    -   Much of the message processing logic is borrowed from `comm.js`, `default.js`, `future.js`, `kernel.js` and `manager.js`.
