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

var oipf = require("oipf-object-polyfill");

var DATA = {};


var CS_MANAGER_FUNCS = {
    
    getInterDevSyncURL: function() {
        return DATA.interDevUrl;
    },
    
    getAppLaunchURL: function() {
        return DATA.appLaunchUrl;
    },
    
    getApp2AppLocalBaseURL: function() {
        return DATA.localApp2AppUrl;
    },
    
    getApp2AppRemoteBaseURL: function() {
        return DATA.remoteApp2AppUrl;
    },
    
};



var turnObjectIntoCSManager = function(objElem) {
    for (var propName in CS_MANAGER_FUNCS) {
        if (CS_MANAGER_FUNCS.hasOwnProperty(propName)) {
            objElem[propName] = CS_MANAGER_FUNCS[propName];
        }
    }    
};

var turnObjectBackFromCSManager = function(objElem) {
    for (var propName in CS_MANAGER_FUNCS) {
        if (CS_MANAGER_FUNCS.hasOwnProperty(propName)) {
            delete objElem[propName];
        }
    }

};



// no exports from obj module. Instead register with the oipf-object-polyfill
oipf.registerOipfObject(
	"application/hbbtvCSManager",
	"createCSManager",
	turnObjectIntoCSManager,
	turnObjectBackFromCSManager
);

module.exports = {
    setInterDevUrl: function(url) {
        DATA.interDevUrl = url;
    },
    
    setAppLaunchUrl: function(url) {
        DATA.appLaunchUrl = url;
    },
    
    setApp2AppUrls: function(localUrl, remoteUrl) {
        DATA.localApp2AppUrl = localUrl;
        DATA.remoteApp2AppUrl = remoteUrl;
    },
};
