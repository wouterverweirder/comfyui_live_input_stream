import { app } from "../../../scripts/app.js"
import { api } from "../../../scripts/api.js"

app.registerExtension({ 
	name: "be.aboutme.comfyui.live_input_stream.mjpeg_stream",
	async setup() { 
	},
  getCustomWidgets() {
    return {
      MJPEG_STREAM_ADVANCED(node, inputName) {
        const container = document.createElement('div')
        container.style.background = 'rgba(0,0,0,0.25)'
        container.style.textAlign = 'center'
        return { widget: node.addDOMWidget(inputName, 'MJPEG_STREAM_ADVANCED', container, {
          getMinHeight: () => 200
        }) }
      }
    }
  },
  async nodeCreated(node) {
    if (node.constructor.comfyClass !== "be.aboutme.comfyui.live_input_stream.mjpeg_stream_capture_advanced") {
      return
    }

    const streamUrlWidget = node.widgets.find((w) => w.name === 'stream_url')
    const streamWidget = node.widgets.find((w) => w.name === 'image')
    const trimLeftWidget = node.widgets.find((w) => w.name === 'trim_left')
    const trimRightWidget = node.widgets.find((w) => w.name === 'trim_right')
    const trimTopWidget = node.widgets.find((w) => w.name === 'trim_top')
    const trimBottomWidget = node.widgets.find((w) => w.name === 'trim_bottom')

    const container = streamWidget.element;

    const videoCanvas = document.createElement('canvas')
    const videoCtx = videoCanvas.getContext('2d')
    videoCanvas.style.width = '100%'
    videoCanvas.style.height = '100%'
    videoCanvas.style.objectFit = 'contain'

    const mjpegImg = new Image()
    
    let isStreaming = false
    let streamTimestamp = 0

    const drawFrame = () => {
      if (!mjpegImg.complete || mjpegImg.naturalWidth === 0) return
      
      videoCanvas.width = mjpegImg.naturalWidth - trimLeftWidget.value - trimRightWidget.value
      videoCanvas.height = mjpegImg.naturalHeight - trimTopWidget.value - trimBottomWidget.value
      
      videoCtx.drawImage(
        mjpegImg,
        trimLeftWidget.value,
        trimTopWidget.value,
        mjpegImg.naturalWidth - trimLeftWidget.value - trimRightWidget.value,
        mjpegImg.naturalHeight - trimTopWidget.value - trimBottomWidget.value,
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
        isStreaming = false
        return
      }
      if (isStreaming) {
        drawFrame()
      }
      requestFrame(step)
    }

    const loadStream = async () => {
      try {
        const url = streamUrlWidget.value.trim()
        
        if (!url) {
          const label = document.createElement('div')
          label.style.color = '#aaa'
          label.style.padding = '20px'
          label.textContent = 'Please enter an MJPEG stream URL and click "Load Stream"'
          container.replaceChildren(label)
          container.appendChild(loadButton)
          return
        }

        // Stop existing stream if any
        isStreaming = false
        
        // Show loading message
        const loadingLabel = document.createElement('div')
        loadingLabel.style.color = '#aaa'
        loadingLabel.style.padding = '20px'
        loadingLabel.textContent = 'Loading MJPEG stream...'
        container.replaceChildren(loadingLabel)
        
        // Update timestamp for cache busting
        streamTimestamp = Date.now()
        
        // Use proxy endpoint to avoid CORS issues
        const proxyUrl = `/live_input_stream/mjpeg_proxy?url=${encodeURIComponent(url)}&_t=${streamTimestamp}`
        const streamUrl = proxyUrl
        
        // Test if the stream is accessible
        await new Promise((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            reject(new Error('Stream loading timed out'))
          }, 10000) // 10 second timeout
          
          mjpegImg.onload = () => {
            clearTimeout(timeoutId)
            resolve()
          }
          
          mjpegImg.onerror = () => {
            clearTimeout(timeoutId)
            reject(new Error('Failed to load MJPEG stream. Check if the URL is valid and accessible.'))
          }
          
          mjpegImg.src = streamUrl
        })
        
        isStreaming = true
        container.replaceChildren(videoCanvas)

      } catch (error) {
        isStreaming = false
        const label = document.createElement('div')
        label.style.color = 'red'
        label.style.overflow = 'auto'
        label.style.maxHeight = '100%'
        label.style.whiteSpace = 'pre-wrap'
        label.style.padding = '10px'
        
        label.textContent = 'Unable to load MJPEG stream:\n' + error.message
        
        container.replaceChildren(label)
        container.appendChild(loadButton)
      }
    }

    const stopStream = () => {
      isStreaming = false
      mjpegImg.src = ''
      
      const label = document.createElement('div')
      label.style.color = '#aaa'
      label.style.padding = '20px'
      label.textContent = 'Stream stopped. Click "Load Stream" to reconnect.'
      container.replaceChildren(label)
      container.appendChild(loadButton)
    }

    const capture = () => {
      if (!isStreaming) return
      
      const data = videoCanvas.toDataURL('image/png')

      const img = new Image()
      img.onload = () => {
        app.graph.setDirtyCanvas(true)
      }
      img.src = data
    }

    streamWidget.serializeValue = async () => {
      capture()

      // Upload image to temp storage
      const blob = await new Promise((r) => videoCanvas.toBlob(r))
      const name = `${+new Date()}.png`
      const file = new File([blob], name)
      const body = new FormData()
      body.append('image', file)
      body.append('subfolder', 'mjpegstream')
      body.append('type', 'temp')
      const resp = await api.fetchApi('/upload/image', {
        method: 'POST',
        body
      })
      if (resp.status !== 200) {
        const err = `Error uploading MJPEG stream capture image: ${resp.status} - ${resp.statusText}`
        throw new Error(err)
      }
      return `mjpegstream/${name} [temp]`
    }

    // Create a button to load stream
    const loadButton = document.createElement('button')
    loadButton.textContent = 'Load Stream'
    loadButton.style.padding = '10px 20px'
    loadButton.style.margin = '20px'
    loadButton.style.cursor = 'pointer'
    loadButton.onclick = async () => {
      await loadStream()
      if (isStreaming) {
        step()
      }
    }

    // Create a button to stop stream
    const stopButton = document.createElement('button')
    stopButton.textContent = 'Stop Stream'
    stopButton.style.padding = '10px 20px'
    stopButton.style.margin = '20px'
    stopButton.style.cursor = 'pointer'
    stopButton.onclick = () => {
      stopStream()
    }

    // Reload stream when URL changes
    streamUrlWidget.callback = async () => {
      if (isStreaming) {
        await loadStream()
      }
    }

    // Show initial message
    const initialLabel = document.createElement('div')
    initialLabel.style.color = '#aaa'
    initialLabel.style.padding = '20px'
    initialLabel.textContent = 'Enter an MJPEG stream URL and click "Load Stream"'
    container.appendChild(initialLabel)
    container.appendChild(loadButton)
    
    // Monitor for stream errors during playback
    mjpegImg.onerror = () => {
      if (isStreaming) {
        isStreaming = false
        const label = document.createElement('div')
        label.style.color = 'red'
        label.style.padding = '20px'
        label.textContent = 'Stream error: Connection lost'
        container.replaceChildren(label)
        container.appendChild(loadButton)
      }
    }
  }
})
