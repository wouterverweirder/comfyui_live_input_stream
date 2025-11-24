import aiohttp
import asyncio
from aiohttp import web
from server import PromptServer

@PromptServer.instance.routes.get("/live_input_stream/mjpeg_proxy")
async def mjpeg_proxy(request):
    """Proxy MJPEG streams to avoid CORS issues"""
    stream_url = request.query.get('url')
    
    if not stream_url:
        return web.Response(text='Missing url parameter', status=400)
    
    try:
        # Connect to the MJPEG stream
        timeout = aiohttp.ClientTimeout(total=None, connect=10, sock_read=30)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.get(stream_url) as stream_response:
                if stream_response.status != 200:
                    return web.Response(text=f'Stream returned status {stream_response.status}', status=stream_response.status)
                
                # Get the original content type from the stream
                content_type = stream_response.headers.get('Content-Type', 'multipart/x-mixed-replace')
                
                # Create response with the original content type
                response = web.StreamResponse(
                    status=200,
                    headers={
                        'Content-Type': content_type,
                        'Cache-Control': 'no-cache, no-store, must-revalidate',
                        'Pragma': 'no-cache',
                        'Expires': '0',
                        'Access-Control-Allow-Origin': '*'
                    }
                )
                await response.prepare(request)
                
                # Stream the content
                try:
                    async for chunk in stream_response.content.iter_any():
                        if chunk:
                            await response.write(chunk)
                            await response.drain()
                except (asyncio.CancelledError, ConnectionResetError):
                    # Client disconnected
                    pass
        
        return response
        
    except asyncio.CancelledError:
        # Client disconnected
        return web.Response(status=499)
    except Exception as e:
        return web.Response(text=f'Error proxying stream: {str(e)}', status=500)
