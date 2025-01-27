# Activate virtual environment if not already activated
if (-not ($env:VIRTUAL_ENV)) {
    .\venv\Scripts\Activate.ps1
}

# Install/update dependencies if needed
pip install -r requirements.txt

# Load environment variables from .env file
Get-Content .env | ForEach-Object {
    $name, $value = $_.split('=')
    if ($name -and $value) {
        Set-Item -Path env:$name -Value $value
    }
}

# Run uvicorn with debugpy
$env:PYTHONPATH = $PWD
python -X frozen_modules=off -m uvicorn agent:app --reload --host 0.0.0.0 --port 8000 
