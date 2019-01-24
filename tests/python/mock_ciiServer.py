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

from dvbcss.protocol.cii import CII
from dvbcss.protocol import OMIT


class MockCiiServer(object):
    """\
    Simple mock for a CIIServer.
    
    Has mock_* methods for controlling it. You can, at any time, check whether it is enabled, what the current CII message is
    and whether updateClients() has been called.
    """
    
    def __init__(self, enabled=True, initialCII = CII(protocolVersion="1.1")):
        super(MockCiiServer,self).__init__()
        self.cii = initialCII.copy()
        self._connections = {}
        self._enabled = enabled
        self._updateClientsCalled = False

    @property
    def enabled(self):
        return self._enabled
    
    @enabled.setter
    def enabled(self, value):
        self._enabled = value
        if not self._enabled:
            for mockSock in self._connections.keys():
                self.mock_clientDisconnects(mockSock)
        
    def cleanup(self):
        self.enabled = False
        
    def _getConnections(self):
        return self._connections

    def updateClients(self, sendOnlyDiff=True,sendIfEmpty=False):
        self._updateClientsCalled = True
        for c in self._connections:
            self._connections[c]["prevCII"] = self.cii.copy()
        
    def onClientConnect(self, webSock):
        pass
        
    def onClientDisconnect(self, webSock, connectionData):
        pass
        
    def onClientMessage(self, webSock, message):
        pass
        
    def mock_clientConnects(self):
        """Simulate a client connecting, returns a handle representing that client."""
        mockSock = object()
        self._connections[mockSock] = { "prevCII":CII() }
        self.onClientConnect(mockSock)
        return mockSock
        
    def mock_clientDisconnects(self, mockSock = None):
        """Simulate a client disconnecting, either any client, or the one matching the specified handle."""
        if mockSock is None:
            if len(self._connections) == 1:
                mockSock = self._connections.keys()[0]
            else:
                raise RuntimeError("Test Case must specify which connection to disconnect when there is more than one connection")
        if mockSock not in self._connections:
            raise RuntimeError("Specified client connection already disconncted")
        else:
            connectionData = self._connections[mockSock]
            del self._connections[mockSock]
            self.onClientDisconnect(mockSock,connectionData)
            
    def mock_isClientConnected(self, mockSock):
        """Returns True if the handle for the client specified is still connected"""
        return mockSock in self._connections
        
    def mock_wasUpdateClientsCalled(self):
        """Returns True if updateClients was called since last time this method was called"""
        tmp = self._updateClientsCalled
        self._updateClientsCalled = False
        return tmp
        
        
        