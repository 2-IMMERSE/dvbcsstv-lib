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

var e = require("event")
var Barrier = require("barrier")

var EventTarget_Mixin = e.EventTarget_Mixin;
var Event = e.Event;


describe("event.Event", function() {
	it("exists", function() {
		expect(Event).toBeDefined()
	})
	
	it("has a 'type' attribute that comes form the first argument of the constructor", function() {
		var e = new Event("blahblah");
		expect(e.type).toBeDefined()
		expect(e.type).toEqual("blahblah")
	})
	
	it("has attributes 'currentTarget' and 'target' that are initially null", function() {
		var e = new Event("blah")
		expect(e.currentTarget).toBeNull()
		expect(e.target).toBeNull()
	})
	
	it("has a 'timeStamp' attribute matching the creation time", function() {
		var before = Date.now()
		var e = new Event("blah")
		var after = Date.now()
		expect(e.timeStamp >= before).toBeTruthy()
		expect(e.timeStamp <= after).toBeTruthy()
	})
	
	it("has methods 'preventDefault', 'stopImmediatePropagation' and 'stopPropagation'", function() {
		var e = new Event("flurbleplig");
		expect(e.preventDefault).toBeDefined()
		expect(e.stopImmediatePropagation).toBeDefined()
		expect(e.stopPropagation).toBeDefined()
	})
})

describe("event.EventTarget_Mixin", function() {
	
	it("exists", function() {
		expect(EventTarget_Mixin).toBeDefined()
	})
	
	describe("When it is used...", function() {
		var x;
		
		beforeEach(function() {
			x = new Object()
			x = EventTarget_Mixin(x);
		})
	
		it("defines addEventListener, removeEventListener and dispatchEvent attributes for the object passed as an argument", function() {
			expect(x.addEventListener).toBeDefined()
			expect(x.removeEventListener).toBeDefined()
			expect(x.dispatchEvent).toBeDefined()
		})
		
		it("lets you register an event listener that will be called when the event dispatches", function(done) {
			x.addEventListener("myEvent", done);
			var evt = new Event("myEvent")
			x.dispatchEvent(evt)
			
		}, 100)

		it("the event is passed as an argument to the listener", function(done) {
			var evt = new Event("myEvent")
			x.addEventListener("myEvent",function(arg) {
				expect(arg).toEqual(evt);
				done();
			});
			x.dispatchEvent(evt)
		}, 10)
		
		it("will call all event listeners if multiple ones are registered", function(done) {
			var barrier = new Barrier(done)
			var evt = new Event("myEvent")
			
			var a = barrier.add()
			var b = barrier.add()
			var c = barrier.add()

			x.addEventListener("myEvent", function(e) { expect(e).toEqual(evt); a(); });
			x.addEventListener("myEvent", function(e) { expect(e).toEqual(evt); b(); });
			x.addEventListener("myEvent", function(e) { expect(e).toEqual(evt); c(); });

			x.dispatchEvent(evt)
		}, 10)

		it("event listeners are not called after they are removed", function(done) {
			var callback = jasmine.createSpy("callback")
			var callback2 = jasmine.createSpy("callback")
			var evt = new Event("myEvent")
			
			x.addEventListener("myEvent", callback)
			x.addEventListener("myEvent", callback2)
			x.removeEventListener("myEvent", callback)
			x.dispatchEvent(evt)
			
			setTimeout(function() {
				expect(callback).not.toHaveBeenCalled()
				expect(callback2).toHaveBeenCalled()
				done()
			}, 100)
		})
		
		it("will call continue to dispatch all events even if listeners generate exceptions", function(done) {
			var barrier = new Barrier(done)
			var evt = new Event("myEvent")
			
			var a = barrier.add()
			var b = barrier.add()
			var c = barrier.add()

			x.addEventListener("myEvent", function(e) { expect(e).toEqual(evt); a(); foo=nonexistent.plig1; });
			x.addEventListener("myEvent", function(e) { expect(e).toEqual(evt); b(); foo=nonexistent.plig2; });
			x.addEventListener("myEvent", function(e) { expect(e).toEqual(evt); c(); foo=nonexistent.plig3; });

			x.dispatchEvent(evt)
		}, 10)

	})

})
