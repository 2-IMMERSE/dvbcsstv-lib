# DVB CSS and HbbTV 2 Media Synchroniser emulation for desktop browsers

*See the [CHANGELOG](CHANGELOG.md) for significant issues that might affect users of this package.*

### What is this?

This is a proof of concept emulation of part of the Media Synchroniser API in
HbbTV 2. Using it you can prototype an application that runs in a web browser
and allows companion devices (e.g. phones, tablets) on the same local network
to precisely sync to media playing in your application.

It supports the inter-device synchronisation features of the Media Synchroniser API only. 
It does not support "multi-stream" synchronisation.

To use it:
 1. Write your web application using the Media Synchroniser API.
 2. Include the 'dvbcsstv-lib' Javascript library in your application
 3. Run the provided python proxying server on the same machine as the browser.
 
The idea is that an HTML+JS application uses the library. The library communicates with the
proxy server, and the proxy server provides the actual DVB CSS protocol
endpoints that companion devices connect in order to synchronise.

Want to understand the API? See the `README.md` in the `docs` folder.


### What is included:

This project provides the Javascript library and proxy server.

The library supports basic HTML5 Media Elements (`<audio>` or `<video>` tags),
and also supports MPEG DASH streams via
[dash.js](https://github.com/Dash-Industry-Forum/dash.js/).

The library also includes an object to fix A/V sync alignment when playing video
elements. It works by adding a controllable delay into the audio output.


### Network Discovery server not included

This project only implements the DVB CSS protocols (CSS-CII, CSS-TS and CSS-WC)
servers, as would be present in an HbbTV 2.0 TV. It does not
implement the network discovery service needed for a companion to "discover"
the TV. See the later section on *discovery* for info on projects that can
provide this.

There are other projects that implement this, such as
[`node_hbbtv`](https://github.com/fraunhoferfokus/node-hbbtv/) by Fraunhofer.
The latest build 0.0.10 or later is required.
Install it from npm or obtain it directly from github:


## Getting started

### Install / build

#### Pre-requisites

Ensure you have the following already installed:
 * [nodejs and npm](http://nodejs.org/)
 * [grunt](http://gruntjs.com/getting-started)
 * python 2.x
 * Pip (python package manager)



#### 1. Install pydvbcss

pydvbcss v0.5.0 (or later) is required. Install from the python package index
(PyPI). Either:

	$ sudo pip install -r requirements.txt

Or:

	$ sudo pip install pydvbcss>=0.5.0

It is [also available from github](https://github.com/bbc/pydvbcss).



#### 2. Include `dvbcsstv-lib` in your package.json dependencies for your project

Add it to the dependencies list:

    "dependencies": {
        ...
        "dvbcsstv-lib": "git+https://git@github.com:2-IMMERSE/dvbcsstv-lib.git#master",
    }

Run `npm install` for your project to install this project as a dependency.
This will automatically run the build processes and unit tests

### 3. Use the library from your javascript code:

Assuming you are using something like `webpack` to build it, then simply
`require` the library.

To use the HbbTV Media Synchroniser API, simply requiring the library will
install the necessary objects in the global `window` object, if present:

    require("dvbcsstv-lib");
    
To access the non-standard internal API:

    var api = require("dvbcsstv-lib");
    
Alternatively, if you wish to directly include the code in JS that is destined
for a browser without going through a build process, then you should use the
distribution build that has been passed through webpack already:

    <script src="node_modules/dvbcsstv-lib/dist/dvbcsstv-lib.js"></script>

And use the HbbTV Media Synchroniser API:

    var ms = oipfObjectFactory.createMediaSynchroniser();
    
    var video = document.getElementById("my-video-element")
    video.load();

    video.onload = function() {
        ms.initMediaSynchroniser(video, "urn:dvb:css:timeline:ct");

        ms.enableInterDeviceSync(function() {
            console.log("inter-device sync active!");
        });
    }
    
See the `README.md` in the `docs` folder for more details on the APIs and Limitations
of the emulation.


### 4. Starting the proxy server

For all the above, when you wish to run your webpage, you will need to also run
the proxy server too:

    $ python `npm bin`/dvbcsstv-proxy-server.py

Run with `--help` option to see command line options for controlling what
address and port it runs on.

*The command `npm bin` returns the path of the local npm binaries folder. In
this case it will usually be `node_modules/.bin`. This is where the python
proxy server is installed when this project is used as a dependency.*


### Calibration, network discovery and other considerations

See the `README.md` in the `docs` folder.


### Not writing a node/npm project?

If you are woring outside of node/npm, then you should download this repository
and run npm to install dependencies and run the build process:

    $ cd dvbcsstv-lib
    $ npm install
    
The proxy server is available to run in `src/python/main.py` and the
JS library is available in `dist/dvbcsstv-lib.js`



## Licence and Authors

<img src="https://2immerse.eu/wp-content/uploads/2016/04/2-IMM_150x50.png" align="left"/><em>This project has been contributed by the British Broadcasting Corporation to the <a href="https://2immerse.eu/">2-IMMERSE</a> project (which is co-funded by the European Commission’s <a hef="http://ec.europa.eu/programmes/horizon2020/">Horizon 2020</a> Research Programme) and subsequent contributions funded by 2-IMMERSE. </em>

All code and documentation is licensed by the original author and contributors under the Apache License v2.0:

* [British Broadcasting Corporation](http://www.bbc.co.uk/rd) (original author)
* [British Telecommunications (BT) PLC](http://www.bt.com/)
* [Institut für Rundfunktechnik](http://www.irt.de/)


See AUTHORS file for a full list of individuals and organisations that have
contributed to this code.

## Contributing

If you wish to contribute to this project, please get in touch with the authors.

