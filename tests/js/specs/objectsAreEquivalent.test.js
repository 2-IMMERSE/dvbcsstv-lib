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

var objectsAreEquivalent = require("objectsAreEquivalent")

describe("objectsAreEquivalent", function() {
	it("exists", function() {
		expect(objectsAreEquivalent).toBeDefined()
	})
	
	it("is a function", function() {
		expect(objectsAreEquivalent instanceof Function).toBe(true)
	})
	
	it("for literal strings, can discriminate equal or not equal", function() {
		expect(objectsAreEquivalent("abc","def")).toBe(false)
		expect(objectsAreEquivalent("abc","abc")).toBe(true)
	})

	it("for literal numbers, can discriminate equal or not equal", function() {
		expect(objectsAreEquivalent(5.5, 5)).toBe(false)
		expect(objectsAreEquivalent(9.9863, 9.9863)).toBe(true)
	})

	it("for literal booleans, can discriminate equal or not equal", function() {
		expect(objectsAreEquivalent(true, false)).toBe(false)
		expect(objectsAreEquivalent(true, true)).toBe(true)
		expect(objectsAreEquivalent(false, false)).toBe(true)
		expect(objectsAreEquivalent(false, true)).toBe(false)
	})

	it("for object strings, can discriminate equal or not equal", function() {
		expect(objectsAreEquivalent(new String("abc"),new String("def"))).toBe(false)
		expect(objectsAreEquivalent(new String("abc"),new String("abc"))).toBe(true)
	})

	it("for object numbers, can discriminate equal or not equal", function() {
		expect(objectsAreEquivalent(new Number(5.5), new Number(5))).toBe(false)
		expect(objectsAreEquivalent(new Number(9.9863), new Number(9.9863))).toBe(true)
	})

	it("for object booleans, can discriminate equal or not equal", function() {
		expect(objectsAreEquivalent(new Boolean(true), new Boolean(false))).toBe(false)
		expect(objectsAreEquivalent(new Boolean(true), new Boolean(true))).toBe(true)
		expect(objectsAreEquivalent(new Boolean(false), new Boolean(false))).toBe(true)
		expect(objectsAreEquivalent(new Boolean(false), new Boolean(true))).toBe(false)
	})
	
	it("object and literal strings can be compared for string equivalence", function() {
		expect(objectsAreEquivalent(new String("abc"), "abc")).toBe(true)
		expect(objectsAreEquivalent("abc", new String("abc"))).toBe(true)
		expect(objectsAreEquivalent(new String("abc"), "abX")).toBe(false)
		expect(objectsAreEquivalent("abc", new String("abX"))).toBe(false)
	})

	it("object and literal numbers can be compared for numeric equivalence", function() {
		expect(objectsAreEquivalent(new Number(5.5), 5.5)).toBe(true)
		expect(objectsAreEquivalent(5.5, new Number(5.5))).toBe(true)
		expect(objectsAreEquivalent(new Number(5.5), -3)).toBe(false)
		expect(objectsAreEquivalent(5.5, new Number(-3))).toBe(false)
	})

	it("object and literal booleans can be compared for boolean equivalence", function() {
		expect(objectsAreEquivalent(new Boolean(true), false)).toBe(false)
		expect(objectsAreEquivalent(new Boolean(true), true)).toBe(true)
		expect(objectsAreEquivalent(new Boolean(false), false)).toBe(true)
		expect(objectsAreEquivalent(new Boolean(false), true)).toBe(false)

		expect(objectsAreEquivalent(true, new Boolean(false))).toBe(false)
		expect(objectsAreEquivalent(true, new Boolean(true))).toBe(true)
		expect(objectsAreEquivalent(false, new Boolean(false))).toBe(true)
		expect(objectsAreEquivalent(false, new Boolean(true))).toBe(false)
	})
	
	it("objects must have matching properties to be equal, irrespective of order", function() {
		expect(objectsAreEquivalent(
			{ "a":5, "f":true },
			{ "f":true, "a":5 }
		)).toBe(true)
		
		expect(objectsAreEquivalent(
			{ "a":5, "f":true },
			{ "f":true, "a":9 }
		)).toBe(false)

		expect(objectsAreEquivalent(
			{ "a":5, "f":true },
			{ "f":true, "a":5, "g":null }
		)).toBe(false)
		
		expect(objectsAreEquivalent(
			{ "a":5, "f":true, "g":null },
			{ "f":true, "a":5 }
		)).toBe(false)
		
	})
	
	it("arrays must be same length and have matching properties to be equal", function() {
		expect(objectsAreEquivalent(
			[ 1, 2, 3 ],
			[ 1, 2, 3 ]
		)).toBe(true)

		expect(objectsAreEquivalent(
			[ 1, 2, 3 ],
			[ 1, 3, 2 ]
		)).toBe(false)

		expect(objectsAreEquivalent(
			[ 1, 2, 3 ],
			[ 1, 2, 3, 4 ]
		)).toBe(false)

		expect(objectsAreEquivalent(
			[ 1, 2, 3, 4 ],
			[ 1, 2, 3 ]
		)).toBe(false)
	})
	
	it("correctly identifes that wrong types do no match", function() {
		expect(objectsAreEquivalent("5",5)).toBe(false)
		expect(objectsAreEquivalent(5,"5")).toBe(false)

		expect(objectsAreEquivalent(0,null)).toBe(false)
		expect(objectsAreEquivalent(null,0)).toBe(false)

		expect(objectsAreEquivalent(null,"null")).toBe(false)
		expect(objectsAreEquivalent("null",null)).toBe(false)

		expect(objectsAreEquivalent(false, "false")).toBe(false)
		expect(objectsAreEquivalent("false", false)).toBe(false)

		expect(objectsAreEquivalent(false, null)).toBe(false)
		expect(objectsAreEquivalent(null, false)).toBe(false)

		expect(objectsAreEquivalent(false, 0)).toBe(false)
		expect(objectsAreEquivalent(0, false)).toBe(false)

		expect(objectsAreEquivalent(0, null)).toBe(false)
		expect(objectsAreEquivalent(null, 0)).toBe(false)

		expect(objectsAreEquivalent("", null)).toBe(false)
		expect(objectsAreEquivalent(null, "")).toBe(false)

		expect(objectsAreEquivalent(0, "")).toBe(false)
		expect(objectsAreEquivalent("", 0)).toBe(false)

	})
	
	it("correctly compares deeply nested objects/arrays", function() {
		expect(objectsAreEquivalent(
			{ "a":7, "b": [ null, 2, { "ff_x" : [ false, false ]}]},
			{ "a":7, "b": [ null, 2, { "ff_x" : [ false, false ]}]}
		)).toBe(true)

		expect(objectsAreEquivalent(
			{ "a":7, "b": [ null, 2, { "ff_x" : [ false, false ]}]},
			{ "a":7, "b": [ null, 2, { "ff_x" : [ false, true ]}]}
		)).toBe(false)
	})
	
	it("determines that two different numbers are not equal", function() {
		expect(objectsAreEquivalent(7,9)).toBe(false)
	})
})
