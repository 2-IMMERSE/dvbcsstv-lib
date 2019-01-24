**There is a basic implementation of the HbbTV 2 MediaSynchroniser API
included in the library. This is accessed via the HbbTV/OIPF defined
`oipfObjectFactory`:**

    <script src="dvbcsstv-lib.js"></script>
    
    ...
    
    var ms = oipfObjectFactory.createMediaSynchroniser();

    var video = document.getElementById("my-video-element")
    video.load();

    video.addEventListener("loadeddata", function(evt) {
        
        if (video.readyState >= 2) {
            ms.initMediaSynchroniser(video, "urn:dvb:css:timeline:ct");

            ms.enableInterDeviceSync(function() {
                console.log("inter-device sync active!");
            });
        }
    }
    
You can also declare a media synchroniser as an object witin an HTML page:

    <object type="application/hbbtvMediaSynchroniser" id="media-sync"></object>
    
    ...
    
    var ms = document.getElementById("media-sync");


This supports only "inter-device" synchronisation. It does not support
"multi-stream" synchronisation.

## Media Synchroniser feature support

The following features are supported:

|Feature                                                         | Supported? |
|:---------------------------------------------------------------|------------|
| **Inter-device sync master mode** (companion syncs to this TV) | yes        |
| **Inter-device sync slave mode** (this TV syncs to another TV) | no         |
| **Multi-stream sync** (sync two videos/audios on the same TV)  | no         |


### Media types and media objects

 * This emulation only properly supports HTML5 media elements playing ISOBMFF (mp4).

 * There is partial support for an HTML5 media element playing MPEG DASH via dash.js,
   provided you pass the dash.js MediaPlayer object instead of
   the HTML5 Media element (when calling `initMediaSynchroniser()`)

 * There is partial support for &lt;object&gt; elements playing media provided they
   have a property `_underlyingVideoElement` set to an HTMLMediaElement representing
   the actual media player.

**For MPEG DASH**, the following types of "timeline Selector" can be used.

 * `urn:dvb:css:timeline:mpd:period:rel:NNNN`
 * `urn:dvb:css:timeline:mpd:period:rel:NNNN:XXXX`

This is a timeline for MPEG DASH where time is relative to the start of either
the first Period or some other period, identified by its Period@Id. `NNNN` is the ticks per second to use and `XXXX` is a Period@ID.


**For &lt;audio&gt; and &lt;video&gt; elements playing ISOBMFF (mp4) files:**

 * `urn:dvb:css:timeline:ct`

This is an approximation of ISOBMFF  "Composition Time". The tick rate depends
on headers in the ISOBMFF file. See DVB CSS spec clause 5.3.5.

### Limitations with ISOBMFF (mp4)

Support for extracting the timeline for ISBOBMFF (mp4) files is implemented
using [MP4Box.js](https://github.com/gpac/mp4box.js) and has some issues. 
MP4Box is not able to successfully parse headers for all MP4/MOV files.
Also the server providing the media file *must* support cross-origin requests.

If parsing fails, or cross-origin requests are blocked, then this timeline
selector will simply not be advertised to companion devices or usable by them.

Note also  that it takes time to fetch and parse the MP4 header in JavaScript,
so the timeline may not be initially advertised for a second or two. However
it will hold off providing the CII message with the list of timelines until
it has the information.


## Non-standard extensions

*The following are non-standard extensions that are not part of the DVB CSS
or HbbTV 2 specifications. They are not present on real TV devices:*

**Timeline selector for simple HTML5 Media element timeline:**

 * `tag:rd.bbc.co.uk,2015-12-08:dvb:css:timeline:simple-elapsed-time:NNNN`

This is basically the `currentTime` property of the media element, but
multiplied up to the tick rate `NNNN` specified in the timeline selector.
