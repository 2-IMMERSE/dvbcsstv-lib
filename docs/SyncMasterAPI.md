**There is an alternative  "sync master" API included. This is not a part of
the HBbTV 2 standard and is therefore not supported on real TV devices. It exists
primarily as an internal API layer within the emulation.**

To use it: first, include the library and
access it via the `dvbcsstv-lib` attribute of the `window` object:
 
    <script src="dvbcsstv-lib.js"></script>

    ...
    
    <script type="text/javascript">
    
    var dvbcss = window["dvbcsstv-lib"];

Create a `SyncMaster` object, optionally telling it the WebSocket
URL of the proxy server (to override the default - see above),
and optionally to auto-reconnect to the proxy (default=false).
        
    var sync = new dvbcss.SyncMaster({
            cssProxyUrl: "ws://127.0.0.1:7681/cii",
            autoReconnect: true
        });

For HTML5 Media Elements (`<audio>` or `<video>` tags) playing simple streams
(e.g. mp4 files via HTTP) use either the `setMediaObject()` method:

    var video = document.getElementById("my-video-element");

    video.addEventListener("loadeddata", function(evt) {
        
        if (video.readyState >= 2) {
            sync.setMediaObject(video);
        }
    }

... or create an observer and attach that to the `SyncMaster`:

    var video = document.getElementById("my-video-element");
    var observer = dvbcss.MediaElementObserver(video);

    video.addEventListener("loadeddata", function(evt) {
        
        if (video.readyState >= 2) {
            sync.setMediaObserver(observer);
        }
    }


If the HTML5 Media Element is playing an MPEG DASH stream, via dash.js
then you must pass the dash.js `MediaPlayer` object. By either:

    sync.setMediaObject(dashMediaPlayer);

... or:

    var observer = dvbcss.DashJsObserver(dashMediaPlayer);
    sync.setMediaObserver(observer);

You can also set `null` to simulate a TV in a state where it has no media
content playing:

    sync.setMediaObject(null);
    
... or:

    sync.setMediaObserver(null);

## Media types and formats Supported

The same restrictions for the [Media synchroniser API](MediaSynchroniserAPI.md) apply to this API.
