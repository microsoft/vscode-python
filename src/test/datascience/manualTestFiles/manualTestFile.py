# To run this file either conda or pip install the following: jupyter, numpy, matplotlib, pandas, tqdm, bokeh, vega_datasets, altair, vega, plotly

# %% Basic Imports
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

# %% Matplotlib Plot
x = np.linspace(0, 20, 100)
plt.plot(x, np.sin(x))
plt.show()

#%% Test exception
raise Exception("<This is bracketed>")

# %% Bokeh Plot
from bokeh.io import output_notebook, show
from bokeh.plotting import figure
output_notebook()
p = figure(plot_width=400, plot_height=400)
p.circle([1,2,3,4,5], [6,7,2,4,5], size=15, line_color="navy", fill_color="orange", fill_alpha=0.5)
show(p)

# %% Progress bar
from tqdm import trange
import time
for i in trange(100):
    time.sleep(0.01)

# %% [markdown]
# # Heading
# ## Sub-heading
# *bold*,_italic_,`monospace`
# Horizontal rule
# ---
# Bullet List
# * Apples
# * Pears
# Numbered List
# 1. ???
# 2. Profit
#
# [Link](http://www.microsoft.com)

# %% Magics
%whos

# %% Some extra variable types for the variable explorer
myNparray = np.array([['Bob', 1, 2, 3], ['Alice', 4, 5, 6], ['Gina', 7, 8, 9]])
myDataFrame = pd.DataFrame(myNparray, columns=['name', 'b', 'c', 'd'])
mySeries = myDataFrame['name']
myList = [x ** 2 for x in range(0, 100000)]
myString = 'testing testing testing'

# %% Latex
%%latex
\begin{align}
\nabla \cdot \vec{\mathbf{E}} & = 4 \pi \rho \\
\nabla \times \vec{\mathbf{E}}\, +\, \frac1c\, \frac{\partial\vec{\mathbf{B}}}{\partial t} & = \vec{\mathbf{0}} \\
\nabla \cdot \vec{\mathbf{B}} & = 0
\end{align}

# %% Altair (vega)
import altair as alt
from vega_datasets import data

iris = data.iris()

alt.Chart(iris).mark_point().encode(
    x='petalLength',
    y='petalWidth',
    color='species'
)

# %% Plotly
import plotly.graph_objects as go
fig = go.Figure(data=go.Bar(y=[2, 3, 1, 5]))
fig.show()