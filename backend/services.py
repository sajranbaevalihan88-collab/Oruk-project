"""Business logic: fair price (median), offline price forecast, AI agronomist."""
import datetime as dt
import os
import statistics
from collections import defaultdict

import httpx

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.0-flash")
GEMINI_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    f"{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"
)

# All regions of Kyrgyzstan covered by Oruk.AI (oblast centers + major bazaar towns).
# Frontend keeps a synced copy: frontend/src/regions.js
REGIONS = [
    # Баткенская область
    "Баткен", "Кара-Бак", "Кызыл-Кыя", "Сүлүктү", "Айдаркен", "Кадамжай",
    # Ошская область
    "Ош", "Кара-Суу", "Узген", "Ноокат", "Араван",
    # Джалал-Абадская область
    "Жалал-Абад", "Таш-Кумүр",
    # Чуйская область
    "Бишкек", "Кант", "Токмок",
    # Таласская область
    "Талас",
    # Нарынская область
    "Нарын", "Кочкор", "Ат-Башы",
    # Иссык-Кульская область
    "Каракол", "Балыкчы", "Чолпон-Ата",
]

AGRONOM_SYSTEM_PROMPT = (
    "Ты — «Агроном», ИИ-советник платформы Oruk.AI для фермеров Кыргызстана (Баткен, Ош, Джалал-Абад). "
    "Тебе дают JSON с ценовыми данными: текущая цена, медиана региона за 14 дней, история цен по месяцам, регион, сезон. "
    "Правила: 1) Отвечай на языке вопроса (кыргызский или русский). 2) Не длиннее 120 слов, только практика. "
    "3) Всегда давай конкретную рекомендуемую цену: «Продавай по X сом/кг». 4) Если история показывает резкое падение — "
    "объясни риск перенасыщения и посоветуй хранение/сушку (курага, баргек) как способ поднять цену. "
    "5) НИКОГДА не выдумывай цены, которых нет в данных — используй только предоставленные числа. "
    "6) Закончи дисклеймером: «Совет не заменяет живой рынок — проверь свежие цены на Oruk.AI»."
)


# ---------------------------------------------------------------- fair price

def median_recent(rows):
    """Median of price reports from the last 14 days. rows: sqlite3.Row list."""
    prices = [r["price_som"] for r in rows]
    if not prices:
        return None
    return round(statistics.median(prices), 1)


def outlier_check(price, recent_rows):
    """Reject reports wildly off the market median (×10 or ÷10).

    Protects the crowd-sourced stats from typos and trolls: one report
    of 10 000 som/kg must never destroy the median and the chart.
    Returns an error message or None.
    """
    prices = [r["price_som"] for r in recent_rows]
    if len(prices) >= 2:
        med = statistics.median(prices)
        if med > 0 and (price > med * 10 or price < med / 10):
            return (f"Цена {price} сом сильно отличается от рыночной "
                    f"(медиана {round(med, 1)} сом/кг). Проверьте значение.")
    return None


def fair_price_report(reports_rows):
    """Group recent reports by product+region, compute fair (median) price."""
    groups = defaultdict(list)
    cutoff = (dt.datetime.utcnow() - dt.timedelta(days=14)).strftime("%Y-%m-%d %H:%M")
    for r in reports_rows:
        if r["reported_at"] >= cutoff:
            groups[(r["product_id"], r["region"])].append(r)
    out = []
    for (pid, region), rows in groups.items():
        out.append({
            "product_id": pid,
            "region": region,
            "fair_price": median_recent(rows),
            "n_reports": len(rows),
            "min": min(r["price_som"] for r in rows),
            "max": max(r["price_som"] for r in rows),
        })
    return out


# ------------------------------------------------------------- offline forecast

def monthly_series(rows):
    """Aggregate price reports into a sorted month -> median price series."""
    by_month = defaultdict(list)
    for r in rows:
        by_month[r["reported_at"][:7]].append(r["price_som"])
    return [(m, round(statistics.median(v), 1)) for m, v in sorted(by_month.items())]


def offline_forecast(series):
    """Simple forecast for the next weeks from a monthly median series.

    Uses: last value + linear trend over the last 3 points, damped by 0.6,
    and a seasonal nudge from the same month a year earlier (if present).
    Returns (forecast_price, direction, rationale).
    """
    if not series:
        return None, "unknown", "нет данных"
    last = series[-1][1]
    if len(series) < 3:
        return last, "flat", "мало истории — ориентируемся на последнюю цену"
    prev3 = [p for _, p in series[-3:]]
    trend = (prev3[-1] - prev3[0]) / max(len(prev3) - 1, 1)
    damped = trend * 0.6
    forecast = last + damped
    # seasonal nudge: same month last year
    cur_month = series[-1][0][5:7]
    same_month_prev = [p for m, p in series if m[5:7] == cur_month and m != series[-1][0]]
    if same_month_prev:
        seasonal = statistics.median(same_month_prev)
        forecast = 0.7 * forecast + 0.3 * seasonal
    forecast = round(max(forecast, last * 0.5), 1)
    if forecast > last * 1.05:
        direction = "up"
        why = f"тренд положительный ({trend:+.1f} сом/мес), прогноз {forecast} сом/кг"
    elif forecast < last * 0.95:
        direction = "down"
        why = f"цена падает ({trend:+.1f} сом/мес), прогноз {forecast} сом/кг — не затягивай со сдачей"
    else:
        direction = "flat"
        why = f"цена стабильна, прогноз около {forecast} сом/кг"
    return forecast, direction, why


def offline_advice(question, product_name, region, series, current):
    """Rule-based agronomist answer when the LLM is unavailable."""
    forecast, direction, why = offline_forecast(series)
    cur = current if current is not None else (series[-1][1] if series else None)
    rec = f"ориентир — {cur} сом/кг" if cur is not None else "данных пока нет"
    lines = []
    q = (question or "").lower()
    if any(w in q for w in ["храни", "суш", "кураг", "баргек"]):
        lines.append(
            f"Переработка поднимает цену: свежий {product_name} стоит у перекупщиков копейки, "
            "а сушёный (курага/баргек без косточки) — в разы дороже. Суши в тени, без прямого солнца."
        )
    elif direction == "down":
        lines.append(
            f"Цена на {product_name} ({region}) снижается: {why}. "
            "Не жди долго — сдавай перекупщику минимум по медиане, а лучше выстави лот на Oruk.AI для прямого покупателя."
        )
    elif direction == "up":
        lines.append(
            f"Есть шанс подождать: {why}. Но не держи скоропорт дольше срока хранения."
        )
    else:
        lines.append(f"Рынок стабилен. {rec} — продавай по медиане, не соглашайся на цену ниже.")
    if series and len(series) >= 2 and series[-1][1] < series[0][1] / 2:
        lines.append(
            "Внимание: за последний год цена упала более чем вдвое — это признак перенасыщения. "
            "В следующем сезоне подумай о другой культуре или о кооперации с соседями (совместная заявка на Oruk.AI)."
        )
    lines.append("Совет не заменяет живой рынок — проверь свежие цены на Oruk.AI.")
    return " ".join(lines)


# ------------------------------------------------------------------ LLM call

def build_context(product_name, region, current, series, fair):
    import json
    hist = [{"month": m, "median_som": p} for m, p in series[-12:]]
    ctx = {
        "product": product_name,
        "region": region,
        "current_price_som_kg": current,
        "fair_price_median_14d": fair,
        "monthly_history": hist,
        "season_hint": ["зима", "весна", "лето", "осень"][(dt.datetime.utcnow().month % 12) // 3],
    }
    return json.dumps(ctx, ensure_ascii=False)


def ask_gemini(question, context_json):
    if not GEMINI_API_KEY:
        return None
    payload = {
        "system_instruction": {"parts": [{"text": AGRONOM_SYSTEM_PROMPT}]},
        "contents": [{"role": "user", "parts": [{"text": "Данные:\n" + context_json + "\n\nВопрос фермера: " + question}]}],
        "generationConfig": {"temperature": 0.4, "maxOutputTokens": 400},
    }
    try:
        r = httpx.post(GEMINI_URL, json=payload, timeout=25)
        r.raise_for_status()
        data = r.json()
        return data["candidates"][0]["content"]["parts"][0]["text"].strip()
    except Exception:
        return None
