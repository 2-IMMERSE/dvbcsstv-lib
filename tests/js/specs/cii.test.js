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

var isChangeOfCiiProperties = require("cii").isChangeOfCiiProperties
var mergeCiis = require("cii").mergeCiis
var objectsAreEquivalent = require("objectsAreEquivalent")

describe("isChangeOfCiiProperties", function() {
	it("exists", function() {
		expect(isChangeOfCiiProperties).toBeDefined()
	})
	
	it("is a function", function() {
		expect(isChangeOfCiiProperties instanceof Function).toBe(true)
	})
	
	it("if properties in B are not in A, then there is a change", function() {
		expect(isChangeOfCiiProperties(
			{ "a":5, "b":7 },
			{ "c": 9 }
		)).toBe(true)
	})
	
	it("if properties in B are in A and are the same, there is no change", function() {
		expect(isChangeOfCiiProperties(
			{ "a":5, "b":7, "c":9 },
			{ "a":5, "b":7 }
		)).toBe(false)
	})
	
	it("if properties in B are different to the same ones in A then there is change", function() {
		expect(isChangeOfCiiProperties(
			{ "a":5, "b":7},
			{ "a":5, "b":9}
		)).toBe(true)
	})
})

describe("mergeCiis", function() {
	it("exists", function() {
		expect(mergeCiis).toBeDefined()
	})
	
	it("is a function", function() {
		expect(mergeCiis instanceof Function).toBe(true)
	})
	
	it("returns a cii that matches the first arg if the 2nd arg does not contain any properties", function() {
		var a = { "a":5, "b":[1,2,3] }
		var b = {}
		var merged = mergeCiis(a,b)
		expect(objectsAreEquivalent(merged, a)).toBe(true)
	})

	it("returns a cii that is a shallow copy of the 1st arg", function() {
		var a = { "a":5, "b":[1,2,3] }
		var b = {}
		var merged = mergeCiis(a,b)
		merged["a"]=99
		expect(a["a"]).toBe(5)
	})

	it("returns a cii where properties in arg2 replace properties in arg1 or add to them", function() {
		var a = { "a":5, "b":[1,2,3] }
		var b = { "b":[5,6], "c":9 }
		var merged = mergeCiis(a,b)
		expect(objectsAreEquivalent(merged, {"a":5, "b":[5,6], "c":9})).toBe(true)
		
	})
})