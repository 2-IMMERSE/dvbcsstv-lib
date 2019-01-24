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

class MockWSServerBase(object):
    """\
    Simple mock for pydvbcss's dvbcss.protocol.server.WSServerBase class
    
    Mocks the basic API of the class and provides a "websock" object representing connections, but this object
    only supports the send() method with payloads assumed to be strings.
    
    Also only supports a single connecting client
    """
    
    def __init__(self, maxConnectionsAllowed=-1, enabled=True):
        super(MockWSServerBase,self).__init__()
        
        self._enabled = enabled
        self._maxConnectionsAllowed = maxConnectionsAllowed
        self._connections = {}
        
    def getDefaultConnectionData(self):
        return { }
        
    
    def onClientConnect(self, webSock):
        raise NotImplementedError("onClientConnect not implemented")
    
    def onClientDisconnect(self, webSock, connectionData):
        raise NotImplementedError("onClientDisconnect not implemented")

    def onClientMessage(self, webSock, msg):
        raise NotImplementedError("onClientMessage not implemented")
    
    @property
    def enabled(self):
        return self._enabled
    
    @enabled.setter
    def enabled(self, value):
        self._enabled=value
        if not self._enabled:
            for webSock in self._connections.keys():
                webSock.close(code=1001) # 1001 = code for closure because server is "going away"
                del self._connections[webSock]

    def cleanup(self):
        self.enabled=False
        
    def getConnections(self):
        return self._connections
    
    def mock_clientConnects(self):
        """Mock interface to represent client connecting. Returns the 'websock' object as the handle"""
        if len(self._connections) >= self._maxConnectionsAllowed:
            raise RuntimeError("Test case tried to open more connections than the server allows")
        webSock = Mock_WebSock();
        self._connections[webSock] = self.getDefaultConnectionData()
        self.onClientConnect(webSock)
        return webSock
    
    def mock_clientDisconnects(self, webSock=None):
        """Mock interface to represent client disconnecting."""
        if len(self._connections) == 0:
            raise RuntimeError("Test Case cannnot disconnect clients when none are connected")
        if webSock is None:
            if len(self._connections)==1:
                webSock=self._connections.keys()[0]
            else:
                raise RuntimeError("Test Case must specify which connection to use when there is more then one conncetion from a client")
        conn=self._connections[webSock]
        del self._connections[webSock]
        self.onClientDisconnect(webSock, conn)

    def mock_clientSendsMessage(self, message, webSock=None):
        if webSock is None:
            if len(self._connections)==1:
                webSock=self._connections.keys()[0]
            else:
                raise RuntimeError("Test Case must specify which connection to use when there is more then one conncetion from a client")
        self.onClientMessage(webSock,message)

    def mock_popAllMessagesSentToClient(self, webSock=None):
        if webSock is None:
            if len(self._connections)==1:
                webSock=self._connections.keys()[0]
            else:
                raise RuntimeError("Test Case must specify which connection to use when there is more then one conncetion from a client")
        return webSock.mock_popReceivedMessages()
        

class Mock_WebSock(object):
    def __init__(self):
        super(Mock_WebSock,self).__init__()
        self._received = []
        
    def send(self, message):
        self._received.append(message)
        
    def mock_popReceivedMessages(self):
        tmp = self._received
        self._received = []
        return tmp
