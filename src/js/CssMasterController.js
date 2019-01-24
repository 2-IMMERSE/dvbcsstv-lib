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
var isCiiChanged = require("./cii").isChangeOfCiiProperties;
var mergeCiis = require("./cii").mergeCiis;
var objectsAreEquivalent = require("./objectsAreEquivalent");
var NullObserver = require("./nullObserver");
var config = require("./config");


var nullObserverInstance = new NullObserver();


var CssMasterController = function(connector) {
	this._connector = connector;
	this._observer = null;
	this._ciiOverrides = {};
	
	this._delayAdjustmentMillis = 0;
	
	this._mediaStateUpdateHandler = this._mediaStateUpdateHandler.bind(this);
	this._connectionStateChange = this._connectionStateChangeHandler.bind(this);
	this._timelineAddedHandler    = this._timelineAddedHandler.bind(this);
	this._timelineRemovedHandler  = this._timelineRemovedHandler.bind(this);
	
	this._connector.addEventListener("StateChange",             this._connectionStateChange);
	this._connector.addEventListener("TimelineSelectorAdded",   this._timelineAddedHandler);
	this._connector.addEventListener("TimelineSelectorRemoved", this._timelineRemovedHandler);
	
	// most recently sent CII and control timestamps (indexed by selector)
	this._latestSentCii = this._baseCii = {
		"protocolVersion" : "1.1",
		/* leaving "contentId", "contentIdStatus" and "presentationStatus" out so the observer forcibly fills it in and causes a change */
		"mrsUrl" : null,
		"timelines" : []	
	};
	this._latestSentTimelineState = {};
	this._previouslyBlocked = false;
	
	
	this.setMediaObserver(null); // initialise using a null observer to start with
};

Events.EventTarget_Mixin(CssMasterController.prototype);


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
CssMasterController.prototype.getDelayAdjustment = function() {
	return this._delayAdjustmentMillis;
};

/** Set the current delay adjustment
 *
 *  See description of getDelayAdjustment() for info on what this means.
 *
 * @param millis The new delay adjustment to be used.
 */
CssMasterController.prototype.setDelayAdjustment = function(millis) {
	var changed =  (millis != this._delayAdjustmentMillis);
	
	this._delayAdjustmentMillis = millis;
	
	if (changed) {
		this._doUpdate(true);
	}
};

/**
 * Stops the CssMasterController permanently. Cannot be restarted.
 *
 * It disconnects from the proxy server.
 */
CssMasterController.prototype.terminate = function() {
	if (this._connector !== null && typeof this._connector != "undefined") {
		this._connector.removeEventListener("StateChange",             this._connectionStateChange);
		this._connector.removeEventListener("TimelineSelectorAdded",   this._timelineAddedHandler);
		this._connector.removeEventListener("TimelineSelectorRemoved", this._timelineRemovedHandler);
		this._connector = null;
	}
	
	if (this._observer !== null) {
		this._observer.stop();
		this._observer.removeEventListener("MediaStateUpdate", this._mediaStateUpdateHandler);
		this._observer.removeEventListener("Error", this._mediaErrorHandler);
		this._observer = null;
	}
};


/**
 * Set the media observer representing the media object to share contentId
 * and timeline positions of.
 *
 * If there is an existing media observer, it will be replaced.
 *
 * Can also set to null to have no media being shared. This will manifest in
 * a nullMediaObserver being used, which reports no content ID and no timelines.
 *
 * @param newObserver Media observer object or null.
 */ 
CssMasterController.prototype.setMediaObserver = function(newObserver) {
	if (this._connector === null || typeof this._connector == "undefined") {
		throw "CssMasterController cannot be used because it has terminated.";
	}
	
	if (newObserver === null || typeof newObserver == "undefined") {
		newObserver = nullObserverInstance;
	}
	
	if (newObserver == this._observer)
		return;
	
	if (this._observer !== null) {
		this._observer.stop();
		this._observer.removeEventListener("MediaStateUpdate", this._mediaStateUpdateHandler);
		this._observer.removeEventListener("Error", this._mediaErrorHandler);
	}
	
	this._observer = newObserver;
	this._observer.addEventListener("MediaStateUpdate", this._mediaStateUpdateHandler);
	this._observer.addEventListener("Error", this._mediaErrorHandler);
	this._observer.start();
	
	this._doUpdate();

};

/** Get the CII message most recently sent to the proxy.
 * @return Most recently sent CII as a Javascript object. It is a copy, so can be modified safely.
 **/
CssMasterController.prototype.getCii = function() {
	// convert to then from JSON to copy
	return JSON.parse(JSON.stringify(this._latestSentCii));
};

CssMasterController.prototype._mediaStateUpdateHandler = function(evt) {
	this._doUpdate();
};

CssMasterController.prototype._mediaErrorHandler = function(evt) {
	var fireEvt = new Events.Event("Error");
	this.dispatchEvent(fireEvt);
};

CssMasterController.prototype._doUpdate = function(forceResendAll) {
	if (this._connector === null || typeof this._connector == "undefined") {
		return;
	}
	
	var ciiChanged = false;
	var timelinesChanged = false;
	
	// find out latest cii and if it has changed since last time
	var cii = {};
	var newCii = this._observer.getCii();
	newCii = mergeCiis(newCii, this._ciiOverrides)
	
	if (isCiiChanged(this._latestSentCii, newCii) || forceResendAll) {
		ciiChanged = true;
		cii = mergeCiis(this._baseCii, newCii);
		this._latestSentCii = cii;
	}
	
	// find out latest control timestamps and if they have changed since last time
	var cts = {};
	for(var selector in this._connector.requiredSelectors) {
		
		// get latest timestamp and apply delay adjustment
		var state = this._observer.getTimelineState(selector);
		state.wallClockTime += this._delayAdjustmentMillis;

		var prevState = this._latestSentTimelineState[selector];
		
		if (state.isDifferentByAtLeast(prevState, config.updateHysteresisMillis) || forceResendAll) {
			timelinesChanged = true;
			cts[selector] = state.toControlTimestamp();
			this._latestSentTimelineState[selector] = state;
		}
	}
	
	// if there has been a change, send a message via the connector to the server
	if (this._connector.isConnected) {
		var unblocked = ! this._observer.isCiiBlocked() && this._previouslyBlocked;
		if (ciiChanged || timelinesChanged || unblocked) {
			this._connector.send(cii, cts, { blockCii: this._observer.isCiiBlocked() });
		}
		this._previouslyBlocked = this._observer.isCiiBlocked();
	}

	if (ciiChanged) {
		this.dispatchEvent(new Events.Event("CiiChange"));
	}
};

CssMasterController.prototype._connectionStateChangeHandler = function(evt) {
	if (this._connector.isConnected) {
		this._doUpdate(true);
	}
};

CssMasterController.prototype._timelineAddedHandler = function(evt) {
	this._doUpdate(true);
};

CssMasterController.prototype._timelineRemovedHandler = function(evt) {
	delete this._latestSentTimelineState[evt.timelineSelector];
};

CssMasterController.prototype.setCiiOverrides = function(overrides) {
	this._ciiOverrides = overrides;
	this._doUpdate();
}

CssMasterController.prototype.getCiiOverrides = function() {
	return this._ciiOverrides;
}

module.exports = CssMasterController;
