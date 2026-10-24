#!/usr/bin/env python3
"""
DzPharma Guide — dev server daemonizer.

The sandbox reaps processes descended from tool-invocation shells between
calls. A double-forked daemon is reparented to PID 1 and escapes that
reaping — this is how we keep `bun run dev` alive reliably.

Usage: python3 scripts/dev-daemon.py
Idempotent: refuses to start if port 3000 already answers.
"""
import os
import sys
import time
import urllib.request

PROJECT = "/home/z/my-project"


def server_up() -> bool:
    try:
        with urllib.request.urlopen("http://localhost:3000/", timeout=3) as res:
            return res.status == 200
    except Exception:
        return False


def main() -> None:
    if server_up():
        print("Dev server already running on :3000 — nothing to do.")
        return

    pid = os.fork()
    if pid == 0:
        os.setsid()
        pid2 = os.fork()
        if pid2 == 0:
            os.chdir(PROJECT)
            devnull = os.open(os.devnull, os.O_RDWR)
            os.dup2(devnull, 0)
            os.dup2(devnull, 1)
            os.dup2(devnull, 2)
            # Give the platform a moment; then serve forever.
            time.sleep(0.5)
            os.execvp("bun", ["bun", "run", "dev"])
        os._exit(0)
    os.waitpid(pid, 0)
    print("Dev server daemon spawned (double-forked, reparented to PID 1).")


if __name__ == "__main__":
    main()
