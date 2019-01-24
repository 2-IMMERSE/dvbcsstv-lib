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

/**
 * @class TimelineState
 * Cut-back subset of a 'clock' object solely to represent timeline states / 
 * control timestamps.
 * 
 *  * contentTime is in units of the tickRate
 *  * wall clock time is in units of milliseconds
 *
 * @constructor
 * Create a TimelineState object.
 *
 * @param tickRate Number of ticks per second
 * @param contentTime The timeline positions, or null if no timeline.
 * @param value of Date.now() when the timeline position was sampled
 * @param speed Speed of the timeline (1.0=play, 0.0=pause, 2.0=x2 fast-forward, etc)
 */
var TimelineState = function(tickRate, contentTime, wallClockTime, speed) {
    this.tickRate = tickRate;
    this.contentTime = contentTime;
    this.wallClockTime = wallClockTime;
    this.speed = speed;
    
    if (this.wallClockTime === null || this.wallClockTime === undefined) {
        this.wallClockTime = Date.now();
    }
    
    if (this.speed === null || this.speed === undefined) {
        this.speed = null;
    }
};

/**
 * @returns A control timestamp represented as a Javascript object
 */
TimelineState.prototype.toControlTimestamp = function() {
    var wcNanos = Math.round(this.wallClockTime * 1000000);

    if (this.contentTime === null || this.contentTime === undefined) {
        return {
            "contentTime"   : null,
            "wallClockTime" : wcNanos.toFixed(0),
            "timelineSpeedMultiplier" : null
        };
    } else {
        var ct = Math.round(this.contentTime);
        return {
            "contentTime"   : ct.toFixed(0),
            "wallClockTime" : wcNanos.toFixed(0),
            "timelineSpeedMultiplier" : this.speed
        };
    }
};

/**
 * Determines if this TimelineState is different by at least a specified amount
 * (the tolerance) when compared to a previous TimelineState sharing the same tick rate.
 *
 * @param prev A previous TimelineState sharing the same tick rate.
 * @param minDiffMillis The amount by which they must vary to be considered different.
 *
 * @returns True if they differ in speed, availability, or in timing alignment by at least the specified tolerance.
 */
TimelineState.prototype.isDifferentByAtLeast = function(prev, minDiffMillis) {
    var delta;
    // there was no old state
    if (typeof prev == 'undefined' || prev === null) {
        return true;
    }
    
    // change of availability
    var thisAvailable = (this.contentTime === null);
    var oldAvailable  = (prev.contentTime === null);
    if (thisAvailable != oldAvailable) {
        return true;
    }
    
    // change of speed
    if (this.speed != prev.speed) {
        return true;
    }
    
    // shouldn't happen, but just in case...
    if (this.tickRate != prev.tickRate) {
        return true;
    }
    
    // check if change in correlation is sufficient
    if (prev.speed !== 0) {
        // use this.contentTime and see if it maps to the same wallClock time for the previous
        var prevWc = (this.contentTime - prev.contentTime)/prev.tickRate*1000/prev.speed + prev.wallClockTime;
        delta = Math.abs(this.wallClockTime - prevWc);
    } else {
        // use this.wallClockTime and see if it maps to the same contentTime for the previous
        var prevCt = (this.wallClockTime - prev.wallClockTime)/1000*prev.tickRate*prev.speed + prev.contentTime;
        delta = Math.abs(this.contentTime - prevCt)*1000/this.tickRate;
    }
    return delta > minDiffMillis;
};

/**
 * Calculate timeline position (in ticks) for a given wallclock time (in millis)
 * @param {Number} wallClockTime Wall clock time (in millis)
 * @return {Number} timeline position (in ticks))
 */
TimelineState.prototype.ticksWhen = function(wallClockTime) {
    return this.contentTime + (wallClockTime - this.wallClockTime)/1000*this.tickRate*this.speed;
}

module.exports = TimelineState;
