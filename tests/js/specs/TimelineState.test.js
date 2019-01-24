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

var TimelineState = require("TimelineState")

describe("TimelineState", function() {
	it("exists", function() {
		expect(TimelineState).toBeDefined()
	})
	
	it("is a function", function() {
		expect(TimelineState instanceof Function).toBe(true)
	})
	
	it("Can be constructed", function() {
		expect(new TimelineState(null,null)).toBeDefined();
        expect(new TimelineState(null,null)).not.toBe(null);
	})

    it("represents a null control timestamp when constructed with two null arguments, and uses Date.now() to fill in wallClockTime", function() {
        var nowBefore = Date.now();
        var ct = new TimelineState(null,null).toControlTimestamp();
        var nowAfter = Date.now();
        
        expect(ct).toEqual(
            jasmine.objectContaining({
                "contentTime" : null,
                "timelineSpeedMultiplier": null
            })
        )
        expect(ct.wallClockTime).toBeDefined();
        var wc = parseInt(ct.wallClockTime);
        expect(wc/1000000).toBeLessThan(nowAfter+0.001);
        expect(wc/1000000).toBeGreaterThan(nowBefore-0.001);
    })
    
    it("represents a full control timestamp when constructed with full arguments", function() {
        var ct = new TimelineState(1000, 50, 102947, 1.0).toControlTimestamp();

        expect(ct).toEqual(
            jasmine.objectContaining({
                "contentTime" : "50",
                "wallClockTime" : "102947000000",
                "timelineSpeedMultiplier": 1
            })
        )
    })
    
    it("Rounds floats to integers when converting to contorl timestamps", function() {
        var ct = new TimelineState(1000, 50.7, 102947.123456789, 1.0).toControlTimestamp();

        expect(ct).toEqual(
            jasmine.objectContaining({
                "contentTime" : "51",
                "wallClockTime" : "102947123457",
                "timelineSpeedMultiplier": 1
            })
        )
    })
    
    it("considers a null/undefined to be a significant difference from itself", function() {
        var ts = new TimelineState(1000, 50, 102947, 1.0);
        
        expect(ts.isDifferentByAtLeast(null)).toBe(true);
        expect(ts.isDifferentByAtLeast()).toBe(true);
    })

    it("considers a null contentTime in either itself or the other to be a significant difference", function() {
        var ts = new TimelineState(1000, 0, 102947, 1.0);
        var prevTs = new TimelineState(1000, null, 102947, 1.0);
        
        expect(ts.isDifferentByAtLeast(prevTs)).toBe(true);
        expect(prevTs.isDifferentByAtLeast(ts)).toBe(true);
    })
    
    it("two representing equivalent timeline states but with different values are considered the same", function() {
        var ts     = new TimelineState(100, 50,     102947,      1.0);
        var prevTs = new TimelineState(100, 50+100, 102947+1000, 1.0);
        
        expect(ts.isDifferentByAtLeast(prevTs, 0.00001)).toBe(false);
    })

    it("two representing equivalent timeline states but with different values are considered the same (speed == 2)", function() {
        var ts     = new TimelineState(100, 50,       102947,      2.0);
        var prevTs = new TimelineState(100, 50+100*2, 102947+1000, 2.0);
        
        expect(ts.isDifferentByAtLeast(prevTs, 0.00001)).toBe(false);
    })

    it("two representing timelines differing by 7ms with different values are not the same if the tolerance is <7ms", function() {
        var ts     = new TimelineState(100, 50,     102947,        1.0);
        var prevTs = new TimelineState(100, 50+100, 102947+1000+7, 1.0);
        
        expect(ts.isDifferentByAtLeast(prevTs, 6)).toBe(true);
        expect(ts.isDifferentByAtLeast(prevTs, 8)).toBe(false);
    })

    it("two representing timelines differing by 7ms with different values are not the same if the tolerance is <7ms (speed=0.5)", function() {
        var ts     = new TimelineState(100, 50,         102947,        0.5);
        var prevTs = new TimelineState(100, 50+100*0.5, 102947+1000+7, 0.5);
        
        expect(ts.isDifferentByAtLeast(prevTs, 6)).toBe(true);
        expect(ts.isDifferentByAtLeast(prevTs, 8)).toBe(false);
    })

    it("considers two timelines paused at the same contentTime to be undifferent, even if wall clock times are significantly different", function() {
        var ts1 = new TimelineState(100, 50, 102947, 0.0);
        var ts2 = new TimelineState(100, 50, 999999, 0);
        
        expect(ts1.isDifferentByAtLeast(ts2, 0)).toBe(false);
        expect(ts2.isDifferentByAtLeast(ts1, 0)).toBe(false);
    })

    it("considers two timelines with identical contentTime and wallClock time to be different if their speeds are different", function() {
        var ts1 = new TimelineState(100, 50, 102947, 1.0);
        var ts2 = new TimelineState(100, 50, 102947, 1.1);
        
        expect(ts1.isDifferentByAtLeast(ts2, 9999)).toBe(true);
        expect(ts2.isDifferentByAtLeast(ts1, 9999)).toBe(true);
    })
	
	it("extrapolates time positions when speed is 1", function() {
		var ts = new TimelineState(100, 50, 10200, 1.0);
		expect(ts.ticksWhen(10300)).toBe(60);
	})

	it("extrapolates time positions when speed is -2", function() {
		var ts = new TimelineState(100, 50, 10200, -2.0);
		expect(ts.ticksWhen(10300)).toBe(30);
	})

	it("extrapolates time positions when speed is 0", function() {
		var ts = new TimelineState(100, 50, 10200, 0);
		expect(ts.ticksWhen(10300)).toBe(50);
	})
});
