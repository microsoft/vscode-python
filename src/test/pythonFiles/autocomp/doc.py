import os

if os.path.exists(("/etc/hosts")):
    with open("/etc/hosts", "a") as f:
        for line in f.readlines():
            content = line.upper()



import time
time.slee