@echo off
setlocal enabledelayedexpansion
set target_folder=.\processed

echo Deleting files from the target folder...
del /s /q "%target_folder%\*"

echo Files deleted!
exit