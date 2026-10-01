"""Convert MM:SS or H:MM:SS timestamps to total seconds."""

import sys


def ts_to_seconds(timestamp: str) -> int:
    parts = timestamp.strip().split(":")
    if len(parts) == 2:
        m, s = parts
        return int(m) * 60 + int(s)
    elif len(parts) == 3:
        h, m, s = parts
        return int(h) * 3600 + int(m) * 60 + int(s)
    else:
        raise ValueError(f"Invalid timestamp format: {timestamp!r}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(f"Usage: python {sys.argv[0]} \"MM:SS\" or \"H:MM:SS\"")
        sys.exit(1)
    print(ts_to_seconds(sys.argv[1]))
