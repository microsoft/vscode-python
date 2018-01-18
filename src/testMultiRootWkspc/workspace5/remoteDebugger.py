import sys
import ptvsd
import time

sys.stdout.write('start')
sys.stdout.flush()
address = ('0.0.0.0', int(sys.argv[1]))
ptvsd.enable_attach('super_secret', address)
ptvsd.wait_for_attach()

sys.stdout.write(name)
sys.stdout.flush()

sys.stdout.write('end')
sys.stdout.flush()
