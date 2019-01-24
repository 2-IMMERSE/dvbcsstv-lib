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
var TimelineState = require("./TimelineState");

/*
 * Null observer
 * 
 */


var NullObserver = function() {
	this.running = false;
};

Events.EventTarget_Mixin(NullObserver.prototype);

NullObserver.prototype.start = function() {
	if (!this.running) {
		this.running=true;
	}
	return this;
};

NullObserver.prototype.stop = function() {
	if (this.running) {
		this.running=false;
	}
	return this;
};


NullObserver.prototype.isCiiBlocked = function() { return false; };

NullObserver.prototype.getCii = function() {
	return {
		contentId: null,
		contentIdStatus: "final",
		presentationStatus: "okay",
		timelines: [
		]
	};
};

NullObserver.prototype.getTimelineState = function(selector) {
	return new TimelineState(null,null);
};

module.exports = NullObserver;
