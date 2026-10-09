import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.staticfiles import StaticFiles

from routers import auth, camps, donors, inventory, public, requests
from seed import reset_database, seed_if_empty

FRONTEND_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend")


@asynccontextmanager
async def lifespan(app):
    seed_if_empty()
    yield


app = FastAPI(title="LifeDrop - Blood Bank Management System", version="1.1", lifespan=lifespan)

app.include_router(auth.router)
app.include_router(public.router)
app.include_router(donors.router)
app.include_router(requests.router)
app.include_router(inventory.router)
app.include_router(camps.router)


@app.post("/api/demo/reset", tags=["Demo"])
def demo_reset(request: Request):
    if request.client.host not in ("127.0.0.1", "::1", "localhost", "testclient"):
        raise HTTPException(403, "Demo reset works only on the local computer")
    reset_database()
    return {"ok": True}


app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
