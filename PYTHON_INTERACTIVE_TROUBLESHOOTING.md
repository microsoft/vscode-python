# Trouble shooting the Python Interactive Window

This document is intended to help troubleshoot problems in the Python Interactive Window.

---
## Jupyter Not Installed
This error can happen when you 

* Don't have Jupyter installed
* Have picked the wrong Python environment (one that doesn't have Jupyter installed).

### The first step is to verify you are running the Python environment you want. 

You can do this by either selecting it in the dropdown at the bottom of VS Code:

![selector](resources/PythonSelector.png)

Or by running some Python code in VS Code Python terminal:
```python
import sys
sys.version
```

### The second step (if changing the Python version doesn't work) is to install Jupyter

You can do this in a number of different ways:

#### Anaconda

Anaconda is a popular Python distribution. It makes it super easy to get Jupyter up and running. 

If you're already using Anaconda, follow these steps to get jupyter
1. Start anaconda environment
1. Run 'conda install jupyter'
1. Restart VS Code
1. Pick the conda version of Python in the python selector

Otherwise you can install Anaconda and pick the default options
https://www.anaconda.com/download


#### Pip

You can also install Jupyter using pip. This is a little more work because you have to specify a number of sub packages too

1. python -m pip install jupyter
1. python -m pip install notebook
1. python -m pip install nbconvert
1. Restart VS Code
1. Pick the Python environment you did the pip install in
