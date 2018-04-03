import sys
import time
# Give the debugger some time to add a breakpoint.
time.sleep(5)
for i in range(10000):
    time.sleep(0.5)
    print(i)

print('bye')
