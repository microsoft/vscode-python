import sys
import ptvsd
import time

sys.stdout.write('start')
sys.stdout.flush()
address = ('127.0.0.1', int(sys.argv[1]))
ptvsd.enable_attach('super_secret', address)
ptvsd.wait_for_attach()

sys.stdout.write('attached')
sys.stdout.flush()

name = input()
sys.stdout.write(name)
sys.stdout.flush()
input()
sys.stdout.write('end')
sys.stdout.flush()
