"""Top-level package for comfyui_live_input_stream."""

__all__ = [
    "NODE_CLASS_MAPPINGS",
    "NODE_DISPLAY_NAME_MAPPINGS",
    "WEB_DIRECTORY",
]

__author__ = """Wouter Verweirder"""
__email__ = "wouter.verweirder@gmail.com"
__version__ = "0.0.3"

from .src.comfyui_live_input_stream.nodes import NODE_CLASS_MAPPINGS
from .src.comfyui_live_input_stream.nodes import NODE_DISPLAY_NAME_MAPPINGS

# Import routes to register them with the server
from .src.comfyui_live_input_stream import routes

WEB_DIRECTORY = "./web"
