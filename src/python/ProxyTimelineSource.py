#!/usr/bin/env python
#
# Copyright 2018 British Broadcasting Corporation
#  
# Licensed under the Apache License, Version 2.0 (the "License"); you may not
# use this file except in compliance with the License. You may obtain a copy
# of the License at
#  
#     http://www.apache.org/licenses/LICENSE-2.0
#  
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
# WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
# License for the specific language governing permissions and limitations
# under the License.

try:
    from dvbcss.protocol.server.ts import TimelineSource
except ImportError:
    sys.stderr.write("""
    Could not import pydvbcss library. Suggest installing using pip, e.g. on Linux/Mac:
    
    $ sudo pip install pydvbcss
    """)
    sys.exit(1)


class ProxyTimelineSource(TimelineSource):
    """\
    Proxying Timeline Source for a DVB CSS TS Server.
    
    If requests from the TS Server require a new timeline, not previously
    needed, or means that a timeline is no longer needed, then this is proxied
    by passing on the request by calling :func:`onRequestedTimelinesChanged`.
    
    Control Timestamps (for newly requested, or existing timelines) are
    pushed back via this proxy by calling :func:`timelinesUpdate`.
    """
    
    def __init__(self):
        super(ProxyTimelineSource,self).__init__()
        self.timelines = {}    # maps selectors to ControlTimestamp objects or None if no clock available
        
    def timelineSelectorNeeded(self, timelineSelector):
        if timelineSelector not in self.timelines:
            self.timelines[timelineSelector] = None # mark as pending getting hold of it (don't know if available yet or not)
            if self.onRequestedTimelinesChanged:
                self.onRequestedTimelinesChanged(self.timelines.keys(),[timelineSelector],[])
        
    def timelineSelectorNotNeeded(self, timelineSelector):
        if timelineSelector in self.timelines:
            del self.timelines[timelineSelector]
            if self.onRequestedTimelinesChanged:
                self.onRequestedTimelinesChanged(self.timelines.keys(),[],[timelineSelector])
        
    def recognisesTimelineSelector(self, timelineSelector):
        return timelineSelector in self.timelines
        
    def getControlTimestamp(self, timelineSelector):
        if timelineSelector in self.timelines:
            return self.timelines[timelineSelector]
        else:
            return None 
        
    def timelinesUpdate(self, controlTimestamps):
        """\
        Call this method to update the set of Control Timestamps for timelines.
        
        :param controlTimestamps: A :class:`dict` mapping from timeline selectors (:class:`str`) to :class:`~dvbcss.protocol.ts.ControlTimestamp` objects

        Note: this does not trigger attached sinks to update clients.
        """
        for selector in controlTimestamps:
            if selector in self.timelines:
                ct = controlTimestamps[selector]
                self.timelines[selector] = ct

    def onRequestedTimelinesChanged(self, timelineSelectors, selectorsAdded, selectorsRemoved):
        """\
        This stub method is called when the set of timelines requested by 
        clients has changed - e.g. new one added or exisitng one removed.
        
        :param timelineSelectors: A list of timelineSelector strings corresponding to the requested timelines. In no particular order.
        
        Override or replace with your own handler.
        """
        pass
