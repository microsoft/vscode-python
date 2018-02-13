import random
import math

for x in range(0, 10):
    print(x)

rnd = random.Random()
print(rnd.randint(0, 5))
print(math.acos(90))

import misc
rnd2 = misc.Random()
rnd2.randint()

t = misc.Thread()
t.__init__()