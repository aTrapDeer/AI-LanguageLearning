# Create virtual environment
python -m venv venv

# Activate virtual environment
.\venv\Scripts\Activate.ps1

# Upgrade pip
python -m pip install --upgrade pip

# Install requirements
pip install -r requirements.txt

Write-Host "Virtual environment setup complete. Run 'python -m debugpy --listen 5678 --wait-for-client agent.py' to start the server in debug mode." 