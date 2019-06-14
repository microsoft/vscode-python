#%%
import matplotlib.pyplot as plt
from sklearn.cluster import KMeans
from sklearn import datasets

#%%
data = datasets.load_iris().data[:,2:4]
petal_length, petal_width = data[:,0], data[:,1]
print("Average petal length: %3f" % (sum(petal_length) / len(petal_length)),)

#%%
plt.subplot(1,2,1)
plt.hist(petal_length)
plt.subplot(1,2,2)
plt.hist(petal_width)
plt.show()

#%%
clusters = KMeans(n_clusters=2).fit(data).labels_
plt.scatter(petal_length, petal_width, c=clusters)
plt.show()

#%%


#%%
