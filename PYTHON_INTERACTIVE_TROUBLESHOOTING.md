# Trouble shooting the Python Interactive Window

This document is intended to help troubleshoot problems in the Python Interactive Window.

---
## Jupyter Not Starting
This error can happen when

* Jupyter is out of date
* Jupyter is not installed
* You picked the wrong Python environment (one that doesn't have Jupyter installed).

### The first step is to verify you are running the Python environment you want.

The Python you're using is picked with the selection dropdown on the bottom left of the VS Code window:

![selector](resources/PythonSelector.png)

### The second step is to check that jupyter isn't giving any errors on startup.

Run the following command from an environment that matches the Python you selected:
``` python -m jupyter notebook --version ```

If this command shows any warnings, you need to upgrade or fix the warnings to continue with this version of Python.
If this command says 'no module named jupyter', you need to install Jupyter.

### How to install Jupyter

You can do this in a number of different ways:

#### Anaconda

Anaconda is a popular Python distribution. It makes it super easy to get Jupyter up and running.

If you're already using Anaconda, follow these steps to get Jupyter
1. Start anaconda environment
1. Run 'conda install jupyter'
1. Restart VS Code
1. Pick the conda version of Python in the python selector

Otherwise you can install Anaconda and pick the default options
https://www.anaconda.com/download


#### Pip

You can also install Jupyter using pip.

1. python -m pip install --upgrade pip
1. python -m pip install jupyter
1. Restart VS Code
1. Pick the Python environment you did the pip install in

For more information see
http://jupyter.org/install
