"""Seed demo data: users, products, price history (the 250->25 collapse), lots, coop requests."""
import datetime as dt

from auth import hash_password
from database import get_db, init_db

PRODUCTS = [
    # фрукты
    ("Абрикос свежий", "Örük (жашыл)", "кг", "fruit"),
    ("Яблоки", "Алма", "кг", "fruit"),
    ("Груша", "Алмурут", "кг", "fruit"),
    ("Персик", "Шабдалы", "кг", "fruit"),
    ("Черешня", "Чие", "кг", "fruit"),
    ("Слива", "Кара өрүк", "кг", "fruit"),
    ("Виноград", "Жүзүм", "кг", "fruit"),
    ("Клубника", "Кулупнай", "кг", "berry"),
    # бахчевые
    ("Дыня", "Коон", "кг", "melon"),
    ("Арбуз", "Даарын", "кг", "melon"),
    # сухофрукты и орехи (специализация Баткена)
    ("Урюк (сушёный абрикос)", "Үрүк", "кг", "dried"),
    ("Курага «кандек»", "Курага «кандек»", "кг", "dried"),
    ("Курага «баргек»", "Курага «баргек»", "кг", "dried"),
    ("Изюм", "Мийиз", "кг", "dried"),
    ("Орех грецкий", "Грек жаңгак", "кг", "nut"),
    ("Фисташки", "Писта", "кг", "nut"),
    ("Миндаль", "Бадам", "кг", "nut"),
    # овощи
    ("Картофель", "Картофель", "кг", "vegetable"),
    ("Морковь", "Сабыз", "кг", "vegetable"),
    ("Капуста", "Капууста", "кг", "vegetable"),
    ("Томаты", "Помидор", "кг", "vegetable"),
    ("Огурцы", "Бадыраң", "кг", "vegetable"),
    ("Перец болгарский", "Калемпир", "кг", "vegetable"),
    ("Лук", "Пияз", "кг", "vegetable"),
    ("Чеснок", "Сарымсак", "кг", "vegetable"),
    ("Свёкла", "Кызылча", "кг", "vegetable"),
    # зерновые и бобовые
    ("Пшеница", "Буудай", "кг", "grain"),
    ("Ячмень", "Арпа", "кг", "grain"),
    ("Кукуруза", "Жүгөрү", "кг", "grain"),
    ("Рис", "Күрүч", "кг", "grain"),
    ("Фасоль", "Буурчак", "кг", "grain"),
    # молочные продукты
    ("Молоко", "Сүт", "л", "dairy"),
    ("Кымыз", "Кымыз", "л", "dairy"),
    ("Айран", "Айран", "л", "dairy"),
    ("Курут", "Курут", "кг", "dairy"),
    ("Масло сливочное (каймак)", "Сары май", "кг", "dairy"),
    # мясо
    ("Говядина", "Уй эти", "кг", "meat"),
    ("Баранина", "Кой эти", "кг", "meat"),
    ("Конина", "Жылкы эти", "кг", "meat"),
    # другое
    ("Мёд", "Бал", "кг", "honey"),
]

USERS = [
    # username, password, full_name, role, region, phone
    ("farmer_abdireim", "demo2027", "Абдиреим Узакбаев", "farmer", "Баткен", "+996 770 111-222"),
    ("farmer_aynagul", "demo2027", "Айнагуль Мавлянова", "farmer", "Кара-Бак", "+996 770 333-444"),
    ("farmer_tursunali", "demo2027", "Турсунали Толомушев", "farmer", "Баткен", "+996 770 555-666"),
    ("buyer_osh", "demo2027", "Мелис Абылкасымов (скупщик Ош)", "buyer", "Ош", "+996 555 123-456"),
    ("buyer_bishkek", "demo2027", "Айperiim Сатыбалдиева (экспорт Бишкек)", "buyer", "Бишкек", "+996 555 987-654"),
    ("admin_batken", "demo2027", "Жениш Разаков (админ района)", "admin", "Баткен", "+996 312 000-111"),
]

# Monthly history of "Абрикос свежий" in Баткен: the documented collapse 250 -> 25 som/kg
APRICOT_SERIES = [
    ("2025-09", 120), ("2025-10", 95), ("2025-11", 85), ("2025-12", 80),
    ("2026-01", 80), ("2026-02", 85), ("2026-03", 90), ("2026-04", 110),
    ("2026-05", 160), ("2026-06", 250), ("2026-07", 60), ("2026-08", 25),
]

OTHER_BASE = {
    "Картофель": 14, "Чеснок": 45, "Яблоки": 60, "Томаты": 35, "Лук": 20,
    "Курага «кандек»": 190, "Курага «баргек»": 380,
    "Груша": 50, "Персик": 55, "Черешня": 90, "Слива": 45, "Виноград": 70,
    "Клубника": 120, "Дыня": 25, "Арбуз": 18,
    "Урюк (сушёный абрикос)": 160, "Изюм": 180,
    "Орех грецкий": 250, "Фисташки": 400, "Миндаль": 350,
    "Морковь": 20, "Капуста": 22, "Огурцы": 30, "Перец болгарский": 50, "Свёкла": 18,
    "Пшеница": 18, "Ячмень": 15, "Кукуруза": 16, "Рис": 60, "Фасоль": 90,
    "Молоко": 35, "Кымыз": 90, "Айран": 40, "Курут": 120, "Масло сливочное (каймак)": 400,
    "Говядина": 380, "Баранина": 400, "Конина": 450,
    "Мёд": 500,
}


def seed():
    init_db()
    with get_db() as db:
        if db.execute("SELECT COUNT(*) c FROM users").fetchone()["c"] > 0:
            print("DB already seeded.")
            return
        # users
        ids = {}
        for username, pwd, full_name, role, region, phone in USERS:
            cur = db.execute(
                "INSERT INTO users(username,password_hash,full_name,role,region,phone) VALUES(?,?,?,?,?,?)",
                (username, hash_password(pwd), full_name, role, region, phone),
            )
            ids[username] = cur.lastrowid
        # products
        pids = {}
        for name_ru, name_kg, unit, category in PRODUCTS:
            cur = db.execute(
                "INSERT INTO products(name_ru,name_kg,unit,category) VALUES(?,?,?,?)",
                (name_ru, name_kg, unit, category),
            )
            pids[name_ru] = cur.lastrowid
        # price history: apricot collapse + noise, others mild
        rng = dt.timedelta(hours=9)  # report at 09:00
        for month, price in APRICOT_SERIES:
            day = dt.date.fromisoformat(month + "-05")
            for farmer in ("farmer_abdireim", "farmer_aynagul", "farmer_tursunali"):
                jitter = (hash(farmer + month) % 11 - 5)  # +-5 som
                db.execute(
                    "INSERT INTO price_reports(user_id,product_id,region,price_som,reported_at) VALUES(?,?,?,?,?)",
                    (ids[farmer], pids["Абрикос свежий"], "Баткен", max(price + jitter, 5),
                     f"{month}-05 09:00"),
                )
        for name_ru, base in OTHER_BASE.items():
            for i in range(1, 9):
                m = f"2026-0{i}" if i < 10 else f"2026-{i}"
                if len(m) == 7 and int(m[5:]) <= 8:
                    val = round(base * (0.9 + 0.02 * i), 1)
                    db.execute(
                        "INSERT INTO price_reports(user_id,product_id,region,price_som,reported_at) VALUES(?,?,?,?,?)",
                        (ids["farmer_abdireim"], pids[name_ru], "Баткен", val, f"{m}-05 09:00"),
                    )
        # recent reports (last 2 weeks) for fresh median
        today = dt.datetime.utcnow()
        for d_ago in (1, 3, 6, 10):
            when = (today - dt.timedelta(days=d_ago)).strftime("%Y-%m-%d %H:%M")
            db.execute(
                "INSERT INTO price_reports(user_id,product_id,region,price_som,reported_at) VALUES(?,?,?,?,?)",
                (ids["farmer_aynagul"], pids["Курага «баргек»"], "Кара-Бак", 430 + d_ago, when),
            )
            db.execute(
                "INSERT INTO price_reports(user_id,product_id,region,price_som,reported_at) VALUES(?,?,?,?,?)",
                (ids["farmer_tursunali"], pids["Картофель"], "Ош", 13.5 - d_ago * 0.1, when),
            )
        # lots
        db.execute(
            "INSERT INTO lots(farmer_id,product_id,quantity_kg,price_som,region,description,photo_url,status) "
            "VALUES(?,?,?,?,?,?,?,?)",
            (ids["farmer_abdireim"], pids["Курага «баргек»"], 500, 450, "Баткен",
             "Сорт «баргек» без косточки, сушка в тени, 1-й сбор 2026", "", "active"),
        )
        db.execute(
            "INSERT INTO lots(farmer_id,product_id,quantity_kg,price_som,region,description,photo_url,status) "
            "VALUES(?,?,?,?,?,?,?,?)",
            (ids["farmer_aynagul"], pids["Курага «кандек»"], 1000, 210, "Кара-Бак",
             "Кандек с косточкой, партия с двух садов", "", "active"),
        )
        db.execute(
            "INSERT INTO lots(farmer_id,product_id,quantity_kg,price_som,region,description,photo_url,status, reserved_by) "
            "VALUES(?,?,?,?,?,?,?,?,?)",
            (ids["farmer_tursunali"], pids["Картофель"], 2000, 14.0, "Баткен",
             "Гала, калибр 5+, мешки по 50 кг", "", "reserved", ids["buyer_osh"]),
        )
        # coop request
        db.execute(
            "INSERT INTO coop_requests(admin_id,product_id,title,target_kg,min_price_som,deadline) VALUES(?,?,?,?,?,?)",
            (ids["admin_batken"], pids["Курага «баргек»"],
             "Совместная партия баргек на экспорт в Бишкек/РФ", 5000, 420, "2026-12-15"),
        )
        db.execute(
            "INSERT INTO coop_members(request_id,farmer_id,pledged_kg) VALUES(?,?,?)",
            (1, ids["farmer_aynagul"], 1000),
        )
        db.execute(
            "INSERT INTO coop_members(request_id,farmer_id,pledged_kg) VALUES(?,?,?)",
            (1, ids["farmer_tursunali"], 800),
        )
    print(f"Seed complete: 6 users, {len(PRODUCTS)} products, ~{8 * len(PRODUCTS) + 40} price reports, 3 lots, 1 coop request.")


if __name__ == "__main__":
    seed()
