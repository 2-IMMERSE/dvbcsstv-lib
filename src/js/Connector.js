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
var ReconnectingWebSocket = require("reconnectingwebsocket");

var CssServerProxyConnector = function(url, options) {
	
    this._options = { autoReconnect: false };
    
	if (typeof options != "undefined") {
		for (var attrname in options) { this._options[attrname] = options[attrname]; }
	}
    
	this.isConnected = false;
	this.requiredSelectors = {};
    this.ciiUrl = undefined;
    this.nrOfSlaves = 0;
	
	this._ws_onopen = this._ws_onopen.bind(this);
	this._ws_onclose = this._ws_onclose.bind(this);
	this._ws_onerror = this._ws_onerror.bind(this);
	this._ws_onmessage = this._ws_onmessage.bind(this);
	
    if (this._options.autoReconnect) {
        this.ws = new ReconnectingWebSocket(url, [], {
            reconnectInterval: 200,
            maxReconnectInterval: 3000
        });
    } else {
        this.ws = new WebSocket(url);
    }

	this.ws.addEventListener("open", this._ws_onopen);
	this.ws.addEventListener("close", this._ws_onclose);
	this.ws.addEventListener("error", this._ws_onerror);
	this.ws.addEventListener("message", this._ws_onmessage);
	
};

Events.EventTarget_Mixin(CssServerProxyConnector.prototype);



CssServerProxyConnector.prototype._ws_onopen = function(evt) {
	this.isConnected=true;
	var fireEvt = new Events.Event("StateChange");
	this.dispatchEvent(fireEvt);
};

CssServerProxyConnector.prototype._ws_onclose = function(evt) {
	this.isConnected=false;
    this.ciiUrl = undefined;
	var fireEvt = new Events.Event("StateChange");
	this.dispatchEvent(fireEvt);
};

CssServerProxyConnector.prototype._ws_onerror = function(evt) {
	this.isConnected=false;
	var fireEvt = new Events.Event("StateChange");
	this.dispatchEvent(fireEvt);

	// don't raise error if auto reconnecting
	if (!this._options.autoReconnect) {
		fireEvt = new Events.Event("Error");
		fireEvt.error = "Connection Error";
		this.dispatchEvent(fireEvt);
	}
};


CssServerProxyConnector.prototype._ws_onmessage = function(evt) {
	var msg = JSON.parse(evt.data);
	var selector;
    var fireEvt;
    var i;

//	console.log("RECV: "+JSON.stringify(msg))
	
	if ("add_timelineSelectors" in msg && msg.add_timelineSelectors.length>0) {
		for(i=0; i<msg.add_timelineSelectors.length; i++) {
			selector = msg.add_timelineSelectors[i];
			this.requiredSelectors[selector] = true;
			fireEvt = new Events.Event("TimelineSelectorAdded");
			evt.timelineSelector = selector;
			this.dispatchEvent(fireEvt);
		}
	}

	if ("remove_timelineSelectors" in msg && msg.remove_timelineSelectors.length>0) {
		for(i=0; i<msg.remove_timelineSelectors.length; i++) {
			selector = msg.remove_timelineSelectors[i];
			delete this.requiredSelectors[selector];
			fireEvt = new Events.Event("TimelineSelectorRemoved");
			evt.timelineSelector = selector;
			this.dispatchEvent(fireEvt);
		}
	}
    
    if ("ciiUrl" in msg) {
        this.ciiUrl = String(msg.ciiUrl);
        fireEvt = new Events.Event("CiiUrlKnown");
        fireEvt.ciiUrl = this.ciiUrl;
        this.dispatchEvent(fireEvt);
    }
    
    if ("nrOfSlaves" in msg) {
        this.nrOfSlaves = Number(msg.nrOfSlaves);
        fireEvt = new Events.Event("NrOfSlavesChanged");
        fireEvt.nrOfSlaves = this.nrOfSlaves;
        this.dispatchEvent(fireEvt);
    }
};

CssServerProxyConnector.prototype.send = function(cii, controlTimestamps, options) {
	if (this.isConnected) {
		var msg = { "cii": cii, "controlTimestamps": controlTimestamps };
        if (typeof options !== "undefined") {
            msg.options = options;
        }
//		console.log("SENT: "+JSON.stringify(msg))
		this.ws.send(JSON.stringify(msg));
	}
};


CssServerProxyConnector.prototype.close = function() {
	if (this.isConnected) {
		this.ws.close();
	}
};


module.exports = CssServerProxyConnector;
