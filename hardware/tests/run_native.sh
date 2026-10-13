#!/bin/sh
# Compile and run every native firmware-logic suite on the host computer.
# Run `hardware/.venv/bin/pio pkg install --project-dir hardware -e nayaka`
# first so the layout suite can read the pinned TFT_eSPI font bitmap.
set -eu
here=$(cd "$(dirname "$0")" && pwd)
font="${TFT_FONT:-$here/../.pio/libdeps/nayaka/TFT_eSPI/Fonts/glcdfont.c}"
out=$(mktemp -d)
trap 'rm -rf "$out"' EXIT
status=0
for source in "$here"/*_test.cpp; do
  name=$(basename "$source" .cpp)
  if ! c++ -std=c++17 -Wall -Wextra -Werror -O1 "$source" -o "$out/$name"; then
    echo "BUILD FAIL: $name"; status=1; continue
  fi
  if ! "$out/$name" "$font"; then
    echo "FAIL: $name"; status=1
  fi
done
exit $status
