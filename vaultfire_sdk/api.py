"""Flask app loader for Vaultfire SDK."""
from onboarding_api import app

def create_app():
    """Return the Flask app with all Vaultfire API routes."""
    return app

if __name__ == "__main__":
    app.run()
