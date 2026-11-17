"""Oruk.AI backend entrypoint: FastAPI app + static frontend serving."""
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from database import init_db
import routes

app = FastAPI(title="Oruk.AI API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(routes.router)


@app.on_event("startup")
def startup():
    init_db()
    # Idempotent: seeds demo users/products/prices only when the DB is empty
    import seed_data
    seed_data.seed()


# Serve the built frontend (frontend/dist) if it exists
DIST = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
if os.path.isdir(DIST):
    app.mount("/assets", StaticFiles(directory=os.path.join(DIST, "assets")), name="assets")

    @app.get("/{path:path}")
    def spa(path: str):
        target = os.path.join(DIST, path)
        if path and os.path.isfile(target):
            return FileResponse(target)
        return FileResponse(os.path.join(DIST, "index.html"))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8020, reload=False)
