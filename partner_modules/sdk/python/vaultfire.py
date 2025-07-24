"""Minimal Vaultfire Python SDK stub."""
import requests

def loyalty(user_id):
    return requests.get(f"/loyalty/{user_id}").json()

def identity(name):
    return requests.get(f"/resolve/{name}").json()

def reward(user, amount):
    return requests.post("/reward", json={"user": user, "amount": amount}).json()
