"""Extract a verified-release candidate without paths or links escaping output."""
import pathlib
import sys
import tarfile
archive, destination = sys.argv[1:]
with tarfile.open(archive) as source:
    for member in source.getmembers():
        path = pathlib.PurePosixPath(member.name)
        if path.is_absolute() or '..' in path.parts or not (member.isfile() or member.isdir()):
            raise ValueError('Unsafe rollback archive member')
    source.extractall(destination)
