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
 
var config = require("./config");


/**
 * A helper object that will delay the audio being played by a <video> element,
 * 
 * By default this uses the delay configured in the library build-time
 * configuraiton, but it can also be overriden by specifying an explicit value.
 *
 * @param {HTMLVideoElement} videoElement        The video element to adjust AV sync timing for
 * @param {Number}           audioDelayMillis    Number of milliseconds to delay audio by relative to video. Optional. Default comes from library configuration at build time.
 **/
var AvSyncAligner = function(videoElement, audioDelayMillis) {
	if (!(videoElement instanceof HTMLVideoElement)) {
		throw "Cannot act on something that is not an HTMLVideoElement";
	}
	
	if (typeof audioDelayMillis == "undefined") {
		audioDelayMillis = config.audioDelayRelativeToVideoMillis;
	}
	
	if (audioDelayMillis <= 0) {
		return;
	}
	
	this._audioContext = new (window.AudioContext || window.webkitAudioContext); 
	if (!this._audioContext) {
		console.log("AudioContent not supported - will not be able to delay audio.");
		return;
	}
	
	
	this._sourceNode = this._audioContext.createMediaElementSource(videoElement);

	this._delayNode = this._audioContext.createDelay(audioDelayMillis/1000);
	this._delayNode.delayTime.value = audioDelayMillis/1000;
	
	this._sourceNode.connect(this._delayNode);
	this._delayNode.connect(this._audioContext.destination);
};

module.exports = AvSyncAligner;
