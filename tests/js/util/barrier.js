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
 * A Barrier object that will call an 'onComplete' callback once add callbacks added to the barrier have been called.
 * 
 * Calling the 'add()' add another block to the barrier. It returns a function. When you call that function, the block
 * is cleared. Once all functions returned by all calls to add() have been called, then the onComplete callback is
 * involved.
 * 
 * Example usage:
 *     >>> var barrier = new Barrier(function() { console.log("DONE!") })
 *     >>> var callBackA = barrier.add()
 *     >>> var callBackB = barrier.add()
 *     >>> var callBackC = barrier.add()
 *     >>> startAsyncTask(callbackA)
 *     >>> startAsyncTask(callbackB)
 *     >>> startAsyncTask(callbackC)
 *     ... "DONE!" will be printed once all three async tasks call their callbacks
 **/
var Barrier = function(onComplete) {
	var remaining = 0;
	
	this.add = function() {
		var isDone = false;
		remaining = remaining + 1;

		return function() {
			if (!isDone) {
				isDone=true;
				remaining = remaining - 1;
				if (remaining == 0) {
					onComplete()
				}
			}
		}
	}
	
}

module.exports = Barrier
