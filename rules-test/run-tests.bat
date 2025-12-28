@echo off
echo Running Firestore Security Rules Tests...
echo ---------------------------------------

cd %~dp0
echo Current directory: %CD%

echo Copying firestore.rules from parent directory...
copy ..\firestore.rules firestore.rules /Y

echo Installing dependencies if needed...
call npm install

echo Running tests...
call npx jest

if %errorlevel% neq 0 (
  echo Tests failed with error level: %errorlevel%
  exit /b %errorlevel%
) else (
  echo All tests completed successfully!
)