import hmac
import time
from collections import defaultdict, deque
from threading import Lock
from fastapi import HTTPException
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Scope, Receive, Send, Message

class RequestControls:
    def __init__(self, app: ASGIApp):
        self.app=app
        self.hits: dict[str, deque[float]]=defaultdict(deque)
        self.lock=Lock()

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope['type']!='http':
            await self.app(scope,receive,send)
            return
        settings=scope['app'].state.storage.settings
        headers={key.decode().lower():value.decode() for key,value in scope.get('headers',[])}
        path=scope.get('path','')
        root_path=scope.get('root_path','')
        if root_path and path.startswith(root_path):
            path=path[len(root_path):] or '/'
        if settings.access_token and path!='/health':
            supplied=headers.get('authorization','').removeprefix('Bearer ')
            if not hmac.compare_digest(supplied,settings.access_token):
                await JSONResponse({'detail':'Enter the workspace access token.'},status_code=401)(scope,receive,send)
                return
        client=str(settings.data_dir)+':'+str(scope.get('client',('unknown',))[0])
        expensive=scope.get('method') in {'POST','PUT','DELETE'}
        now=time.monotonic()
        if expensive:
            with self.lock:
                # Bounded retention also removes inactive client buckets.
                for key in list(self.hits):
                    while self.hits[key] and now-self.hits[key][0]>=60:self.hits[key].popleft()
                    if not self.hits[key]:del self.hits[key]
                bucket=self.hits[client]
                limited=len(bucket)>=settings.requests_per_minute
                if not limited:bucket.append(now)
            if limited:
                await JSONResponse({'detail':'Too many requests. Try again in a minute.'},status_code=429,headers={'Retry-After':'60'})(scope,receive,send)
                return
        max_body=settings.max_upload_bytes+65536 if path.startswith('/documents') else 65536
        try:length=int(headers.get('content-length','0'))
        except ValueError:length=max_body+1
        if length>max_body:
            await JSONResponse({'detail':'Request body is too large.'},status_code=413)(scope,receive,send)
            return
        total=0
        async def bounded_receive() -> Message:
            nonlocal total
            message=await receive()
            if message['type']=='http.request':
                total+=len(message.get('body',b''))
                if total>max_body:raise HTTPException(413,'Request body is too large.')
            return message
        async def secured_send(message: Message) -> None:
            if message['type']=='http.response.start':
                message['headers']=[*message.get('headers',[]),(b'x-content-type-options',b'nosniff'),(b'referrer-policy',b'no-referrer'),(b'cache-control',b'no-store')]
            await send(message)
        await self.app(scope,bounded_receive,secured_send)
