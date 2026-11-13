from contextlib import asynccontextmanager
from collections.abc import AsyncIterator
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from .main import app
from .config import PROJECT_ROOT

@asynccontextmanager
async def lifespan(application: FastAPI) -> AsyncIterator[None]:
    async with app.router.lifespan_context(app):
        yield

application=FastAPI(lifespan=lifespan,docs_url=None,redoc_url=None,openapi_url=None)
application.mount('/api',app)
application.mount('/',StaticFiles(directory=PROJECT_ROOT/'apps/web/dist',html=True,check_dir=False),name='web')
