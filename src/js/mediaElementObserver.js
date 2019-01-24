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
var config = require("./config");
var TimelineState = require("./TimelineState");
var MP4Reader = require("./MP4Reader");

var MEDIA_ELEMENT_EVENTS =  [ "timeupdate", "seeked", "pause", "playing", "abort", "ended", "ratechange", "error", "stalled", "waiting" ];

/*
 * @class mediaElementObserver
 * 
 * HTMLMediaElement observer for generic simple HTML5 <video> and <audio> elements
 *
 * Provides time for timelineSelectors:
 *
 *    tag:rd.bbc.co.uk,2015-12-08:dvb:css:timeline:simple-elapsed-time:NNNN
 *    urn:dvb:css:timeline:ct
 *
 * Where NNNN is the tick rate of the timeline.
 *
 * @constructor
 * @param {HTMLMediaElement} a <video> or <audio> element
 * @param {Object} options options
 * @param {String} [options.preferredTimelineSelector] Preferred timeline selector to have at the top of the list advertised in CII messages
 */


var MediaElementObserver = function(mediaElement, options) {
	this._mediaElement = mediaElement;
	
	this._options = {};
	if (typeof options != "undefined") {
		for (var attrname in options) { this._options[attrname] = options[attrname]; }
	}

	this._presentationState = "fault";
	this._mp4Reader = null;

	var self = this;

	self.running = false;

	self._meListener = function(evt) {
		switch (evt.type) {
			case "error":
				this._sendErrorEvent();
				break;
			case "timeupdate":
			case "seeked":
			case "pause":
			case "playing":
			case "stalled":
			case "waiting":
			case "abort":
			case "ended":
			case "ratechange":
				this._sendUpdateEvent();
				break;
			default:
				break;
		}
	}.bind(this);

	this._ctTimescale = null;

};

Events.EventTarget_Mixin(MediaElementObserver.prototype);

/**
 * @returns the object being observed
 **/
MediaElementObserver.prototype.getSubject = function() {
	return this._mediaElement;
};

MediaElementObserver.prototype.start = function() {
	if (!this.running) {
		this.running=true;
		for(var i=0; i<MEDIA_ELEMENT_EVENTS.length; i++) {
			var eventName = MEDIA_ELEMENT_EVENTS[i];
			this._mediaElement.addEventListener(eventName,  this._meListener);
		}
	}

	return this;
};

MediaElementObserver.prototype.stop = function() {
	if (this.running) {
		this.running=false;
		for(var i=0; i<MEDIA_ELEMENT_EVENTS.length; i++) {
			var eventName = MEDIA_ELEMENT_EVENTS[i];
			this._mediaElement.removeEventListener(eventName,  this._meListener);
		}
	}
	return this;
};

MediaElementObserver.prototype._sendUpdateEvent = function() {
	var evt = new Events.Event("MediaStateUpdate");
	evt.observer = this;
	this.dispatchEvent(evt);
};

MediaElementObserver.prototype._sendErrorEvent = function() {
	var evt = new Events.Event("Error");
	evt.observer = this;
	this.dispatchEvent(evt);
};


/**
 * Takes MP4 header info parsed by MP4Box.js and extract timescales.
 * Finds the largest and sets that as the timescale to be used for the 
 * timeline
 */
MediaElementObserver.prototype._onMp4Info = function(info) {
	this._blockCii = false;
	ctTimescale = null;
	
	if (info.timescale && info.timescale > ctTimescale) {
		ctTimescale = info.timescale;
	}
	
	if (info.tracks) {
		for (var i=0; i<info.tracks.length; i++) {
			var trackTimescale = info.tracks[i].timescale;
			if (trackTimescale && trackTimescale > ctTimescale) {
				ctTimescale = trackTimescale;
			}
		}
	}
	
	var changed = (this._ctTimescale != ctTimescale);
	this._ctTimescale = ctTimescale;
		
	console.log("mp4box success");
//	if (changed) {
		this._sendUpdateEvent();
//	}
};

MediaElementObserver.prototype._onMp4Fail = function() {
	console.log("mp4box fail");
	this._blockCii = false;
	this._sendUpdateEvent();
	
};

MediaElementObserver.prototype.isCiiBlocked = function() {
	return this._blockCii;
};

MediaElementObserver.prototype.getCii = function() {

	// calculate presentation status ... only use "transitioning" when the media changes and is first
	// spinning up
	if (this._mediaElement.currentSrc != this._prevSrc) {
		this._presentationState = "transitioning";
		if (this._mp4Reader) {
			this._mp4Reader.abort();
			this._mp4Reader=null;
		}
		if (this._mediaElement.currentSrc.length > 0) {
			this._mp4Reader = new MP4Reader(this._mediaElement.currentSrc, this._onMp4Info.bind(this),	this._onMp4Fail.bind(this));
			this._blockCii = true; // block it until we have found the composition timeline tickrate (or not)
		}
	}
	if (this._mediaElement.readyState >= 2 /* HAVE_CURRENT_DATA */) {
		this._presentationState = "okay";
		this._prevSrc = this._mediaElement.currentSrc;
	}

	var ci = this._mediaElement.currentSrc;
	
	var timelines = [];
	if (this._ctTimescale) {
		timelines.push({
			timelineSelector: "urn:dvb:css:timeline:ct",
			timelineProperties: {
				unitsPerTick: 1,
				unitsPerSecond: this._ctTimescale
			}
		});
	}
	timelines.push({
		timelineSelector: "tag:rd.bbc.co.uk,2015-12-08:dvb:css:timeline:simple-elapsed-time:1000",
		timelineProperties: {
			unitsPerTick: 1,
			unitsPerSecond: 1000
		}
	});

	// if there is a preferred timeline selector, ensure it is in the list
	// and sort so it is the first item
	var listFirstTS = this._options.preferredTimelineSelector;
	if (listFirstTS) {
		var match = listFirstTS.match(/^tag:rd.bbc.co.uk,2015-12-08:dvb:css:timeline:simple-elapsed-time:([1-9][0-9]*)$/);
		if (match) {
			if (listFirstTS !== "tag:rd.bbc.co.uk,2015-12-08:dvb:css:timeline:simple-elapsed-time:1000") {
				timelines.push({
					timelineSelector: listFirstTS,
					timelineProperties: {
						unitsPerTick: 1,
						unitsPerSecond: Number.parseInt(match[1])
					}
				});
			}
		}
		timelines.sort( function (a,b) {
			var keyA = (a.timelineSelector===listFirstTS)?0:1;
			var keyB = (b.timelineSelector===listFirstTS)?0:1;
			return keyA-keyB;
		});
	}

	return {
		contentId: ci,
		contentIdStatus: "final",
		presentationStatus: this._presentationState,
		timelines: timelines
	};
};

MediaElementObserver.prototype.getTimelineState = function(selector) {
	var tickRate = null;
	var matchA = selector.match(/^tag:rd.bbc.co.uk,2015-12-08:dvb:css:timeline:simple-elapsed-time:([1-9][0-9]*)$/);
	var matchB = selector.match(/^urn:dvb:css:timeline:ct$/);
	
	if (matchA) {
		tickRate = Number.parseInt(matchA[1]);
	} else if (matchB && this._ctTimescale) {
		tickRate = this._ctTimescale;
	}
	
	if (tickRate !== null) {
		var contentTime = this._mediaElement.currentTime * tickRate;
		var wallClockPos = Date.now();           // in milliseconds
	
		// calibration offset (in ms)
		wallClockPos += config.calibrationOffsetMillis;

		var speed = 0;
		if (!this._mediaElement.paused) {
			speed = this._mediaElement.playbackRate;
		}

		return new TimelineState(tickRate, contentTime, wallClockPos, speed);
	} else {
		return new TimelineState(null,null);
	}
};


var factory = function(mediaObject, options) {
	if (mediaObject instanceof HTMLMediaElement) {
		return new MediaElementObserver(mediaObject, options);
	} else if (mediaObject._underlyingVideoElement instanceof HTMLMediaElement) {
		// _underlyingVideoElement property is a deliberately included hook to
		// support extensions that increase HbbTV compatibility by emulating
		// AV Control objects
		// ... it is a backdoor route to get access to the actual <video> element,
		// and requires cooperation by the extension providing this property
		return new MediaElementObserver(mediaObject._underlyingVideoElement, options);
	} else {
		return null;
	}
};

SyncMaster.registerMediaObserverFactory(factory);

module.exports = MediaElementObserver;
