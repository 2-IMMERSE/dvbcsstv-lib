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

var Connector = require("./Connector");
var CssMasterController = require("./CssMasterController");
var Events = require("./event");
var defaultConfig = require("./config")

var observerFactories = [];

/**
 * Internal API layer. Not a standard part of HbbTV 2
 **/
var SyncMaster = function(options) {
	this._options = {
		cssProxyUrl: defaultConfig.cssProxyUrl,
		autoReconnect: defaultConfig.autoReconnect
	};
	
	if (typeof options != "undefined") {
		for (var attrname in options) { this._options[attrname] = options[attrname]; }
	}
	
	this._connected=false;
	
	this._connectionStateChangeListener = function(evt) {
		var connectorReady = evt.target.isConnected && evt.target.ciiUrl;
		
		if (this._connected != connectorReady) {
			var fireEvt;
			this._connected = connectorReady;
			if (connectorReady) { 
				this.ciiUrl = evt.target.ciiUrl;
				fireEvt = new Events.Event("Activated");
			} else {
				fireEvt = new Events.Event("Deactivated");
			}
			this.dispatchEvent(fireEvt);
		}
	}.bind(this);
	
	this._ciiChangeListener = function(evt) {
		this.dispatchEvent(new Events.Event("CiiChange"));
	}.bind(this);
	
	this._errorListener = function(evt) {
		var fireEvt = new Events.Event("Error");
		this.dispatchEvent(fireEvt);
	}.bind(this);
	
	this._nrSlavesChangedListener = function(evt) {
		this.dispatchEvent(evt);
	}.bind(this);
	
	this._connector = new Connector(this._options.cssProxyUrl, this._options);
	this._connector.addEventListener("StateChange", this._connectionStateChangeListener);
	this._connector.addEventListener("CiiUrlKnown", this._connectionStateChangeListener);
	this._connector.addEventListener("Error", this._errorListener);
	this._connector.addEventListener("NrOfSlavesChanged", this._nrSlavesChangedListener);
	
	this._controller = new CssMasterController(this._connector, this._options);
	this._controller.addEventListener("CiiChange", this._ciiChangeListener);
	this._controller.addEventListener("Error", this._errorListener);
	
	this._mediaObject = null;
	this._mediaObserver = null;
};

Events.EventTarget_Mixin(SyncMaster.prototype);

/**
 * @returns True if connected to the proxy server, otherwise False.
 *
 * To be notified of when connection state changes, add listeners for
 * "Activated" and "Deactivated" events.
 **/
SyncMaster.prototype.isConnected = function() {
	return this._connected;
};

/**
 * Stops the SyncMaster permanently. This causes it to disconnect from the
 * proxy server. Once terminated, it cannot be used for anything else.
 */
SyncMaster.prototype.terminate = function() {
	if (this._controller !== null && typeof this._controller != "undefined") {
		this._controller.removeEventListener("MediaStateChange", this._mediaStateChangeListener);
		this._controller.removeEventListener("Error", this._errorListener);
		this._controller.terminate();
		this._controller = null;
	}
	
	if (this._connector !== null && typeof this._connector != "undefined") {
		this._connector.close();
		this._connector = null;
	}
	
	this._mediaObject = null;
	this._mediaObserver = null;
};

/**
 * Registers a media observer factory. Media Observer implementations should
 * call this on the SyncMaster base class (without creating an instance)
 * to register a factory function.
 *
 * @param observerFactory Observer factory function, that returns either null or a media observer when passed a media object and options object.
 *
 * The factory function will be given two arguments:
 *   * The media object
 *   * The options object that was provided to a SyncMaster at construction.
 * 
 * The factory function should either return a media observer object (if it
 * can create one appropriate to the media object in question) or it should
 * return null if it is unable to create an observer for that particular media
 * object.
 */
SyncMaster.registerMediaObserverFactory = function(observerFactory) {
	if (observerFactories.indexOf(observerFactory) >= 0) {
		return;
	} else {
		observerFactories.push(observerFactory);
	}
};

/** Set a media object to be used as the master for sync.
 *
 *  If an existing media object is being used for the master, then it will stop
 *  being used and this one will be used instead.
 * 
 * @param object a media object, or null for none. An observer will be automatically created.
 * @returns true if operation successful, or false if it failed because it was not possible to determine a suitable observer
 */
SyncMaster.prototype.setMediaObject = function(object) {
	if (this._controller === null || typeof this._controller == "undefined") {
		throw "Cannot set media object because this SyncMaster has terminated.";
	}
	
	if (this._mediaObject == object) {
		return;
	}
	
	this._mediaObject = object;
	this._mediaObserver = null;
	
	if (object !== null && typeof object != "undefined") {
		this._mediaObserver = SyncMaster.createObserverForMediaObject(object, this._options);
	}
	
	this._controller.setMediaObserver(this._mediaObserver);
	
	return (object !== null) && (this._mediaObserver !== null);
};

/** Set a specific media observer, rather than the media object
 *
 *  If an existing media observer is being used for the master, then it will
 *  stop being used and this one will be used instead.
 * 
 * @param newObserver   The observer to use, or null to use none.
 */
SyncMaster.prototype.setMediaObserver = function(newObserver) {
	if (this._controller === null || typeof this._controller == "undefined") {
		throw "Cannot set media object because this SyncMaster has terminated.";
	}
	
	this._mediaObserver = newObserver;
	this._mediaObject = null;
	
	if (newObserver !== null && typeof newObserver != "undefined") {
		this._mediaObject = newObserver.getSubject();
	}
	
	this._controller.setMediaObserver(newObserver);
};

SyncMaster.prototype.getMediaObject = function() {
	if (this._controller === null || typeof this._controller == "undefined") {
		throw "Cannot set media object because this SyncMaster has terminated.";
	}
	
	return this._mediaObject;
};

SyncMaster.prototype.getMediaObserver = function() {
	if (this._controller === null || typeof this._controller == "undefined") {
		throw "Cannot set media object because this SyncMaster has terminated.";
	}
	
	return this._mediaObserver;
};

/** Get the current CII state
 *
 * @return The current CII as a Javascript object.
 */
SyncMaster.prototype.getCii = function() {
	if (this._controller === null || typeof this._controller == "undefined") {
		throw "Cannot set media object because this SyncMaster has terminated.";
	}
	
	return this._controller.getCii();
};

/** Get the current delay adjustment
 *
 *  This value (defaults to zero) is a fixed offset added to the "wall clock time"
 *  in timestamp messages that are sent to clients. It can be used to simulate
 *  synchronisation misalignment.
 *
 *  While media is paused there will be no apparent effect. However while media
 *  is playing, positive values will make it appear as if the media has not
 *  progressed as far as it really has and negative values will do the opposite.
 *
 *  The effect on a companion will be to make companion content appear delayed
 *  (positive values) or early (negative values)
 *
 *  @return Current delay adjustment in milliseconds.
 **/
SyncMaster.prototype.getDelayAdjustment = function() {
	return this._controller.getDelayAdjustment();
};

/** Set the current delay adjustment
 *
 *  See description of getDelayAdjustment() for info on what this means.
 *
 * @param millis The new delay adjustment to be used.
 */
SyncMaster.prototype.setDelayAdjustment = function(millis) {
	return this._controller.setDelayAdjustment(millis);
};

/** Allow overriding of the contentId reported to companion devices
 *
 * This is support for the facility described in HbbTV 2.0.1 errata #1
 * where setting this property to a non-null and non-undefined value
 * overrides the contentId that would normally be reported in CII messages
 * and replaces it with this string.
 * If this is set back to null or undefined then it returns to what it would
 * have been, derived from the playing media.
 *
 * @param {String|null|undefined} contentId null or undefined, or a contentId to override that which would normally be reported
 */
SyncMaster.prototype.setContentIdOverride = function(contentId) {
	if (contentId == null || contentId == undefined) {
		this._controller.setCiiOverrides({})
	} else {
		this._controller.setCiiOverrides({
			contentId: contentId,
			contentIdStatus: "final"
		})
	}
}

/** Gets the current contentIdOverride value
 * @return {String|null|undefined} The current setContentIdOverride
 */
SyncMaster.prototype.getContentIdOverride = function() {
	return this._controller.getCiiOverrides.contentId;
}

/** Create a media observer for the specified media object
 *
 * Factory function that returns a new instance of a media observer object apporpriate to the specified media object.
 *
 * @param mediaObject The media object for which the observer is required
 * @returns Media object observer
 */
SyncMaster.createObserverForMediaObject = function(object, options) {
	for (var i=0; i<observerFactories.length; i++) {
		var factory = observerFactories[i];
		var observer = factory(object, options);
		if (observer !== null && typeof observer != "undefined") {
			return observer;
		}
	}
	return null;
};

module.exports = SyncMaster;
