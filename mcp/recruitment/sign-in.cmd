@echo off
setlocal
set "recruitmentNode=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if not exist "%recruitmentNode%" set "recruitmentNode=node"
"%recruitmentNode%" "%~dp0auth.mjs" login
pause
