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
    from dvbcss.protocol.ts import ControlTimestamp
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
from dvbcss.protocol.cii import CII

cherrypy.tools.css_proxy = WSServerTool()


class CssProxy_ServerEndpoint(object):
    """\
    Websocket server that provides an endpoint for a single CSS server
    (e.g. TV in a browser) to connect to.
    
    Expects to receive JSON messages from the CSS server that are a JSON object
    containing zero, one or more of the following properties:
    * "cii" whose value is a CII message (in JSON)
    * "controlTimestamps" whose value is an object where each property name is
      a timeline selector and each property value is a Control Timestamp
      corresponding to that timeline selector.
    
    Example message that updates both CII and Control Timestamps:
    .. code-block:: json
    
        {
            "cii" : {
                "contentId"          : "dvb://233a.1004.1080;21af~20131004T1015Z--PT01H00M",
                "contentIdStatus"    : "final",
                "presentationStatus" : "okay'
            },
            "controlTimestamps" : {
                "urn:dvb:css:timeline:pts" : {
                    "contentTime"             : "93824762",
                    "wallClockTime"           : "13184637468146",
                    "timelineSpeedMultiplier" : 1.0
                }
            },
            "options" : {
                "blockCii": false
            }
        }
        
    Will send messages to inform the CSS Server of what timelines are required.
    It also includes updates on the number of slaves.
    The timeline selectors are provided as a list of selectors to add and remove
    Below is an example where a PTS timeline needs to be added. 
    .. code-block:: json
    
        {
            "add_timelineSelectors"    : [ "urn:dvb:css:timelines:pts" ],
            "remove_timelineSelectors" : [ ],
            "nrOfSlaves": 2
        }
        
    You can also provide a string as an initial message that will be sent when a client first connects.
    """
    ServerBase = WSServerBase
    
    def __init__(self, initialMsg=""):
        super(CssProxy_ServerEndpoint,self).__init__()
        self.selectors = []
        self.webSock = None
        self._initialMsg = initialMsg
        self._serverConnected = False

        self._server = self.ServerBase(maxConnectionsAllowed=-1, enabled=True)
        self._server.getDefaultConnection = self._getDefaultConnectionData
        self._server.onClientConnect = self._onClientConnect
        self._server.onClientDisconnect = self._onClientDisconnect
        self._server.onClientMessage = self._onClientMessage
        
    @property
    def enabled(self):
        """\
        (read/write :class:`bool`) Whether the server is enabled or disabled.
        Set to True or False to enable/disable the server. Disabling the server
        will cause any connected clients to disconnect.
        """
        return self._server.enabled
        
    @enabled.setter
    def enabled(self,value):
        self._server.enabled = value
        
    @property
    def serverConnected(self):
        """\
        :returns: True if a client is connected. Otherwise returns False.
        """
        return self._serverConnected
        
    def _getDefaultConnectionData(self):
        return None
        
    def _onClientConnect(self, webSock):
        self.webSock = webSock
        self.sendInitialInfo();
        self.sendTimelinesRequest(self.selectors, self.selectors, [])
        self._serverConnected = True
        self.onServerConnected()
        
    def _onClientDisconnect(self, webSock, connectionData):
        self.webSock = None
        self._serverConnected = False
        self.onServerDisconnected()
    
    def _onClientMessage(self, webSock, message):
        msg = json.loads(str(message))
        print msg
        print
        
        if "cii" in msg:
            cii = CII.unpack(json.dumps(msg["cii"]))
        else:
            cii = CII()
            
        controlTimestamps = {}
        if "controlTimestamps" in msg:
            for timelineSelector, recvControlTimestamp in msg["controlTimestamps"].items():
                ct = ControlTimestamp.unpack(json.dumps(recvControlTimestamp))
                controlTimestamps[timelineSelector] = ct
            
        options = {}
        if "options" in msg:
            options = msg["options"]
            
        self.onUpdate(cii,controlTimestamps, options)
        
    def sendInitialInfo(self):
        if self.webSock and self._initialMsg != "":
            try:
                self.webSock.send(self._initialMsg)
            except Exception as ex:
                self.webSock.terminate()
        
    def sendTimelinesRequest(self, allSelectors, added, removed):
        """\
        Called to send an update to the server, informing it of what timelines
        are required by clients and what changes there have been to what is
        required.
        
        :param allSelectors: array of all required timeline selector strings.
        :param added: array of all newly required timeline selector strings.
        :param removed: array of all no-longer required timeline selector strings.
        """
        self.selectors = allSelectors[:]
        if self.webSock:
            msg = { "add_timelineSelectors":added, "remove_timelineSelectors":removed }
            self.webSock.send(json.dumps(msg))
        
    def updateNumberOfSlaves(self, nrOfSlaves):
        """\
        Call to send a message updating the server of how many slaves are connected.
        
        :param nrOfSlaves: integer number of slaves currently connected to CII
        """
        if self.webSock:
            msg = { "nrOfSlaves":int(nrOfSlaves) }
            self.webSock.send(json.dumps(msg))
            
    def onUpdate(self, cii, controlTimestamps,options):
        """\
        Called when an update is received from the server.
        
        :param cii: :class:`~dvbcss.protocol.cii.CII` object updating CII state to be served.
        :param controlTimestamps: :class:`dict` mapping from timeline selectors (as :class:`str`) to to :class:`~dvbcss.protocol.ts.ControlTimestamp` objects
        :param options: :class:`dict` containing various options as key-value pairs
        """
        pass
        
    def onServerConnected(self):
        """Called when the TV server connects"""
        pass
        
    def onServerDisconnected(self):
        """Called when the TV server disconnects"""
        pass
