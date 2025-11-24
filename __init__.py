"""Top-level package for comfyui_webcam_advanced."""

__all__ = [
    "NODE_CLASS_MAPPINGS",
    "NODE_DISPLAY_NAME_MAPPINGS",
    "WEB_DIRECTORY",
]

__author__ = """Wouter Verweirder"""
__email__ = "wouter.verweirder@gmail.com"
__version__ = "0.0.1"

from .src.comfyui_webcam_advanced.nodes import NODE_CLASS_MAPPINGS
from .src.comfyui_webcam_advanced.nodes import NODE_DISPLAY_NAME_MAPPINGS

WEB_DIRECTORY = "./web"
