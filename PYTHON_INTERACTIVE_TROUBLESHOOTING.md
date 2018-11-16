# Trouble shooting the Python Interactive Window

This document is intended to help troubleshoot problems in the Python Interactive Window.

---
## Jupyter Not Installed
This error can happen when you 

* Don't have Jupyter installed
* Have picked the wrong Python environment (one that doesn't have Jupyter installed).

### The first step is to verify you are running the Python environment you want. 

The python you're using is picked with this selection dropdown on the bottom left of the VS Code window:

![selector](resources/PythonSelector.png)

You can verify this python version has jupyter by running the command 'Python: REPL' from the command palette
and then attempting to run the following code in the terminal that opens:

```python
import jupyter_core
import notebook
jupyter_core.version_info
notebook.version_info
```
If any of those commands fail, the python you have selected doesn't support launch jupyter notebooks.

Errors you'd get would be something like:

```
>>> import jupyter
Traceback (most recent call last):
  File "<stdin>", line 1, in <module>
ImportError: No module named jupyter
>>> import notebook
Traceback (most recent call last):
  File "<stdin>", line 1, in <module>
ImportError: No module named notebook
>>>
```

### The second step (if changing the Python version doesn't work) is to install Jupyter

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
