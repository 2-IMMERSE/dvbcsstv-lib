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
 
 module.exports = {
	
	/* 
	   Main calibration offset for aligning the light/sound output time.
	   Positive values to delay. Negative values to make earlier.
	 */
	calibrationOffsetMillis: 0,

	/*
	   The amount by which audio should be delayed relative to video for <video>
	   elements. Values less than 0 will be ignored.
	 */
	audioDelayRelativeToVideoMillis: 0,
	
	/* 
	   The maximum amount by which presentation timing can change without
	   clients being updated. If it changes by more than this, then it triggers
	   sending of updated Control Timestamps to clients
	 */
	updateHysteresisMillis: 10,
	
	/*
	   Default URL that the MediaSynchroniser or SyncMaster API will use to
	   communicate with the CSS Proxy backend. This is overriden if you specify
	   a proxy backend when creating a SyncMaster Object
	 */
	cssProxyUrl: "ws://127.0.0.1:7681/server",
	
	/*
	   Whether it should automatically try to reconnect to the backend if it
	   fails or is otherwise not available.
	 */
	autoReconnect: false,
};