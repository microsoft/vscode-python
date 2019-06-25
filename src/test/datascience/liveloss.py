#%%
from time import sleep
import numpy as np

from livelossplot import PlotLosses

#%%
liveplot = PlotLosses()

for i in range(10):
    liveplot.update({
        'accuracy': 1 - np.random.rand() / (i + 2.),
        'val_accuracy': 1 - np.random.rand() / (i + 0.5),
        'mse': 1. / (i + 2.),
        'val_mse': 1. / (i + 0.5)
    })
    liveplot.draw()
    sleep(1.)
