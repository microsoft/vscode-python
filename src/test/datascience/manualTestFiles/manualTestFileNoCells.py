import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

# Matplotlib Plot
x = np.linspace(0, 20, 100)
plt.plot(x, np.sin(x))
plt.show()

# Bokeh Plot
from bokeh.io import output_notebook, show
from bokeh.plotting import figure
output_notebook()
p = figure(plot_width=400, plot_height=400)
p.circle([1,2,3,4,5], [6,7,2,4,5], size=15, line_color="navy", fill_color="orange", fill_alpha=0.5)
show(p)

# Progress bar
from tqdm import trange
import time
for i in trange(100):
    time.sleep(0.01)