import sys
import ptvsd
import time


address = ('localhost', int(sys.argv[1]))
ptvsd.enable_attach('super_secret', address)
ptvsd.wait_for_attach()

name = input()
sys.stdout.write(name)
input()
sys.stdout.write('end')
