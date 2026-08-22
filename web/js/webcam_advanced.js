import { app } from "../../../scripts/app.js"
import { api } from "../../../scripts/api.js"

app.registerExtension({ 
	name: "be.aboutme.comfyui.live_input_stream",
	async setup() { 
	},
  getCustomWidgets() {
    return {
      WEBCAM_ADVANCED(node, inputName) {
        const container = document.createElement('div')
        container.style.background = 'rgba(0,0,0,0.25)'
        container.style.textAlign = 'center'
        return { widget: node.addDOMWidget(inputName, 'WEBCAM_ADVANCED', container, {
          getMinHeight: () => 200
        }) }
      }
    }
  },
  async nodeCreated(node) {
    if (node.constructor.comfyClass !== "be.aboutme.comfyui.live_input_stream.webcam_capture_advanced") {
      return
    }

    let deviceWidget = node.widgets.find((w) => w.name === 'device')
    const widthWidget = node.widgets.find((w) => w.name === 'desired_width')
    const heightWidget = node.widgets.find((w) => w.name === 'desired_height')
    const frameRateWidget = node.widgets.find((w) => w.name === 'frame_rate')
    const cameraWidget = node.widgets.find((w) => w.name === 'image')
    const trimLeftWidget = node.widgets.find((w) => w.name === 'trim_left')
    const trimRightWidget = node.widgets.find((w) => w.name === 'trim_right')
    const trimTopWidget = node.widgets.find((w) => w.name === 'trim_top')
    const trimBottomWidget = node.widgets.find((w) => w.name === 'trim_bottom')

    const container = cameraWidget.element;


    const videoCanvas = document.createElement('canvas')
    const videoCtx = videoCanvas.getContext('2d')
    videoCanvas.style.width = '100%'
    videoCanvas.style.height = '100%'
    videoCanvas.style.objectFit = 'contain'

    const video = document.createElement('video')
    video.style.height = video.style.width = '100%'

    const listVideoDevices = async () => {
      const devices = await navigator.mediaDevices.enumerateDevices()
      return devices.filter((device) => device.kind === 'videoinput')
    }

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
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      drawFrame()
      requestFrame(step)
    }

    const loadVideo = async () => {
      try {
        // stop existing stream if any
        if (video.srcObject) {
          const tracks = video.srcObject.getTracks()
          tracks.forEach((track) => track.stop())
        }
        
        // Request resolution and frame rate from widget values
        const videoConstraints = {
          deviceId: deviceWidget.value ? { exact: deviceWidget.value } : undefined,
          width: { ideal: widthWidget.value },
          height: { ideal: heightWidget.value },
          frameRate: { ideal: frameRateWidget.value }
        }
        
        const stream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints,
          audio: false
        })
        
        // Update the device widget with the actual device ID being used
        const videoTrack = stream.getVideoTracks()[0]
        const settings = videoTrack.getSettings()
        if (settings.deviceId && !deviceWidget.value) {
          deviceWidget.value = settings.deviceId
        }
        
        container.replaceChildren(videoCanvas)

        // setTimeout(() => res(container), 500)
        // video.addEventListener('loadedmetadata', () => res(container), false)
        video.srcObject = stream
        video.play()

      } catch (error) {
        const label = document.createElement('div')
        label.style.color = 'red'
        label.style.overflow = 'auto'
        label.style.maxHeight = '100%'
        label.style.whiteSpace = 'pre-wrap'

        if (window.isSecureContext) {
          label.textContent =
            'Unable to load webcam, please ensure access is granted:\n' +
            error.message
        } else {
          label.textContent =
            'Unable to load webcam. A secure context is required, if you are not accessing ComfyUI on localhost (127.0.0.1) you will have to enable TLS (https)\n\n' +
            error.message
        }

        container.replaceChildren(label)
      }
    }

    const capture = () => {
      const data = videoCanvas.toDataURL('image/png')

      const img = new Image()
      img.onload = () => {
        // node.imgs = [img]
        app.graph.setDirtyCanvas(true)
      }
      img.src = data
    }

    cameraWidget.serializeValue = async () => {
      capture()

      // Upload image to temp storage
      const blob = await new Promise((r) => videoCanvas.toBlob(r))
      const name = `webcam_${node.id}.png`
      const file = new File([blob], name)
      const body = new FormData()
      body.append('image', file)
      body.append('subfolder', 'webcam')
      body.append('type', 'temp')
      body.append('overwrite', 'true')
      const resp = await api.fetchApi('/upload/image', {
        method: 'POST',
        body
      })
      if (resp.status !== 200) {
        const err = `Error uploading container image: ${resp.status} - ${resp.statusText}`
        throw new Error(err)
      }
      return `webcam/${name} [temp]`
    }

    const init = async () => {
      // safari needs a call to getUserMedia before being able to list devices
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      stream.getTracks().forEach((track) => track.stop())
      const devices = await listVideoDevices()
      
      // Build mappings between device IDs and labels
      const deviceIdToLabel = {}
      const deviceLabelToId = {}
      const deviceLabels = []
      
      devices.forEach(device => {
        const label = device.label || device.deviceId
        deviceIdToLabel[device.deviceId] = label
        deviceLabelToId[label] = device.deviceId
        deviceLabels.push(label)
      })
      
      // Store current value (device ID) and convert to label for display
      const currentDeviceId = deviceWidget.value
      const currentLabel = deviceIdToLabel[currentDeviceId] || deviceLabels[0] || ''
      const widgetIndex = node.widgets.indexOf(deviceWidget)
      
      // Remove the old string widget
      node.widgets.splice(widgetIndex, 1)
      
      // Create a new combo widget that displays labels
      const newDeviceWidget = node.addWidget(
        "combo",
        "device",
        currentLabel,
        async (value) => {
          await loadVideo()
        },
        { 
          values: deviceLabels,
          serialize: true
        }
      )
      
      // Move the new widget to the original position
      node.widgets.splice(node.widgets.indexOf(newDeviceWidget), 1)
      node.widgets.splice(widgetIndex, 0, newDeviceWidget)
      
      // Override serializeValue to return the device ID instead of the label
      newDeviceWidget.serializeValue = () => {
        return deviceLabelToId[newDeviceWidget.value] || newDeviceWidget.value
      }
      
      // Create a proxy object so loadVideo gets the device ID, not the label
      deviceWidget = {
        get value() {
          return deviceLabelToId[newDeviceWidget.value] || newDeviceWidget.value
        },
        set value(v) {
          // If setting by device ID, convert to label for display
          newDeviceWidget.value = deviceIdToLabel[v] || v
        }
      }
      
      const reloadOnChange = async () => {
        await loadVideo()
      }
      
      widthWidget.callback = reloadOnChange
      heightWidget.callback = reloadOnChange
      frameRateWidget.callback = reloadOnChange
      
      await loadVideo()
      step()
    }

    init()
  }
})