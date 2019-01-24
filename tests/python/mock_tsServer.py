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

from dvbcss.protocol.ts import SetupData
from dvbcss.protocol.ts import Timestamp
from dvbcss.protocol.ts import ControlTimestamp
from dvbcss.protocol.ts import AptEptLpt


class MockTsServer(object):
    """\
    This is a mock for a restricted subset of TSServer functionality.
    
    It mocks enough to allow timeline sources to be attached, the contentId to be set and for
    all clients to be updated.
    
    It does not mock individual client connections and messages, or AptEptLpt support.
    Instead it mocks the higher level concept of when a timeline becomes needed or not
    (the notifications that get sent to the timeline source)
    
    """
    
    def __init__(self, contentId=None, enabled=True):
        super(MockTsServer,self).__init__()
        self._enabled = enabled
        self.contentId = contentId
        self._updateAllClientsCalled = False
        self._timelineSources = []
        self._mostRecentControlTimestamps = {}
        self._neededTimelineSelectors = []
        
    @property
    def enabled(self):
        return self._enabled
    
    @enabled.setter
    def enabled(self, value):
        self._enabled = value
        if not self._enabled:
            for timelineSelector in self._neededTimelineSelectors[:]:
                self.mock_removeTimelineSelector(timelineSelector)
        
    def cleanup(self):
        self.enabled = False
        
    def attachTimelineSource(self, timelineSource):
        if timelineSource not in self._timelineSources:
            self._timelineSources.append(timelineSource)
            timelineSource.attachSink(self)
        
    def removeTimelineSource(self, timelineSource):
        if timelineSource in self._timelineSources:
            self._timelineSources.remove(timelineSource)
            timelineSource.removeSink(self)
        
        
    def updateAllClients(self):
        self._updateAllClientsCalled = True
        self._mostRecentControlTimestamps = {}
    
        for timelineSelector in self._neededTimelineSelectors:
            ct = ControlTimestamp(Timestamp(None, 0), None)
            for source in self._timelineSources:
                if source.recognisesTimelineSelector(timelineSelector):
                    ct = source.getControlTimestamp(timelineSelector)
            self._mostRecentControlTimestamps[timelineSelector] = ct                


    def mock_addTimelineSelector(self, timelineSelector):
        if timelineSelector not in self._neededTimelineSelectors:
            self._neededTimelineSelectors.append(timelineSelector)
            for source in self._timelineSources:
                source.timelineSelectorNeeded(timelineSelector)
        else:
            raise RuntimeError("Test Case tried to add timeline selector that was already added")
    
    def mock_removeTimelineSelector(self, timelineSelector):
        if timelineSelector in self._mostRecentControlTimestamps:
            del self._mostRecentControlTimestamps[timelineSelector]

        if timelineSelector in self._neededTimelineSelectors:
            self._neededTimelineSelectors.remove(timelineSelector)
            for source in self._timelineSources:
                source.timelineSelectorNotNeeded(timelineSelector)
        else:
            raise RuntimeError("Test Case tried to remove timeline selector that was not currently added")
        
    def mock_getMostRecentCt(self, timelineSelector):
        try:
            return self._mostRecentControlTimestamps[timelineSelector]
        except KeyError:
            return None
        
    def mock_wasUpdateAllClientsCalled(self):
        """Returns True if updateAllClients was called since last time this method was called"""
        tmp = self._updateAllClientsCalled
        self._updateAllClientsCalled = False
        return tmp
        