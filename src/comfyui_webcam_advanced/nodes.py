import nodes
import folder_paths

MAX_RESOLUTION = nodes.MAX_RESOLUTION

class WebcamCaptureAdvanced(nodes.LoadImage):
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "device": ("COMBO", {"options": [], "default": ""}),
                "image": ("WEBCAM_ADVANCED", {}),
                "trim_left": ("INT", {"default": 0, "min": 0, "max": MAX_RESOLUTION, "step": 1}),
                "trim_right": ("INT", {"default": 0, "min": 0, "max": MAX_RESOLUTION, "step": 1}),
                "trim_top": ("INT", {"default": 0, "min": 0, "max": MAX_RESOLUTION, "step": 1}),
                "trim_bottom": ("INT", {"default": 0, "min": 0, "max": MAX_RESOLUTION, "step": 1})
            }
        }

    RETURN_TYPES = ("IMAGE",)
    #RETURN_NAMES = ("image_output_name",)
    FUNCTION = "load_capture"

    #OUTPUT_NODE = False
    #OUTPUT_TOOLTIPS = ("",) # Tooltips for the output node

    CATEGORY = "Webcam Advanced"

    def load_capture(self, image, **kwargs):
        return super().load_image(folder_paths.get_annotated_filepath(image))

    @classmethod
    def IS_CHANGED(cls, image, **kwargs):
        return super().IS_CHANGED(image)


# A dictionary that contains all nodes you want to export with their names
# NOTE: names should be globally unique
NODE_CLASS_MAPPINGS = {
    "be.aboutme.comfyui.webcam_advanced.webcam_capture_advanced": WebcamCaptureAdvanced
}

# A dictionary that contains the friendly/humanly readable titles for the nodes
NODE_DISPLAY_NAME_MAPPINGS = {
    "be.aboutme.comfyui.webcam_advanced.webcam_capture_advanced": "Webcam Capture Advanced"
}
