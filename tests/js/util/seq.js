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
 * Sequence together asynchronous functions, with abort/complete/timeout callbacks
 *
 * seq() is a function that will run a list of supplied functions in sequence one after the other.
 * Each supplied function is passed two callbacks - a "done" and an "abort" callback. When the function
 * has finished its work, it should call done() which will trigger the next function to run, or abort()
 * to abort.
 *
 * Arguments:
 *   @param funcList ... an array of functions to be run in the order provided, one after the other.
 *                       Each is passed two arguments: done, and abort. The function should call one of them
 *                       once its work is complete to indicate success or failure
 *   @param opts     ... an object containing some optional arguments:
 *      opts.onComplete    ... will be called when the whole sequence completes successfully
 *      opts.onAbort       ... will be called if any function in the sequence calls abort()
 *      opts.onTimeout     ... will be called if a timeout occurs (timeouts only happen if either
 *                             stepTimeout or timeout properties are defined)
 *      opts.stepTimeout   ... number of milliseconds to wait for each function to call done() or abort() before automatically aborting
 *      opts.totalTimeout  ... number of milliseconds to wait for the whole sequence to complete before automatically aborting
 *
 *  By default, timeout behaviour is disabled, unless you define either or both the stepTimeout or timeout options.
 *
 * Once seq() has been called, the sequence is immediately started. seq() returns a handle object with an "abort" function as a property.
 * Calling this will cause an abort to happen.
 * 
 * Example usage:
 *
 * s=seq([
 *		function(done, abort) { console.log("step a"); setTimeout(done,900) },
 *		function(done, abort) { console.log("step b"); setTimeout(done,900) },
 *		function(done, abort) { console.log("step c"); setTimeout(done,900) },
 *		function(done, abort) { console.log("step d"); done() }
 *		function(done, abort) { console.log("step e"); done() }
 *	], {
 *		onComplete: function() { console.log("completed!") },
 *		onAbort: function() { console.log("aborted!") },
 *		onTimeout: function() { console.log("timeout!") },
 *		stepTimeout: 1000,
 *		timeout: 3000,
 *	})
 *
 * Here, each step is given up to 1000 milliseconds to complete. None of the steps take longer than 900 milliseconds.
 * Howeer there is an overal timeout of 3000 milliseconds, meaning the sequence will only get as far as beginning to execute step
 * C before timing out and calling the onTimeout() handler.
 *
 */
var seq = function(funcList, opts) {
	var ended = false;
	var timer = null;
	
	var cleanupAndCallIfNotEnded = function(func) {
		return function() {
			if (timer != null) {
				clearTimeout(timer);
			}
			if (!ended) {
				ended=true
				if (func !== undefined) {
					func()
				}
			}
		}
	}
		
	var onComplete = cleanupAndCallIfNotEnded(opts.onComplete)
	var onAbort    = cleanupAndCallIfNotEnded(opts.onAbort)
	var onTimeout  = cleanupAndCallIfNotEnded(opts.onTimeout)
	
	var next = function(j) {
		if (ended)
			return

		else if (j >= funcList.length) {
			onComplete()
			return;

		} else {
			var stepTimer = null;
			
			if (opts.stepTimeout > 0) {
				stepTimer=setTimeout(onTimeout, opts.stepTimeout)
			}
			
			funcList[j].call(this, function() {
					if (stepTimer!=null) { clearTimeout(stepTimer); }
					if (!ended) { next(j+1) }
				}, onAbort
			);
		}
	}
	
	if (opts.timeout > 0) {
		timer = setTimeout(onTimeout, opts.timeout)
	}
	
	next(0)
	return { abort: onAbort }
}

