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

var MP4Box = require("mp4box").MP4Box;

var fetchBlockSize=1024*1024;
var fetchLimit = 10 * fetchBlockSize;


/**
 * Function that attempts to use MP4Box.js to extract some metadata from the 
 * mp4 file. Calls onInfo with the "info" object returned by mp4box.onReady
 *
 * Also provides an abort() method to abort the process.
 *
 * Repeatedly fetches chunks (range requests) of the mp4 file and feeds them
 * into mp4box until it is able to parse the metadata
 *
 * @param {String} url  URL of the mp4
 * @param {Function} onInfo Called with "info" object returned by mp4box.onReady
 * @param {Function} onFail Called if there is an error.
 **/
var MP4Reader = function(url, onInfo, onFail) {

    var xhr;
    var mp4Box = new MP4Box();
    
    var nextFetchStart = 0;
    var done = false;

    var xhrTerminate = function() {
        if (mp4Box) {
            mp4Box.flush();
            mp4Box.stop();
            mp4Box = null;
        }
        xhr = null;
    };
    
    var mp4BoxReady = function(info) {
        done=true;
        
        if (xhr) {
            xhr.abort();
        }
        mp4Box.stop();
        
        onInfo(info);
    };
    
    var xhrLoadDone = function() {
        var chunk = xhr.response;
        if (chunk && mp4Box && chunk.byteLength > 0) {
            chunk.fileStart = nextFetchStart;
            nextFetchStart += chunk.byteLength;
            try {
                mp4Box.appendBuffer(chunk);
            } catch (e) {
            	console.log("Absorbed error from mp4box parsing: "+e);
            }
        }
        // schedule another chunk fetch if not yet parsed headers
        // and we've not yet reached the limit
        if (!done && nextFetchStart < fetchLimit) {
            xhrStartFetch();
        } else {
            mp4Box.stop();
            if (!done) {
                onFail();
            }
        }
    };
    
    var mp4BoxError = function(e) {
        mp4Box.flush();
        if (xhr) {
            xhr.abort();
        }
    };

    mp4Box.onError = mp4BoxError;
    mp4Box.onReady = mp4BoxReady;
    
    var xhrStartFetch = function() {
        xhr = new XMLHttpRequest();
        xhr.addEventListener("loadend", xhrLoadDone);
        xhr.addEventListener("error", xhrTerminate);
        xhr.addEventListener("abort", xhrTerminate);

        var rangeStart = Number(nextFetchStart).toString();
        var rangeEnd   = Number(nextFetchStart + fetchBlockSize - 1).toString();
        
        var nextChunkStart = 0; 

        xhr.responseType = "arraybuffer";
        xhr.open("GET", url);
        xhr.setRequestHeader("Range","bytes=+"+rangeStart+"-"+rangeEnd);
        xhr.send();
    };
    
    this.abort = function() {
        xhr && xhr.abort();
        mp4Box && mp4Box.stop();
    };
    
    xhrStartFetch();
};

module.exports = MP4Reader;
