"""Windows current-user DPAPI; session plaintext travels only over private pipes."""
import ctypes
from ctypes import wintypes
import sys


class Blob(ctypes.Structure):
    _fields_ = [("size", wintypes.DWORD), ("data", ctypes.POINTER(ctypes.c_byte))]


def transform(value, decrypt):
    buffer = ctypes.create_string_buffer(value)
    source = Blob(len(value), ctypes.cast(buffer, ctypes.POINTER(ctypes.c_byte)))
    target = Blob()
    crypt = ctypes.WinDLL("crypt32", use_last_error=True)
    kernel = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel.LocalFree.argtypes = [ctypes.c_void_p]
    kernel.LocalFree.restype = ctypes.c_void_p
    if decrypt:
        ok = crypt.CryptUnprotectData(ctypes.byref(source), None, None, None, None, 1, ctypes.byref(target))
    else:
        ok = crypt.CryptProtectData(ctypes.byref(source), "TalentFlow recruiter MCP", None, None, None, 1, ctypes.byref(target))
    if not ok:
        raise OSError("Current-user session protection failed")
    try:
        return ctypes.string_at(target.data, target.size)
    finally:
        kernel.LocalFree(ctypes.cast(target.data, ctypes.c_void_p))


if __name__ == "__main__":
    try:
        decrypt = sys.argv[1] == "decrypt"
        incoming = sys.stdin.buffer.read()
        result = transform(bytes.fromhex(incoming.decode("ascii")) if decrypt else incoming, decrypt)
        sys.stdout.buffer.write(result if decrypt else result.hex().encode("ascii"))
    except Exception:
        sys.stderr.write("Unable to access the current OS user's encrypted recruitment session (Windows error %s).\n" % ctypes.get_last_error())
        sys.exit(1)
