
 * [The APIs and supported features](#APIs)
    * [Media Synchroniser API](MediaSynchroniserAPI.md)
    * [Non-standard API](SyncMasterAPI.md)
 * [Calibration & configuration](#calib)
 * [Network Discovery](#discovery)

<a name="APIs" />
## The APIs and supported features

**This emulation provides a partial implementation of the HbbTV 2 
[Media Synchroniser API](MediaSynchroniserAPI.md).**

The [documentation for this API](MediaSynchroniserAPI.md) also lists what
features are supported and what limitations and caveats need to be taken into
account.

It also exposes an [internal non-standard API](SyncMasterAPI.md).


<a name="calib" />
## Calibration & Configuration

Calibration is needed to take into account the latency between rendering and display/speakers.

Configuration is a set of tunable parameters for calibrating the TV
browser timing. The default values can be left unchanged if you do not wish
to calibrate.

Calibration is performed by using a calibration tool such as
[dvbcss-synctiming (github)](http://github.com/bbc/dvbcss-synctiming) to measure
the offset, then setting the values in this file to compensate. 

The library's `config` object contains the following properties that you can
set the values of at runtime *before* you start using the API.

| Property name | Default value | Meaning                                     |
| :------------ | :-----------: | :------------------------------------------ |
| calibrationOffsetMillis | 0 | Main calibration offset for aligning the light/sound output time. Positive values to delay. Negative values to make earlier. Units of milliseconds. |
| audioDelayRelativeToVideoMillis | 0 | The amount by which audio should be delayed relative to video for <video> elements. Values less than 0 will be ignored. Units of milliseconds. |
| updateHysteresisMillis | 10 | The maximum amount by which presentation timing can change without clients being updated. If it changes by more than this, then it triggers sending of updated Control Timestamps to clients Units of milliseconds. |
| cssProxyUrl | ws://127.0.0.1:7681/server | Change the default for the URL of the proxy backend that this library connects to. |


For example:

    var sync = require("dvbcsstv-lib");
    sync.config.calibrationOffsetMillis = 38
    
Or:

    <script src="node_modules/dvbcsstv-lib/dist/dvbcsstv-lib.js"></script>
    
    ...
    
    var sync = window["dvbcsstv-lib"];
    sync.config.calibrationOffsetMillis = 38
    
Changing these configuration parameters after you start using the API does
not guarantee that the changes will be picked up.
    

<a name="discovery" />
## Network Discovery

This project does not provide the network discovery server.
There are other projects that implement this, such as
`node_hbbtv` by Fraunhofer. Version 0.0.10 or later is required.
Find it here:

https://github.com/fraunhoferfokus/node-hbbtv

	$ git clone https://github.com/fraunhoferfokus/node-hbbtv.git
	$ cd node-hbbtv
	$ npm install

It will need to be told the URL of the CSS-CII service that the proxy
server provides so that it can be included in the data sent to clients.

