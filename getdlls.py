import os
import sys
import shutil
import subprocess as sub
from zipfile import ZipFile 
from distutils.util import get_platform

try:
    from urllib.request import urlopen # Python 3.x
except ImportError:
    from urllib2 import urlopen # Python 2


libraries = ['SDL2', 'SDL2_mixer', 'SDL2_ttf', 'SDL2_image', 'SDL2_gfx']

sdl2_urls = {
    'macOS': {
        'SDL2': 'https://www.libsdl.org/release/SDL2-2.0.10.dmg',
        'SDL2_mixer': 'https://www.libsdl.org/projects/SDL_mixer/release/SDL2_mixer-2.0.4.dmg',
        'SDL2_ttf': 'https://www.libsdl.org/projects/SDL_ttf/release/SDL2_ttf-2.0.15.dmg',
        'SDL2_image': 'https://www.libsdl.org/projects/SDL_image/release/SDL2_image-2.0.5.dmg',
        'SDL2_gfx': 'https://github.com/a-hurst/sdl2gfx-builds/releases/download/1.0.4/SDL2_gfx-1.0.4.dmg'
    },
    'win32': {
        'SDL2': 'https://www.libsdl.org/release/SDL2-2.0.10-win32-x86.zip',
        'SDL2_mixer': 'https://www.libsdl.org/projects/SDL_mixer/release/SDL2_mixer-2.0.4-win32-x86.zip',
        'SDL2_ttf': 'https://www.libsdl.org/projects/SDL_ttf/release/SDL2_ttf-2.0.15-win32-x86.zip',
        'SDL2_image': 'https://www.libsdl.org/projects/SDL_image/release/SDL2_image-2.0.5-win32-x86.zip',
        'SDL2_gfx': 'https://github.com/a-hurst/sdl2gfx-builds/releases/download/1.0.4/SDL2_gfx-1.0.4-win32-x86.zip'
    },
    'win64': {
        'SDL2': 'https://www.libsdl.org/release/SDL2-2.0.10-win32-x64.zip',
        'SDL2_mixer': 'https://www.libsdl.org/projects/SDL_mixer/release/SDL2_mixer-2.0.4-win32-x64.zip',
        'SDL2_ttf': 'https://www.libsdl.org/projects/SDL_ttf/release/SDL2_ttf-2.0.15-win32-x64.zip',
        'SDL2_image': 'https://www.libsdl.org/projects/SDL_image/release/SDL2_image-2.0.5-win32-x64.zip',
        'SDL2_gfx': 'https://github.com/a-hurst/sdl2gfx-builds/releases/download/1.0.4/SDL2_gfx-1.0.4-win32-x64.zip'
    }
}


def getDLLs(platform_name):
    
    dlldir = os.path.join('sdl2dll', 'dll')
    licensedir = os.path.join('sdl_licenses')
    for d in ['temp', 'build', dlldir, licensedir]:
        if os.path.isdir(d):
            shutil.rmtree(d)
        os.mkdir(d)

    # Generate license disclaimer for SDL2 libraries (all under zlib)
    sdl_licensepath = os.path.join(licensedir, 'LICENSE.SDL2.txt')
    with open(sdl_licensepath, 'w') as l:
        l.write("SDL2 License Info\n---\n\n")
        l.write("SDL2, SDL2_mixer, SDL2_ttf, SDL2_image, and SDL2_gfx are all distributed\n")
        l.write("under the terms of the zlib license: http://www.zlib.net/zlib_license.html\n")
    
    if 'macosx' in platform_name:
        
        for lib in libraries:
            
            mountpoint = '/tmp/' + lib
            dllname = lib + '.framework'
            dllpath = os.path.join(mountpoint, dllname)
            dlloutpath = os.path.join(dlldir, dllname)
            
            # Download disk image containing library
            dmg = urlopen(sdl2_urls['macOS'][lib])
            outpath = os.path.join('temp', lib + '.dmg')
            with open(outpath, 'wb') as out:
                out.write(dmg.read())
            
            # Mount image, extract framework, then unmount
            sub.check_call(['hdiutil', 'attach', outpath, '-mountpoint', mountpoint])
            shutil.copytree(dllpath, dlloutpath, symlinks=True, ignore=find_symlinks)
            sub.call(['hdiutil', 'unmount', mountpoint])

            # Extract license info from frameworks bundled within main framework
            extraframeworkpath = os.path.join(dlloutpath, 'Versions', 'A', 'Frameworks')
            if os.path.exists(extraframeworkpath):
                for f in os.listdir(extraframeworkpath):
                    resourcepath = os.path.join(extraframeworkpath, f, 'Versions', 'A', 'Resources')
                    if os.path.exists(resourcepath):
                        for name in os.listdir(resourcepath):
                            if 'LICENSE' in name:
                                licensepath = os.path.join(resourcepath, name)
                                outpath = os.path.join(licensedir, name)
                                shutil.copyfile(licensepath, outpath)

    elif platform_name in ['win32', 'win-amd64']:
        
        arch = 'win64' if platform_name == 'win-amd64' else 'win32'
        
        for lib in libraries:
            
            # Download zip archive containing library
            dllzip = urlopen(sdl2_urls[arch][lib])
            outpath = os.path.join('temp', lib + '.zip')
            with open(outpath, 'wb') as out:
                out.write(dllzip.read())
            
            # Extract dlls and license files from archive
            with ZipFile(outpath, 'r') as z:
                for name in z.namelist():
                    if name[-4:] == '.dll':
                        z.extract(name, dlldir)
                    elif 'LICENSE' in name:
                        z.extract(name, licensedir)
                        
    else:

        # Create dummy file indicating that SDL2 binaries are not available on this platform
        dummyfile = os.path.join(dlldir, '.unsupported')
        with open(dummyfile, 'w') as f:
            f.write("No dlls available for this platform!")

        # Remove unneeded license file
        os.remove(sdl_licensepath)

    shutil.rmtree('temp')


def find_symlinks(path, names):
    """'ignore' filter for shutil.copytree that identifies whether files are
    symlinks or not. For excluding symlinks when copying .frameworks, since
    they're not needed for pysdl2 and Python wheels don't support them.
    """
    links = []
    for f in os.listdir(path):
        filepath = os.path.join(path, f)
        if os.path.islink(filepath):
            links.append(f)
        # Some frameworks have useless duplicates instead of symlinks, so ignore those too
        elif '.framework' in os.path.basename(path) and f != 'Versions':
            links.append(f)
        elif os.path.basename(path) == 'Versions' and f != 'A':
            links.append(f)

    return links


if __name__ == '__main__':
    getDLLs(get_platform())
                