#!/bin/zsh
# Double-click this file on macOS to open the laptop R reset controller.
reset_dir=${0:A:h}
exec "$reset_dir/.venv/bin/python" "$reset_dir/start_table_tracking.py" --separation-cm 30 --interactive
