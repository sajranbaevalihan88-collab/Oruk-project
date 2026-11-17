"""All API routes for Oruk.AI."""
import datetime as dt

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field

from auth import get_current_user, hash_password, require_role, verify_password
from database import get_db
import services

router = APIRouter(prefix="/api")


def db_conn():
    with get_db() as conn:
        yield conn


# ------------------------------------------------------------------- schemas

class LoginIn(BaseModel):
    username: str
    password: str


class RegisterIn(BaseModel):
    username: str = Field(min_length=3, max_length=40)
    password: str = Field(min_length=6)
    full_name: str
    role: str = Field(pattern="^(farmer|buyer|admin)$")
    region: str
    phone: str = ""


class PriceReportIn(BaseModel):
    product_id: int
    region: str
    price_som: float = Field(gt=0, le=100000)


class LotIn(BaseModel):
    product_id: int
    quantity_kg: float = Field(gt=0)
    price_som: float = Field(gt=0)
    region: str
    description: str = ""
    photo_url: str = ""


class CoopIn(BaseModel):
    product_id: int
    title: str
    target_kg: float = Field(gt=0)
    min_price_som: float = 0
    deadline: str


class PledgeIn(BaseModel):
    pledged_kg: float = Field(gt=0)


class ChatIn(BaseModel):
    message: str


def user_row(u):
    return dict(u) if u is not None else None


# ---------------------------------------------------------------------- auth

@router.post("/auth/jwt/create")
def login(body: LoginIn, conn=Depends(db_conn)):
    u = conn.execute("SELECT * FROM users WHERE username=?", (body.username,)).fetchone()
    if not u or not verify_password(body.password, u["password_hash"]):
        raise HTTPException(401, "Неверный логин или пароль")
    from auth import make_token
    return {"access_token": make_token(u["id"], u["role"]), "user": user_row(u)}


@router.post("/auth/register")
def register(body: RegisterIn, conn=Depends(db_conn)):
    exists = conn.execute("SELECT id FROM users WHERE username=?", (body.username,)).fetchone()
    if exists:
        raise HTTPException(400, "Такой логин уже занят")
    if body.region not in services.REGIONS:
        raise HTTPException(400, "Неизвестный регион")
    cur = conn.execute(
        "INSERT INTO users(username,password_hash,full_name,role,region,phone) VALUES(?,?,?,?,?,?)",
        (body.username, hash_password(body.password), body.full_name, body.role, body.region, body.phone),
    )
    u = conn.execute("SELECT * FROM users WHERE id=?", (cur.lastrowid,)).fetchone()
    from auth import make_token
    return {"access_token": make_token(u["id"], u["role"]), "user": user_row(u)}


@router.get("/auth/me")
def me(conn=Depends(db_conn), authorization: str | None = Header(default=None)):
    u = get_current_user(conn, authorization)
    if not u:
        raise HTTPException(401, "Не авторизован")
    return user_row(u)


@router.get("/health")
def health():
    return {"status": "ok", "app": "oruk.ai"}


# ------------------------------------------------------------------ products

@router.get("/regions")
def regions():
    return services.REGIONS


# ------------------------------------------------------------------ products

@router.get("/products")
def products(conn=Depends(db_conn)):
    return [dict(r) for r in conn.execute("SELECT * FROM products ORDER BY category, name_ru")]


# -------------------------------------------------------------------- prices

@router.get("/prices/latest")
def prices_latest(product_id: int | None = None, region: str | None = None, conn=Depends(db_conn)):
    q = ("SELECT pr.*, p.name_ru, p.name_kg, u.full_name FROM price_reports pr "
         "JOIN products p ON p.id=pr.product_id JOIN users u ON u.id=pr.user_id WHERE 1=1")
    args = []
    if product_id:
        q += " AND pr.product_id=?"
        args.append(product_id)
    if region:
        q += " AND pr.region=?"
        args.append(region)
    q += " ORDER BY pr.reported_at DESC LIMIT 200"
    rows = conn.execute(q, args).fetchall()
    return {"reports": [dict(r) for r in rows], "fair": services.fair_price_report(rows)}


@router.get("/prices/history")
def prices_history(product_id: int, region: str | None = None, conn=Depends(db_conn)):
    q = ("SELECT reported_at, price_som FROM price_reports WHERE product_id=?")
    args = [product_id]
    if region:
        q += " AND region=?"
        args.append(region)
    rows = conn.execute(q + " ORDER BY reported_at", args).fetchall()
    series = services.monthly_series(rows)
    forecast, direction, why = services.offline_forecast(series)
    cur = series[-1][1] if series else None
    return {"series": series, "current": cur, "forecast": forecast,
            "direction": direction, "why": why}


@router.post("/prices")
def report_price(body: PriceReportIn, conn=Depends(db_conn), authorization: str | None = Header(default=None)):
    u = get_current_user(conn, authorization)
    err, u = require_role(u, "farmer", "admin")
    if err == "auth":
        raise HTTPException(401, "Не авторизован")
    if err == "forbidden":
        raise HTTPException(403, "Цену сообщают только фермеры и админ района")
    if body.region not in services.REGIONS:
        raise HTTPException(400, "Неизвестный регион")
    recent = conn.execute(
        "SELECT price_som FROM price_reports WHERE product_id=? "
        "AND reported_at >= datetime('now', '-14 days')",
        (body.product_id,),
    ).fetchall()
    outlier_err = services.outlier_check(body.price_som, recent)
    if outlier_err:
        raise HTTPException(400, outlier_err)
    cur = conn.execute(
        "INSERT INTO price_reports(user_id,product_id,region,price_som) VALUES(?,?,?,?)",
        (u["id"], body.product_id, body.region, body.price_som),
    )
    return {"id": cur.lastrowid, "ok": True}


# ---------------------------------------------------------------------- lots

@router.get("/lots")
def lots(product_id: int | None = None, region: str | None = None,
         status: str | None = None, conn=Depends(db_conn)):
    q = ("SELECT l.*, p.name_ru, p.name_kg, u.full_name AS farmer_name, u.phone AS farmer_phone "
         "FROM lots l JOIN products p ON p.id=l.product_id JOIN users u ON u.id=l.farmer_id WHERE 1=1")
    args = []
    if product_id:
        q += " AND l.product_id=?"
        args.append(product_id)
    if region:
        q += " AND l.region=?"
        args.append(region)
    if status:
        q += " AND l.status=?"
        args.append(status)
    q += " ORDER BY l.created_at DESC"
    return [dict(r) for r in conn.execute(q, args)]


@router.post("/lots")
def create_lot(body: LotIn, conn=Depends(db_conn), authorization: str | None = Header(default=None)):
    u = get_current_user(conn, authorization)
    err, u = require_role(u, "farmer")
    if err == "auth":
        raise HTTPException(401, "Не авторизован")
    if err == "forbidden":
        raise HTTPException(403, "Лоты публикуют только фермеры")
    if body.region not in services.REGIONS:
        raise HTTPException(400, "Неизвестный регион")
    cur = conn.execute(
        "INSERT INTO lots(farmer_id,product_id,quantity_kg,price_som,region,description,photo_url) "
        "VALUES(?,?,?,?,?,?,?)",
        (u["id"], body.product_id, body.quantity_kg, body.price_som, body.region,
         body.description, body.photo_url),
    )
    lot = conn.execute("SELECT * FROM lots WHERE id=?", (cur.lastrowid,)).fetchone()
    return dict(lot)


@router.post("/lots/{lot_id}/reserve")
def reserve_lot(lot_id: int, conn=Depends(db_conn), authorization: str | None = Header(default=None)):
    u = get_current_user(conn, authorization)
    err, u = require_role(u, "buyer", "admin")
    if err == "auth":
        raise HTTPException(401, "Не авторизован")
    if err == "forbidden":
        raise HTTPException(403, "Бронируют только покупатели")
    lot = conn.execute("SELECT * FROM lots WHERE id=?", (lot_id,)).fetchone()
    if not lot:
        raise HTTPException(404, "Лот не найден")
    if lot["status"] != "active":
        raise HTTPException(400, "Лот уже занят")
    conn.execute("UPDATE lots SET status='reserved', reserved_by=? WHERE id=?", (u["id"], lot_id))
    return conn.execute("SELECT * FROM lots WHERE id=?", (lot_id,)).fetchone()


# ------------------------------------------------------------------ coop

@router.get("/coop")
def coop_list(conn=Depends(db_conn)):
    rows = conn.execute(
        "SELECT c.*, p.name_ru, p.name_kg, u.full_name AS admin_name FROM coop_requests c "
        "JOIN products p ON p.id=c.product_id JOIN users u ON u.id=c.admin_id ORDER BY c.created_at DESC"
    ).fetchall()
    out = []
    for r in rows:
        d = dict(r)
        pledged = conn.execute(
            "SELECT COALESCE(SUM(pledged_kg),0) s FROM coop_members WHERE request_id=?", (r["id"],)
        ).fetchone()["s"]
        members = conn.execute(
            "SELECT cm.pledged_kg, u.full_name FROM coop_members cm JOIN users u ON u.id=cm.farmer_id "
            "WHERE request_id=?", (r["id"],)
        ).fetchall()
        d["pledged_kg"] = pledged
        d["members"] = [dict(m) for m in members]
        out.append(d)
    return out


@router.post("/coop")
def create_coop(body: CoopIn, conn=Depends(db_conn), authorization: str | None = Header(default=None)):
    u = get_current_user(conn, authorization)
    err, u = require_role(u, "admin", "farmer")
    if err == "auth":
        raise HTTPException(401, "Не авторизован")
    if err == "forbidden":
        raise HTTPException(403, "Заявку создаёт админ района")
    try:
        dt.date.fromisoformat(body.deadline)
    except ValueError:
        raise HTTPException(400, "Дедлайн в формате YYYY-MM-DD")
    cur = conn.execute(
        "INSERT INTO coop_requests(admin_id,product_id,title,target_kg,min_price_som,deadline) "
        "VALUES(?,?,?,?,?,?)",
        (u["id"], body.product_id, body.title, body.target_kg, body.min_price_som, body.deadline),
    )
    return dict(conn.execute("SELECT * FROM coop_requests WHERE id=?", (cur.lastrowid,)).fetchone())


@router.post("/coop/{request_id}/pledge")
def pledge(request_id: int, body: PledgeIn, conn=Depends(db_conn), authorization: str | None = Header(default=None)):
    u = get_current_user(conn, authorization)
    err, u = require_role(u, "farmer")
    if err == "auth":
        raise HTTPException(401, "Не авторизован")
    if err == "forbidden":
        raise HTTPException(403, "Присоединяются только фермеры")
    req = conn.execute("SELECT * FROM coop_requests WHERE id=? AND status='open'", (request_id,)).fetchone()
    if not req:
        raise HTTPException(404, "Заявка не найдена или закрыта")
    have = conn.execute(
        "SELECT COALESCE(SUM(pledged_kg),0) s FROM coop_members WHERE request_id=?", (request_id,)
    ).fetchone()["s"]
    existing = conn.execute(
        "SELECT pledged_kg FROM coop_members WHERE request_id=? AND farmer_id=?", (request_id, u["id"])
    ).fetchone()
    delta = body.pledged_kg - (existing["pledged_kg"] if existing else 0)
    if have + delta > req["target_kg"]:
        raise HTTPException(400, "Партия уже набрана")
    conn.execute(
        "INSERT INTO coop_members(request_id,farmer_id,pledged_kg) VALUES(?,?,?) "
        "ON CONFLICT(request_id,farmer_id) DO UPDATE SET pledged_kg=excluded.pledged_kg",
        (request_id, u["id"], body.pledged_kg),
    )
    total = have + delta
    if total >= req["target_kg"]:
        conn.execute("UPDATE coop_requests SET status='fulfilled' WHERE id=?", (request_id,))
    return {"ok": True, "pledged_kg": total, "target_kg": req["target_kg"]}


# ----------------------------------------------------------------- agronom

@router.post("/agronom/chat")
def agronom_chat(body: ChatIn, conn=Depends(db_conn), authorization: str | None = Header(default=None)):
    u = get_current_user(conn, authorization)
    if not u:
        raise HTTPException(401, "Не авторизован")
    conn.execute("INSERT INTO chat_messages(user_id,role,text) VALUES(?,?,?)",
                 (u["id"], "user", body.message))
    # auto-detect product/region from the question
    prods = conn.execute("SELECT * FROM products").fetchall()
    product = next((p for p in prods
                    if p["name_ru"].lower() in body.message.lower()
                    or p["name_kg"].lower() in body.message.lower()), prods[0])
    region = next((r for r in services.REGIONS if r.lower() in body.message.lower()), u["region"])
    rows = conn.execute(
        "SELECT reported_at, price_som, region, product_id FROM price_reports WHERE product_id=? ORDER BY reported_at",
        (product["id"],),
    ).fetchall()
    series = services.monthly_series([r for r in rows if r["region"] == region] or rows)
    fair_rows = services.fair_price_report(rows)
    fair = next((f["fair_price"] for f in fair_rows if f["region"] == region), None)
    context = services.build_context(product["name_ru"], region,
                                     series[-1][1] if series else None, series, fair)
    answer = services.ask_gemini(body.message, context)
    source = "gemini"
    if not answer:
        answer = services.offline_advice(body.message, product["name_ru"], region, series, series[-1][1] if series else None)
        source = "offline"
    conn.execute("INSERT INTO chat_messages(user_id,role,text) VALUES(?,?,?)",
                 (u["id"], "assistant", answer))
    return {"answer": answer, "source": source, "product": product["name_ru"], "region": region}


@router.get("/agronom/history")
def agronom_history(conn=Depends(db_conn), authorization: str | None = Header(default=None)):
    u = get_current_user(conn, authorization)
    if not u:
        raise HTTPException(401, "Не авторизован")
    rows = conn.execute(
        "SELECT role, text, created_at FROM chat_messages WHERE user_id=? ORDER BY id DESC LIMIT 40",
        (u["id"],),
    ).fetchall()
    return [dict(r) for r in reversed(rows)]


# -------------------------------------------------------------------- stats

@router.get("/stats")
def stats(conn=Depends(db_conn)):
    n_farmers = conn.execute("SELECT COUNT(*) c FROM users WHERE role='farmer'").fetchone()["c"]
    n_lots = conn.execute("SELECT COUNT(*) c FROM lots WHERE status='active'").fetchone()["c"]
    n_reports = conn.execute("SELECT COUNT(*) c FROM price_reports").fetchone()["c"]
    kg_sold = conn.execute("SELECT COALESCE(SUM(quantity_kg),0) s FROM lots WHERE status IN ('sold','reserved')").fetchone()["s"]
    return {"farmers": n_farmers, "active_lots": n_lots, "reports": n_reports, "kg_traded": kg_sold}
