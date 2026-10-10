"""
Open-LLM-VTuber Server
========================
This module contains the WebSocket server for Open-LLM-VTuber, which handles
the WebSocket connections, serves static files, and manages the web tool.
It uses FastAPI for the server and Starlette for static file serving.
"""

import os
import shutil

from fastapi import FastAPI, Request, HTTPException
from .source_library import Source, save_source, search_sources, register_capture, list_captures
from .user_profile import UserProfile, read_profile, save_profile
from starlette.middleware.cors import CORSMiddleware
from starlette.responses import Response
from starlette.staticfiles import StaticFiles as StarletteStaticFiles

from .routes import init_client_ws_route, init_webtool_routes, init_proxy_route
from .service_context import ServiceContext
from .config_manager.utils import Config


# Create a custom StaticFiles class that adds CORS headers
class CORSStaticFiles(StarletteStaticFiles):
    """
    Static files handler that adds CORS headers to all responses.
    Needed because Starlette StaticFiles might bypass standard middleware.
    """

    async def get_response(self, path: str, scope):
        response = await super().get_response(path, scope)

        # Add CORS headers to all responses
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "*"

        if path.endswith(".js"):
            response.headers["Content-Type"] = "application/javascript"

        return response


class AvatarStaticFiles(CORSStaticFiles):
    """
    Avatar files handler with security restrictions and CORS headers
    """

    async def get_response(self, path: str, scope):
        allowed_extensions = (".jpg", ".jpeg", ".png", ".gif", ".svg")
        if not any(path.lower().endswith(ext) for ext in allowed_extensions):
            return Response("Forbidden file type", status_code=403)
        response = await super().get_response(path, scope)
        return response


class WebSocketServer:
    """
    API server for Open-LLM-VTuber. This contains the websocket endpoint for the client, hosts the web tool, and serves static files.

    Creates and configures a FastAPI app, registers all routes
    (WebSocket, web tools, proxy) and mounts static assets with CORS.

    Args:
        config (Config): Application configuration containing system settings.
        default_context_cache (ServiceContext, optional):
            Pre‑initialized service context for sessions' service context to reference to.
            **If omitted, `initialize()` method needs to be called to load service context.**

    Notes:
        - If default_context_cache is omitted, call `await initialize()` to load service context cache.
        - Use `clean_cache()` to clear and recreate the local cache directory.
    """

    def __init__(self, config: Config, default_context_cache: ServiceContext = None):
        self.app = FastAPI(title="Open-LLM-VTuber Server")  # Added title for clarity
        self.config = config
        self.default_context_cache = (
            default_context_cache or ServiceContext()
        )  # Use provided context or initialize a new empty one waiting to be loaded
        # It will be populated during the initialize method call

        def profile_origin(request: Request):
            origin = request.headers.get('origin')
            if origin and origin not in ('http://127.0.0.1:12393', 'http://localhost:12393'):
                raise HTTPException(403, 'Open profile settings in the local Emma app.')

        @self.app.get('/api/user-profile')
        async def get_user_profile(request: Request):
            profile_origin(request)
            agent = self.config.character_config.agent_config.agent_settings.basic_memory_agent
            return {'profile': read_profile().model_dump(),
                    'persona': self.config.character_config.persona_prompt,
                    'system_prompt': self.default_context_cache.system_prompt or '',
                    'tools': list(agent.mcp_enabled_servers or []) if agent.use_mcpp else []}

        @self.app.put('/api/user-profile')
        async def put_user_profile(request: Request, profile: UserProfile):
            profile_origin(request)
            try:
                save_profile(profile)
            except ValueError as error:
                raise HTTPException(400, str(error))
            return {'saved': True}

        @self.app.get('/api/sources')
        async def sources(request:Request,q:str=''):
            profile_origin(request)
            return {'sources':search_sources(q),'captures':list_captures()}

        @self.app.put('/api/sources')
        async def put_source(request:Request,source:Source):
            profile_origin(request)
            return save_source(source)

        @self.app.post('/api/captures')
        async def capture(request:Request):
            profile_origin(request)
            data=await request.json()
            from pathlib import Path
            path=Path(data.get('path','')).resolve()
            root=Path('data/captures').resolve()
            if not path.is_relative_to(root) or not path.is_file():
                raise HTTPException(400,'Unknown capture file')
            if data.get('kind') not in ('screenshot','screen-video'):
                raise HTTPException(400,'Invalid capture kind')
            return register_capture(str(path),data.get('kind'))

        # Add global CORS middleware
        self.app.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

        # Include routes, passing the context instance
        # The context will be populated during the initialize step
        self.app.include_router(
            init_client_ws_route(default_context_cache=self.default_context_cache),
        )
        self.app.include_router(
            init_webtool_routes(default_context_cache=self.default_context_cache),
        )

        # Initialize and include proxy routes if proxy is enabled
        system_config = config.system_config
        if hasattr(system_config, "enable_proxy") and system_config.enable_proxy:
            # Construct the server URL for the proxy
            host = system_config.host
            port = system_config.port
            server_url = f"ws://{host}:{port}/client-ws"
            self.app.include_router(
                init_proxy_route(server_url=server_url),
            )

        # Mount cache directory first (to ensure audio file access)
        if not os.path.exists("cache"):
            os.makedirs("cache")
        self.app.mount(
            "/cache",
            CORSStaticFiles(directory="cache"),
            name="cache",
        )

        # Mount static files with CORS-enabled handlers
        self.app.mount(
            "/live2d-models",
            CORSStaticFiles(directory="live2d-models"),
            name="live2d-models",
        )
        self.app.mount(
            "/bg",
            CORSStaticFiles(directory="backgrounds"),
            name="backgrounds",
        )
        self.app.mount(
            "/avatars",
            AvatarStaticFiles(directory="avatars"),
            name="avatars",
        )

        # Mount web tool directory separately from frontend
        self.app.mount(
            "/web-tool",
            CORSStaticFiles(directory="web_tool", html=True),
            name="web_tool",
        )

        self.app.mount(
            "/studio-assets",
            CORSStaticFiles(directory="studio-assets"),
            name="studio-assets",
        )
        self.app.mount(
            "/voice-samples",
            CORSStaticFiles(directory="models/voice-samples"),
            name="voice-samples",
        )

        # The original Live2D frontend and local voice/chat API share one origin.
        frontend_dir = (
            "live2d-ui/dist/web" if os.path.isdir("live2d-ui/dist/web") else "frontend"
        )
        self.app.mount(
            "/",
            CORSStaticFiles(directory=frontend_dir, html=True),
            name="frontend",
        )

    async def initialize(self):
        """Asynchronously load the service context from config.
        Calling this function is needed if default_context_cache was not provided to the constructor."""
        await self.default_context_cache.load_from_config(self.config)

    @staticmethod
    def clean_cache():
        """Clean the cache directory by removing and recreating it."""
        cache_dir = "cache"
        if os.path.exists(cache_dir):
            shutil.rmtree(cache_dir)
            os.makedirs(cache_dir)
