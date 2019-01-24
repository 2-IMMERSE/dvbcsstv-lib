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

var Barrier = require("barrier")

describe("The Barrier object", function() {
	it("exists", function() {
		expect(Barrier).toBeDefined();
	})
	
	it("can be created", function() {
		expect(new Barrier(null)).toBeDefined();
	})
	
	it("does not callback until all added have been called at least once", function() {
		var callback = jasmine.createSpy("callback")
		
		var barrier = new Barrier(callback)
		expect(callback).not.toHaveBeenCalled()
		
		var x = barrier.add()
		var y = barrier.add()
		var z = barrier.add()
		
		expect(callback).not.toHaveBeenCalled()
		
		x()
		expect(callback).not.toHaveBeenCalled()
		
		z()
		expect(callback).not.toHaveBeenCalled()
		
		x()
		expect(callback).not.toHaveBeenCalled()
		
		y()
		expect(callback).toHaveBeenCalled()
		callback.calls.reset()
		
		x()
		expect(callback).not.toHaveBeenCalled()
	})

	it("will call the callback again if the barrier is passed again", function() {
		var callback = jasmine.createSpy("callback")
		
		var barrier = new Barrier(callback)
		expect(callback).not.toHaveBeenCalled()
		
		var x = barrier.add()
		var y = barrier.add()
		var z = barrier.add()
		
		expect(callback).not.toHaveBeenCalled()
		
		y()
		expect(callback).not.toHaveBeenCalled()
		
		z()
		expect(callback).not.toHaveBeenCalled()
		
		x()
		expect(callback).toHaveBeenCalled()
		callback.calls.reset()
		
		var a = barrier.add()
		var b = barrier.add()
		expect(callback).not.toHaveBeenCalled()
		
		a()
		expect(callback).not.toHaveBeenCalled()
		
		b()
		expect(callback).toHaveBeenCalled()
	})

})
