"""End-to-end API tests run directly through the ASGI stack (no server needed)."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from fastapi.testclient import TestClient

import database
import seed_data
from main import app

TEST_DB = os.path.join(os.path.dirname(os.path.abspath(__file__)), "test_oruk.db")
os.environ["ORUK_SECRET"] = "test-secret"


@pytest.fixture(scope="module")
def client():
    database.DB_PATH = TEST_DB
    if os.path.exists(TEST_DB):
        os.remove(TEST_DB)
    seed_data.seed()
    with TestClient(app) as c:
        yield c
    os.remove(TEST_DB)


def login(client, username, password="demo2027"):
    r = client.post("/api/auth/jwt/create", json={"username": username, "password": password})
    assert r.status_code == 200
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200 and r.json()["status"] == "ok"


def test_auth_and_me(client):
    h = login(client, "farmer_abdireim")
    me = client.get("/api/auth/me", headers=h)
    assert me.status_code == 200
    assert me.json()["role"] == "farmer"


def test_guest_cannot_report_price(client):
    products = client.get("/api/products").json()
    r = client.post("/api/prices", json={"product_id": products[0]["id"], "region": "Баткен", "price_som": 30})
    assert r.status_code == 401


def test_buyer_cannot_report_price_403(client):
    h = login(client, "buyer_osh")
    products = client.get("/api/products").json()
    r = client.post("/api/prices", headers=h, json={"product_id": products[0]["id"], "region": "Баткен", "price_som": 30})
    assert r.status_code == 403


def test_farmer_reports_price(client):
    h = login(client, "farmer_abdireim")
    products = client.get("/api/products").json()
    apricot = next(p for p in products if p["name_ru"] == "Абрикос свежий")
    r = client.post("/api/prices", headers=h, json={"product_id": apricot["id"], "region": "Баткен", "price_som": 27})
    assert r.status_code == 200


def test_fair_price_median(client):
    products = client.get("/api/products").json()
    apricot = next(p for p in products if p["name_ru"] == "Абрикос свежий")
    r = client.get("/api/prices/history", params={"product_id": apricot["id"], "region": "Баткен"})
    body = r.json()
    assert body["series"][0][1] > body["series"][-1][1]  # the collapse: 120 -> 25
    assert body["direction"] in ("up", "down", "flat")


def test_lots_flow(client):
    h = login(client, "farmer_aynagul")
    products = client.get("/api/products").json()
    apricot = next(p for p in products if p["name_ru"] == "Абрикос свежий")
    r = client.post("/api/lots", headers=h, json={
        "product_id": apricot["id"], "quantity_kg": 300, "price_som": 28,
        "region": "Кара-Бак", "description": "тест"})
    assert r.status_code == 200
    lot_id = r.json()["id"]
    hb = login(client, "buyer_bishkek")
    r = client.post(f"/api/lots/{lot_id}/reserve", headers=hb)
    assert r.status_code == 200 and r.json()["status"] == "reserved"
    # double reserve fails
    r = client.post(f"/api/lots/{lot_id}/reserve", headers=hb)
    assert r.status_code == 400
    # farmer cannot reserve
    r = client.post("/api/lots", headers=h, json={
        "product_id": apricot["id"], "quantity_kg": 1, "price_som": 1,
        "region": "Баткен", "description": "x"})
    r = client.post("/api/coop")


def test_coop_pledge_and_fulfill(client):
    ha = login(client, "admin_batken")
    products = client.get("/api/products").json()
    bargel = next(p for p in products if p["name_ru"] == "Курага «баргек»")
    r = client.post("/api/coop", headers=ha, json={
        "product_id": bargel["id"], "title": "Тест партия", "target_kg": 100,
        "min_price_som": 420, "deadline": "2027-01-31"})
    assert r.status_code == 200
    coop_id = r.json()["id"]
    hf = login(client, "farmer_tursunali")
    r = client.post(f"/api/coop/{coop_id}/pledge", headers=hf, json={"pledged_kg": 60})
    assert r.status_code == 200
    # re-pledge by the same farmer replaces (60 -> 40)
    r = client.post(f"/api/coop/{coop_id}/pledge", headers=hf, json={"pledged_kg": 40})
    assert r.status_code == 200
    # a second farmer joins: 40 + 60 = 100 -> fulfilled
    hf2 = login(client, "farmer_abdireim")
    r = client.post(f"/api/coop/{coop_id}/pledge", headers=hf2, json={"pledged_kg": 60})
    assert r.status_code == 200
    lst = client.get("/api/coop").json()
    coop = next(c for c in lst if c["id"] == coop_id)
    assert coop["status"] == "fulfilled" and coop["pledged_kg"] >= 100


def test_agronom_offline_answer(client):
    h = login(client, "farmer_abdireim")
    r = client.post("/api/agronom/chat", headers=h,
                    json={"message": "Сейчас продавать абрикос или подождать?"})
    assert r.status_code == 200
    body = r.json()
    assert body["source"] in ("gemini", "offline")
    assert "сом" in body["answer"] or "рынок" in body["answer"]


def test_kg_language_answer(client):
    h = login(client, "farmer_aynagul")
    r = client.post("/api/agronom/chat", headers=h,
                    json={"message": "Кураганы азыр сатуу керекпи?"})
    assert r.status_code == 200


def test_stats(client):
    r = client.get("/api/stats")
    assert r.status_code == 200
    assert r.json()["farmers"] == 3
