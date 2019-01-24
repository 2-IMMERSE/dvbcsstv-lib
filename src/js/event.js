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

/* Mixin for adding EventTarget compatible functionality to an object not in the DOM tree */

var EventTarget_Mixin = function(obj) {
	var allListeners = {};
	
	obj.addEventListener = function(eventType, eventListener, useCapture) {
		// we ignore useCapture
		
		// create array if not already there.
		if (allListeners[eventType] === undefined) {
			allListeners[eventType] = [eventListener];
		} else {
			var currentListeners = allListeners[eventType];
		
			// add to array only if not already present
			if (currentListeners.indexOf(eventListener) == -1) {
				currentListeners.push(eventListener);
			}
		}
	};

	obj.removeEventListener = function(eventType, eventListener, useCapture) {
		// we ignore useCapture
	
		var currentListeners = allListeners[eventType];
		if (currentListeners !== undefined) {
			var i = currentListeners.indexOf(eventListener);
			if (i != -1) {
				currentListeners.splice(i,1);
			}	
		}
	};

	/** Dispatches event to listeners immediately and returns when all listeners have run
	 *
	 * @param evt The event to dispatchEvent
	 * @return false if iat least one handler called Event.preventDefault(), else true.
	 */
	obj.dispatchEvent = function(evt) {
		evt.target = this;
		evt.currentTarget = this;

		var listeners = allListeners[evt.type];
		if (listeners !== undefined) {
			
			listeners = listeners.slice(); // copy, so changes don't affect dispatching process
	
			for(var i=0; i<listeners.length; i++) {
				var callback = listeners[i];
				
				try {
					callback(evt);
				} catch (err) {
					setTimeout(function () { throw err; }, 0); // generate 'uncaught exception'
				}
				if (evt.__immediateStop) {
					break;
	
				}
			}
			
			// call onXXX if it exists too
			if (typeof this["on"+evt.type] == "function") {
				this["on"+evt.type].call(this, evt);
			}
		}
		
		return evt.defaultPrevented;	
	};
	
	return obj;
};






var Event = function(typeArg, eventInit) {
	this.type = typeArg;
	
	if (eventInit === undefined) { eventInit = {}; }
	
	this.bubbles = !!eventInit.bubbles;       // defaults to false
	this.cancelable = !!eventInit.cancelable; // defaults to false
	
	this.currentTarget = null;                // will be set during dispatch
	this.defaultPrevented = false;
	this.eventPhase = Event.prototype.NONE;
	this.target = null;                       // will be set during dispatch
	this.timeStamp = Date.now();
	this.isTrusted = true;
};

Event.prototype = Object.create(Event);
Event.prototype.constructor = Event;

Event.prototype.preventDefault = function() {
	// TODO: cancel if cancelable without stopping further propagation
	if (this.cancelable) {
		//  cancel further propagation right now
		// in practice, nothing to do because this event does not propagate through the DOM
		this.defaultPrevented = true;
	}
};

Event.prototype.stopImmediatePropagation = function() {
	// TODO: For this particular event, no other listener will be called. Neither those attached on the same element, nor those attached on elements which will be traversed later (in capture phase, for instance)
	
	// Stop further listeners being called right now
	this.__immediateStop=true;
};

Event.stopPropagation = function() {
	// stop the propagation of events further along in the DOM
	// in practice, nothing to do because this event does not propagate through the DOM
};


module.exports = {
	Event: Event,
	EventTarget_Mixin: EventTarget_Mixin
};
