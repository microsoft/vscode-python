import sys
import ptvsd
import time

print('start')
sys.stdout.flush()
address = ('0.0.0.0', int(sys.argv[1]))
ptvsd.enable_attach('super_secret', address)
ptvsd.wait_for_attach()

sys.stdout.write('Peter Smith')
sys.stdout.flush()
time.sleep(0.5)

sys.stdout.write('end')
sys.stdout.flush()
time.sleep(0.5)
