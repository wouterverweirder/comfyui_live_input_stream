import { app } from "../../../scripts/app.js"
import { api } from "../../../scripts/api.js"

app.registerExtension({ 
	name: "be.aboutme.comfyui.live_input_stream.screen",
	async setup() { 
	},
  getCustomWidgets() {
    return {
      SCREEN_ADVANCED(node, inputName) {
        const container = document.createElement('div')
        container.style.background = 'rgba(0,0,0,0.25)'
        container.style.textAlign = 'center'
        return { widget: node.addDOMWidget(inputName, 'SCREEN_ADVANCED', container, {
          getMinHeight: () => 200
        }) }
      }
    }
  },
  async nodeCreated(node) {
    if (node.constructor.comfyClass !== "be.aboutme.comfyui.live_input_stream.screen_capture_advanced") {
      return
    }

    const widthWidget = node.widgets.find((w) => w.name === 'desired_width')
    const heightWidget = node.widgets.find((w) => w.name === 'desired_height')
    const frameRateWidget = node.widgets.find((w) => w.name === 'frame_rate')
    const displaySurfaceWidget = node.widgets.find((w) => w.name === 'display_surface')
    const screenWidget = node.widgets.find((w) => w.name === 'image')
    const trimLeftWidget = node.widgets.find((w) => w.name === 'trim_left')
    const trimRightWidget = node.widgets.find((w) => w.name === 'trim_right')
    const trimTopWidget = node.widgets.find((w) => w.name === 'trim_top')
    const trimBottomWidget = node.widgets.find((w) => w.name === 'trim_bottom')

    const container = screenWidget.element;

    const videoCanvas = document.createElement('canvas')
    const videoCtx = videoCanvas.getContext('2d')
    videoCanvas.style.width = '100%'
    videoCanvas.style.height = '100%'
    videoCanvas.style.objectFit = 'contain'

    const video = document.createElement('video')
    video.style.height = video.style.width = '100%'

    let stream = null

    const drawFrame = () => {
      videoCanvas.width = video.videoWidth - trimLeftWidget.value - trimRightWidget.value
      videoCanvas.height = video.videoHeight - trimTopWidget.value - trimBottomWidget.value
      videoCtx.drawImage(
        video,
        trimLeftWidget.value,
        trimTopWidget.value,
        video.videoWidth - trimLeftWidget.value - trimRightWidget.value,
        video.videoHeight - trimTopWidget.value - trimBottomWidget.value,
        0,
        0,
        videoCanvas.width,
        videoCanvas.height
      )
    }

    const requestFrame = requestAnimationFrame;
    const step = () => {
      // check if our container is still attached to DOM
      if (!container.isConnected) {
        // stop the video stream
        if (stream) {
          stream.getTracks().forEach((track) => track.stop())
        }
        return
      }
      drawFrame()
      requestFrame(step)
    }

    const loadScreen = async () => {
      try {
        // stop existing stream if any
        if (video.srcObject) {
          const tracks = video.srcObject.getTracks()
          tracks.forEach((track) => track.stop())
        }
        
        // Build constraints from widget values
        const videoConstraints = {
          width: { ideal: widthWidget.value },
          height: { ideal: heightWidget.value },
          frameRate: { ideal: frameRateWidget.value },
          displaySurface: displaySurfaceWidget.value
        }
        
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: videoConstraints,
          audio: false
        })
        
        // Detect and sync the selected display surface
        const videoTrack = stream.getVideoTracks()[0]
        const settings = videoTrack.getSettings()
        if (settings.displaySurface) {
          // Sync the actual selected surface back to the widget
          displaySurfaceWidget.value = settings.displaySurface
        }
        
        container.replaceChildren(videoCanvas)

        video.srcObject = stream
        video.play()

        // Handle stream end (user stops sharing)
        stream.getVideoTracks()[0].addEventListener('ended', () => {
          const label = document.createElement('div')
          label.style.color = '#aaa'
          label.style.padding = '20px'
          label.textContent = 'Screen sharing stopped. Click "Start Capture" to share again.'
          container.replaceChildren(label)
          container.appendChild(startButton)
        })

      } catch (error) {
        const label = document.createElement('div')
        label.style.color = 'red'
        label.style.overflow = 'auto'
        label.style.maxHeight = '100%'
        label.style.whiteSpace = 'pre-wrap'
        label.style.padding = '10px'

        if (error.name === 'NotAllowedError') {
          label.textContent = 'Screen sharing was denied or cancelled.'
        } else if (error.name === 'NotSupportedError') {
          label.textContent = 'Screen sharing is not supported in this browser.'
        } else if (window.isSecureContext) {
          label.textContent =
            'Unable to capture screen:\n' +
            error.message
        } else {
          label.textContent =
            'Unable to capture screen. A secure context is required, if you are not accessing ComfyUI on localhost (127.0.0.1) you will have to enable TLS (https)\n\n' +
            error.message
        }

        container.replaceChildren(label)
        container.appendChild(startButton)
      }
    }

    const capture = () => {
      const data = videoCanvas.toDataURL('image/png')

      const img = new Image()
      img.onload = () => {
        app.graph.setDirtyCanvas(true)
      }
      img.src = data
    }

    screenWidget.serializeValue = async () => {
      capture()

      // Upload image to temp storage
      const blob = await new Promise((r) => videoCanvas.toBlob(r))
      const name = `${+new Date()}.png`
      const file = new File([blob], name)
      const body = new FormData()
      body.append('image', file)
      body.append('subfolder', 'screencapture')
      body.append('type', 'temp')
      const resp = await api.fetchApi('/upload/image', {
        method: 'POST',
        body
      })
      if (resp.status !== 200) {
        const err = `Error uploading screen capture image: ${resp.status} - ${resp.statusText}`
        throw new Error(err)
      }
      return `screencapture/${name} [temp]`
    }

    // Create a button to start screen capture
    const startButton = document.createElement('button')
    startButton.textContent = 'Start Capture'
    startButton.style.padding = '10px 20px'
    startButton.style.margin = '20px'
    startButton.style.cursor = 'pointer'
    startButton.onclick = async () => {
      await loadScreen()
      if (stream) {
        step()
      }
    }

    // Add callbacks to reload screen when constraints change
    const reloadOnChange = async () => {
      if (stream && stream.active) {
        await loadScreen()
      }
    }

    widthWidget.callback = reloadOnChange
    heightWidget.callback = reloadOnChange
    frameRateWidget.callback = reloadOnChange
    displaySurfaceWidget.callback = reloadOnChange

    // Show button initially
    container.appendChild(startButton)
  }
})
