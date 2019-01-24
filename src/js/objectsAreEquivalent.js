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

var objectsAreEquivalent = function(a,b) {
	// we'll also allow comparisons of dates (equivalence)
	// and of functions (same function object)
	var i;
	
	if (a === null) {
		return b === null;
		
	} else if (a === undefined) {
		return b === undefined;
		
	} else if (typeof(a) === 'number' || a instanceof Number) {
		return (typeof(b) === 'number' || b instanceof Number) && (a.valueOf() == b.valueOf());
		
	} else if (typeof(a) === 'string' || a instanceof String) {
		return (typeof(b) === 'string' || b instanceof String) && (a.valueOf() == b.valueOf());
	
	} else if (typeof(a) === 'boolean' || a instanceof Boolean) {
		return (typeof(b) === 'boolean' || b instanceof Boolean) && (a.valueOf() == b.valueOf());
	
	} else if (a instanceof Date) {
		return (b instanceof Date) && (a.getTime() == b.getTime());
	
	} else if (a instanceof Function) {
		return (b instanceof Function) && (a == b);
	
	} else if (a instanceof Array) {
		if (!(b instanceof Array) || a.length != b.length) {
			return false;
		} else {
			for (i=0; i<a.length; i++) {
				if (!objectsAreEquivalent(a[i],b[i])) {
					return false;
				}
			}
			return true;
		}
	
	} else if (a instanceof Object) {
		if (!(b instanceof Object)) {
			return false;
		} else {
			var aKeys = Object.keys(a).sort();
			var bKeys = Object.keys(b).sort();
			if (!objectsAreEquivalent(aKeys,bKeys)) {
				return false;
			} else {
				for (i=0; i<aKeys.length; i++) {
					if (!objectsAreEquivalent(a[aKeys[i]],b[aKeys[i]])) {
						return false;
					} 
				}
				return true;
			}
		}
	
	} else {
		throw "Could not compare - did not recognise type of object:"+String(a);
	}
};

module.exports = objectsAreEquivalent;
