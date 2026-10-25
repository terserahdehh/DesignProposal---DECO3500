#!/bin/zsh
cd -- "${0:A:h}" || exit 1
if [[ ! -x .venv/bin/python ]]; then
  print 'Missing hardware Python environment. Follow hardware/README.md setup first.'
  read '?Press Enter to close.'
  exit 1
fi
.venv/bin/python reset_bands.py "$@"
result=$?
if (( result != 0 )); then
  read '?Press Enter to close.'
fi
exit $result
