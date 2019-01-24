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
 
var objectsAreEquivalent = require("./objectsAreEquivalent");


/**
  Combine two objects representing DVB CSS "CII" messages. The returned object
  contains all attributes that are in ciiB and ciiA. If an attribute exists in
  both ciiA and ciiB then the one from ciiB is taken.
  
  @param ciiA An object whose attributes correspond to DVB CSS "CII" message property names.
  @param ciiB An object whose attributes correspond to DVB CSS "CII" message property names.
  @returns object identical to ciiB but also including any attributes from ciiA that were not in ciiB.
 */
var mergeCiis = function (ciiA, ciiB) {
	var merged = {};
	var key;
	
	for (key in ciiA) {
		merged[key] = ciiA[key];
	}
	
	for (key in ciiB) {
		if (ciiB[key] !== undefined) {
			merged[key] = ciiB[key];
		}
	}
			
	return merged;
};


/**
  If any property defined in ciiB is not already defined in ciiA
  or is a different value, then returns true else false

  @param ciiA An object whose attributes correspond to DVB CSS "CII" message property names.
  @param ciiB An object whose attributes correspond to DVB CSS "CII" message property names.

  @returns True if any property in ciiB has a different value to the same property in ciiA. Otherwise returns False.
 **/
var isChangeOfCiiProperties = function(ciiA, ciiB) {
	for (var key in ciiB) {

		// if a key has a value in B...
		if (ciiB[key] !== undefined) {
			
			// if it is a different value, or doesn't exist in A
			// then it constitute a change
			if (!objectsAreEquivalent(ciiA[key], ciiB[key])) {
				return true;
			}
		}
	}
	return false;
};


module.exports = {
	isChangeOfCiiProperties: isChangeOfCiiProperties,
	mergeCiis: mergeCiis
};