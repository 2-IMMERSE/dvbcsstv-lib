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

import cherrypy
import json
from dvbcss.protocol.server import WSServerTool
from dvbcss.protocol.server import WSServerBase



cherrypy.tools.wcws = WSServerTool()


class WebSocketWallClock_ServerEndpoint(object):
    """\
    This is a hacky alternative version of the Wall Clock protocol where the
    messages are carried as JSON objects via WebSockets instead of as binary
    data structures via UDP. The same fields are intended to be carried.
    
    This server simply updates the JSON object it receives by adding the following
    properties.
    
        precision           server clock precision (Number, seconds)
        maxFrequencyError   server clock max freq error (Number, ppm)
        removeReceiveTime   time the server received this message (Number, nanoseconds)
        localSendTime       time the server sent this message (Number, nanoseconds)
        
    This server does not parse or check any properties in the object it
    receives from the client. So potentially the client could even send just
    an empty JSON object:
    
        { }
        
    But it can also include any properties it wishes.
    """
    ServerBase = WSServerBase
    
    def __init__(self, wallClock, precision, mfe):
        super(WebSocketWallClock_ServerEndpoint,self).__init__()
        
        self.wallClock = wallClock
        self.precision = precision
        self.mfe = mfe

        self.server = self.ServerBase(maxConnectionsAllowed=-1, enabled=True)
        self.server.onClientConnect = self._onClientConnect
        self.server.onClientDisconnect = self._onClientDisconnect
        self.server.onClientMessage = self._onClientMessage
        
    @property
    def enabled(self):
        return self.server.enabled
        
    @enabled.setter
    def enabled(self,value):
        self.server.enabled = value

        
    def _getDefaultConnectionData(self):
        return None
        
    def _onClientConnect(self, webSock):
        pass
        
    def _onClientDisconnect(self, webSock, connectionData):
        pass
    
    def _onClientMessage(self, webSock, message):
        rxTime = self.wallClock.nanos
        
        msg = json.loads(str(message))
        
        msg["t"] = 1
        msg["rt"]  = msg["remoteReceiveTime"] = rxTime
        msg["p"]   = msg["precision"] = self.precision
        msg["mfe"] = msg["maxFrequencyError"] = self.mfe
        msg["tt"]  = msg["remoteSendTime"] = self.wallClock.nanos
        msg["rt"] = msg["rt"] / 1000000000.0
        msg["tt"] = msg["tt"] / 1000000000.0
        
        
        webSock.send(json.dumps(msg))
