/**
 * Copyright 2018 British Broadcasting Corporation
 *  
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not
 * use this file except in compliance with the License. You may obtain a copy
 * of the License at
 *  
 *     http://www.apache.org/licenses/LICENSE-2.0
 *  
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations
 * under the License.
 **/

var Events = require("./event");
var SyncMaster = require("./SyncMaster");
var TimelineState = require("./TimelineState");
var config = require("./config");

/*
 * DASH.JS MediaPlayer objserver
 
 * Requires dash.js v 2.1 or later. Will NOT work with v2.0 or earlier.
 */

var MEDIA_ELEMENT_EVENTS =  [ "timeupdate", "seeked", "pause", "playing", "abort", "ended", "ratechange" ];


var DashJsObserver = function(mediaPlayer, options) {

	this._dashPlayer = mediaPlayer;
	this._mediaElement = mediaPlayer.getVideoElement();
	
	this._options = {};
	if (typeof options != "undefined") {
		for (var attrname in options) { this._options[attrname] = options[attrname]; }
	}


	this._presentationState = "fault";

	var self = this;

	self.running = false;

	self._periodChangeListener = function(evt) {
		this._sendUpdateEvent();
	}.bind(this);

	self._meListener = function(evt) {
		switch (evt.type) {
			case "error":
				this._sendErrorEvent();
				break;
			case "timeupdate":
			case "seeked":
			case "pause":
			case "playing":
			case "abort":
			case "ended":
			case "ratechange":
				this._sendUpdateEvent();
				break;
			default:
				break;
		}
	}.bind(this);
	
	self._manifestListener = function(evt) {
		 self._dashPlayer.__dashManifest = evt.data;
		 this._sendUpdateEvent();
	}.bind(this);
	
};

Events.EventTarget_Mixin(DashJsObserver.prototype);

/**
 * @returns the object being observed
 **/
DashJsObserver.prototype.getSubject = function() {
	return this._dashPlayer;
};

DashJsObserver.prototype.start = function() {
	if (!this.running) {
		this.running=true;
		for(var i=0; i<MEDIA_ELEMENT_EVENTS.length; i++) {
			var eventName = MEDIA_ELEMENT_EVENTS[i];
			this._mediaElement.addEventListener(eventName,  this._meListener);
		}
		this._dashPlayer.on("streamswitchcompleted", this._periodChangeListener);
		this._dashPlayer.on("manifestloaded", this._manifestListener);
	}
	
	return this;
};

DashJsObserver.prototype.stop = function() {
	if (this.running) {
		this.running=false;
		for(var i=0; i<MEDIA_ELEMENT_EVENTS.length; i++) {
			var eventName = MEDIA_ELEMENT_EVENTS[i];
			this._mediaElement.removeEventListener(eventName,  this._meListener);
		}
		this._dashPlayer.off("streamswitchcompleted", this._periodChangeListener);
		this._dashPlayer.off("manifestloaded", this._manifestListener);
	}
	return this;
};

DashJsObserver.prototype._sendUpdateEvent = function() {
	var evt = new Events.Event("MediaStateUpdate");
	evt.observer = this;
	this.dispatchEvent(evt);
};

DashJsObserver.prototype._sendErrorEvent = function() {
	var evt = new Events.Event("Error");
	evt.observer = this;
	this.dispatchEvent(evt);
};



DashJsObserver.prototype.isCiiBlocked = function() {
	return false;
};

DashJsObserver.prototype.getCii = function() {
	var ci;
	
	// calculate presentation status ... only use "transitioning" when the media changes and is first
	// spinning up
	if (this._mediaElement.src != this._prevSrc) {
		this._presentationState = "transitioning";
	}
	if (this._mediaElement.readyState >= 2 /* HAVE_CURRENT_DATA */) {
		this._presentationState = "okay";
	}

	var ci = this._dashPlayer.getSource() + "#period=" + this._dashPlayer.getActiveStream().getId();

	var timelines = [];
	
	timelines.push({
		timelineSelector: "urn:dvb:css:timeline:mpd:period:rel:1000",
		timelineProperties: {
			unitsPerTick: 1,
			unitsPerSecond: 1000
			}
	});

	// if there is a preferred timeline selector, ensure it is the first in
	// the list
	var listFirstTS = this._options.preferredTimelineSelector;
	if (listFirstTS) {
		var match = listFirstTS.match(/^urn:dvb:css:timeline:mpd:period:rel:([0-9]+)(?::(.*))?$/);
		if (match) {
			if (listFirstTS !== "urn:dvb:css:timeline:mpd:period:rel:1000") {
				timelines.unshift({
					timelineSelector: listFirstTS,
					timelineProperties: {
						unitsPerTick: 1,
						unitsPerSecond: Number.parseInt(match[1])
						}
				});
			}
		}
	}
	
	var mrsUrl = null;
	if (this._dashPlayer.__dashManifest) {
		var manifest = this._dashPlayer.__dashManifest;
		if (typeof manifest.mrsUrl === "object") {
			mrsUrl = manifest.mrsUrl.toString();
		}
	}

	return {
		contentId: ci,
		contentIdStatus: "final",
		mrsUrl: mrsUrl,
		presentationStatus: this._presentationState,
		timelines: timelines
	};
};

DashJsObserver.prototype.getTimelineState = function(selector) {
	var match = selector.match(/^urn:dvb:css:timeline:mpd:period:rel:([0-9]+)(?::(.*))?$/);
	if (!match) {
		return new TimelineState(null, null);
	} else {
		var tickRate = Number.parseInt(match[1]);
		var periodId = match[2];
		var contentTime;
		var wallClockPos;

		
		var speed = 0;
		if (!this._mediaElement.paused) {
			speed = this._mediaElement.playbackRate;
		}
		
		if (typeof(periodId) === "string") {
			periodId = unescape(periodId);
			contentTime = this._dashPlayer.time(periodId);
			wallClockPos = Date.now();
		} else {
			contentTime = this._dashPlayer.getVideoElement().currentTime;
			wallClockPos = Date.now();
		}
		
		// calibration offset (in ms)
		wallClockPos += config.calibrationOffsetMillis;
		
		if (contentTime === null) {
			return new TimelineState(tickRate, null);
		} else {
			return new TimelineState(tickRate, contentTime*tickRate, wallClockPos, speed);
		}
	}
};

var factory = function(mediaPlayer, options) {
	// rough and ready heuristic test to figure out if this is likely a Dash.js MediaPlayer object
	if (typeof mediaPlayer === "object" &&
		mediaPlayer.getActiveStream &&
		mediaPlayer.getSource &&
    	mediaPlayer.time) {
		return new DashJsObserver(mediaPlayer, options);
	} else if (typeof mediaPlayer._underlyingVideoElement === "object" &&
		// _underlyingVideoElement property is a deliberately included hook to
		// support extensions that increase HbbTV compatibility by emulating
		// AV Control objects or HTML5 media elements with dash.js
		// ... it is a backdoor route to get access to the actual <video> element,
		// and requires cooperation by the extension providing this property
		mediaPlayer._underlyingVideoElement.getActiveStream &&
		mediaPlayer._underlyingVideoElement.getSource &&
		mediaPlayer._underlyingVideoElement.time) {
		return new DashJsObserver(mediaPlayer._underlyingVideoElement, options);
	} else {
		return null;
	}
};

SyncMaster.registerMediaObserverFactory(factory);

module.exports = DashJsObserver;
