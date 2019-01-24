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
 
if (typeof WeakMap === "undefined") {
	var WeakMap = require('weak-map');
}

if (typeof Event === "undefined") {
	Event = require("../event").Event;
}

var oipf = require("oipf-object-polyfill");
var SyncMaster = require("../SyncMaster.js");

var csManager = require("./CSManager");

var PRIVATE = new WeakMap();

var STATE_UNINITIALISED = 0;
var STATE_INITIALISED = 1;
var STATE_PERMANENT_ERROR = 2;
var MODE_MASTER = 11;
var MODE_SLAVE = 12;

var ACQUIRE_TIMELINE_TIMEOUT = 2500; // time needed to find a TEMI timeline

var currentMediaSynchroniser = null;
var currentMediaSynchroniser_throwPermanentErrorAndAbort = null;

/**
 * Emulation of HbbTV 2.0 Media Synchroniser API
 *
 * API is defined in HbbTV 2.0 specification (ETSI TS 102 796 v.1.3.1)
 * clauses 8.2.3 and 9.7 (and sync architecture explained in clause 13)
 *
 * Supports only "master" mode, and enabling of inter-device synchronisation.
 * Does not support multi-stream synchronisation.
 */
var turnObjectIntoMediaSynchroniser = function(obj) {
	PRIVATE.set(obj,{});
	var priv = PRIVATE.get(obj);
	
	priv.state = STATE_UNINITIALISED;
	priv.mode  = MODE_MASTER;
	priv.interDev = false;

	priv.pscListener = null;

	priv.lastError = undefined;
	priv.lastErrorSource = undefined;
	priv.nrOfSlaves = 0;
	priv.interDevDispersion = undefined;
	priv.minSyncBufferSize = 0;
	priv.maxBroadbandStreamsWithBroadcast = 0;
	priv.maxBroadbandStreamsNoBroadcast = 0;
	priv.contentIdOverride = null;
	
	Object.defineProperty(obj, "lastError",                        { configurable: true, get: function() { return priv.lastError; }});
	Object.defineProperty(obj, "lastErrorSource",                  { configurable: true, get: function() { return priv.lastErrorSource; }});
	Object.defineProperty(obj, "nrOfSlaves",                       { configurable: true, get: function() { return priv.nrOfSlaves; }});
	Object.defineProperty(obj, "interDeviceSyncEnabled",           { configurable: true, get: function() { return Boolean(priv.interDev); }});
	Object.defineProperty(obj, "interDeviceSyncDispersion",        { configurable: true, get: function() { return priv.interDevDispersion; }});
	Object.defineProperty(obj, "minSyncBufferSize",                { configurable: true, get: function() { return priv.minSyncBufferSize; }});
	Object.defineProperty(obj, "maxBroadbandStreamsWithBroadcast", { configurable: true, get: function() { return priv.maxBroadbandStreamsWithBroadcast; }});
	Object.defineProperty(obj, "maxBroadbandStreamsNoBroadcast",   { configurable: true, get: function() { return priv.maxBroadbandStreamsNoBroadcast; }});

	Object.defineProperty(obj, "currentTime", { configurable: true, get: function() {
		if (!priv.masterObserver) {
			return NaN;
		} else {
			var timelineState = priv.masterObserver.getTimelineState(priv.masterTimeline);
			if (timelineState.contentTime === null || typeof timelineState.contentTime === "undefined") {
				return NaN;
			} else {
				return timelineState.ticksWhen(Date.now()) / timelineState.tickRate;
			}
		}
	}});

	priv.mustHaveMasterTimelineNow = false;

	var _mediaStateUpdateHandler = function(evt) {
		if (priv.mustHaveMasterTimelineNow) {
			// check if master timeline present. If not, then raise error
			var timelineState = priv.masterObserver.getTimelineState(priv.masterTimeline);
			if (timelineState.contentTime === null || typeof timelineState.contentTime === "undefined") {
				_throwPermanentErrorAndAbort(15, priv.master);
			}
		}
	}.bind(this);

	Object.defineProperty(obj, "contentIdOverride", {
		configurable: true,
		get: function() { return priv.contentIdOverride; },
		set: function(newValue) {
			if (priv.contentIdOverride !== newValue) {
				priv.contentIdOverride = newValue
				if (priv.interDev) {
					priv.interDev.setContentIdOverride(priv.contentIdOverride)					
				}
			}
		}
	})
	


	var _throwPermanentErrorAndAbort = function(errorCode, errorSource) {
		_abort();
		priv.state = STATE_PERMANENT_ERROR;

		priv.lastError = errorCode;
		priv.lastErrorSource = errorSource;

		var evt = new Event("Error");
		evt.lastError = priv.lastError;
		evt.lastErrorSource = priv.lastErrorSource;
		obj.dispatchEvent(evt);
		if (typeof obj.onError === "function") {
			obj.onError(errorCode, errorSource);
		}
	};
	
	var _throwTransientError = function(errorCode, errorSource) {
		priv.lastError = errorCode;
		priv.lastErrorSource = errorSource;

		var evt = new Event("Error");
		evt.lastError = priv.lastError;
		evt.lastErrorSource = priv.lastErrorSource;
		obj.dispatchEvent(evt);
		if (typeof obj.onError === "function") {
			obj.onError(errorCode, errorSource);
		}
	};

	var _abort = function() {
		if (priv.interDev) {
			priv.interDev.removeEventListener("Error", priv.errorListener);
			priv.interDev.terminate();
			priv.interDev = null;
		}
		if (priv.pscListener && priv.master) {
			priv.master.removeEventListener("PlayStateChange", priv.pscListener);
			priv.pscListener = null;
		}
	};

	obj.initMediaSynchroniser = function(mediaObject, timelineSelector) {
		if (priv.state == STATE_INITIALISED) {
			_throwTransientError(17, mediaObject);
			return;
		}
		
		if (priv.state == STATE_PERMANENT_ERROR) {
			_throwTransientError(13, mediaObject);
			return;
		}
		
		// spec says any existing media synchroniser should be killed
		// when a new one is initalised. If it is not already in permanent error state
		// then it should also raise an error code 18
		if (currentMediaSynchroniser !== null && currentMediaSynchroniser._state != STATE_PERMANENT_ERROR) {
			currentMediaSynchroniser_throwPermanentErrorAndAbort(18, undefined);
		}
		
		currentMediaSynchroniser = obj;
		currentMediaSynchroniser_throwPermanentErrorAndAbort = _throwPermanentErrorAndAbort.bind(this);

		
		// TODO: check if mediaObject is <audio> or <video> or <v/b> or <a/v>
		priv.master = mediaObject;
		priv.masterTimeline = timelineSelector;
		
		// create observer
		var opts = { preferredTimelineSelector: priv.masterTimeline };
		priv.masterObserver = SyncMaster.createObserverForMediaObject(priv.master, opts);
		if (!priv.masterObserver) {
			_throwPermanentErrorAndAbort(15, priv.master);
		} else {
			// listen to it
			priv.masterObserver.addEventListener("MediaStateUpdate", _mediaStateUpdateHandler);
			setTimeout(function() {
				priv.mustHaveMasterTimelineNow = true;
				_mediaStateUpdateHandler();
			}, ACQUIRE_TIMELINE_TIMEOUT);
		}
		
		priv.state = STATE_INITIALISED;
		
		priv.pscListener = null;
		
		if (priv.master._type == "a/v control object") {
			// if it is an a/v control object, then attach handlers to detect stopped event and push to error state
			priv.pscListener = function() {
				switch (priv.master.playState) {
					case 5:
					case 6: 
						_throwPermanentErrorAndAbort(16, priv.master);
						break;
					default:
						break;
				}
			};
			priv.master.addEventListener("PlayStateChange", priv.pscListener);
			
		} else if (priv.master.type == "video/broadcast") {
			if (priv.master.playState != 1 /* CONNECTING */ &&
				priv.master.playState != 2 /* PRESENTING */ ) {
					_throwPermanentErrorAndAbort(16, mediaObject);
				}
			priv.pscListener = function(evt) {
				var isPermanentError = (evt.state === 0) && (typeof evt.error !== "undefined");
				
				if (isPermanentError) {
					_throwPermanentErrorAndAbort(14, priv.master);
				} else if (evt.state === 0 || evt.state === 3) {
					_throwPermanentErrorAndAbort(16, priv.master);
				}
			};
			priv.master.addEventListener("PlayStateChange", priv.pscListener);
		}

	};

	// initSlaveMediaSynchroniser ... undefined because not implemented

	obj.addMediaObject = function(mediaObject, timelineSelector, correlation, tolerance, multiDecoderMode) {
		throw "Slave/multi-stream sync not implemented";
	};

	obj.removeMediaObject = function(mediaObject, timelineSelector, correlation, tolerance, multiDecoderMode) {
		throw "Slave/multi-stream sync not implemented";
	};

	obj.updateCorrelationTimestamp = function(mediaObject, correlationTimestamp) {
		throw "Slave/multi-stream sync not implemented";
	};

	obj.enableInterDeviceSync = function(callback) {
		if (priv.interDev) { return; }
		switch (priv.state) {
			case STATE_UNINITIALISED:
				_throwTransientError(7, undefined);
				break;

			case STATE_PERMANENT_ERROR:
				_throwTransientError(13, undefined);
				break;

			case STATE_INITIALISED:
				priv.errorListener = function(evt) {
					_throwPermanentErrorAndAbort(14, priv.master);
				}.bind(obj);
				
				var localOptions = {
					// cssProxyUrl ... default picked up by SyncMaster if we dont' specify here
					preferredTimelineSelector: priv.masterTimeline,
				}

				priv.interDev = new SyncMaster(localOptions);
				priv.interDev.setContentIdOverride(priv.contentIdOverride)
				priv.interDev.addEventListener("Error", priv.errorListener);
				var onActivation = function() {
					priv.interDev.removeEventListener("Activated", onActivation)
					csManager.setInterDevUrl(priv.interDev.ciiUrl);
					priv.interDev.setMediaObserver(priv.masterObserver);
					if (typeof callback == "function") {
						callback();
					}
				}
				priv.interDev.addEventListener("Activated", onActivation)
				priv.interDev.addEventListener("NrOfSlavesChanged", function(evt) {
					priv.nrOfSlaves = evt.nrOfSlaves;
				}.bind(obj));
				break;
				
			default:
				throw "Failed due to unknown state: "+priv.state;
		}
	};

	obj.disableInterDeviceSync = function(callback) {
		if (!priv.interDev) { return; }
		switch (priv.state) {
			case STATE_UNINITIALISED:
				_throwTransientError(7, undefined);
				break;

			case STATE_PERMANENT_ERROR:
				_throwTransientError(13, undefined);
				break;

			case STATE_INITIALISED:
				var onDeactivated = function() {
					priv.interDev.removeEventListener("Deactivated", onDeactivated);
					if (typeof callback == "function") {
						callback()
					}
				}
				priv.interDev.addEventListener("Deactivated", onDeactivated);
				priv.interDev.removeEventListener("Error", priv.errorListener);
				priv.interDev.terminate();
				priv.interDev = null;
				break;
				
			default:
				throw "Failed due to unknown state: "+priv.state;
		}
	};
};


var turnObjectBackFromMediaSynchroniser = function(obj) {
	var priv = PRIVATE.get(obj);

	if (priv.interDev) {
		priv.interDev.removeEventListener("Error", priv.errorListener);
		priv.interDev.terminate();
		priv.interDev = null;
	}

	delete obj.lastError;	
	delete obj.lastErrorSource;
	delete obj.nrOfSlaves;
	delete obj.interDeviceSyncEnabled;
	delete obj.interDeviceSyncDispersion;
	delete obj.minSyncBufferSize;
	delete obj.maxBroadbandStreamsWithBroadcast;
	delete obj.maxBroadbandStreamsNoBroadcast;
	delete obj.currentTime;
	
	delete obj.initSlaveMediaSynchroniser;
	delete obj.initSlaveMediaSynchroniser;
	delete obj.addMediaObject;
	delete obj.removeMediaObject;
	delete obj.updateCorrelationTimestamp;
	delete obj.enableInterDeviceSync;
	delete obj.disableInterDeviceSync;
	
	PRIVATE.delete(obj);
};


// no exports from obj module. Instead register with the oipf-object-polyfill
oipf.registerOipfObject(
	"application/hbbtvMediaSynchroniser",
	"createMediaSynchroniser",
	turnObjectIntoMediaSynchroniser,
	turnObjectBackFromMediaSynchroniser
);

