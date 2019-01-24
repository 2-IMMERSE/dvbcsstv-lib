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


import sys
import json

try:
    from dvbcss.protocol import OMIT
except ImportError:
    sys.stderr.write("""
    Could not import pydvbcss library. Suggest installing using pip, e.g. on Linux/Mac:
    
    $ sudo pip install pydvbcss
    """)
    sys.exit(1)


from ProxyTimelineSource import ProxyTimelineSource
from CssProxy_ServerEndpoint import CssProxy_ServerEndpoint


from dvbcss.protocol.server.cii import CIIServer
from dvbcss.protocol.cii import CII

class BlockableCIIServer(CIIServer):
    def __init__(self, *args, **kwargs):
        super(BlockableCIIServer,self).__init__(*args,**kwargs)
        self._blocking=False
        
    def setBlocking(self, blocking):
        if bool(self._blocking) == bool(blocking):
            return
        self._blocking=blocking;
        if not self._blocking:
            self.updateClients()
        
    def onClientConnect(self, webSock):
        """Force not sending, if blocking"""
        if not self._blocking:
            super(BlockableCIIServer,self).onClientConnect(webSock)
        else:
            self.getConnections()[webSock]["prevCII"] = CII()
        self.onNumClientsChange(len(self.getConnections()))

    def onClientDisconnect(self, *args, **kwargs):
        super(BlockableCIIServer,self).onClientDisconnect(*args, **kwargs)
        self.onNumClientsChange(len(self.getConnections()))
            
    def updateClients(self, *args, **kwargs):
        if not self._blocking:
            super(BlockableCIIServer, self).updateClients(*args, **kwargs)
            
    def onNumClientsChange(self, newNumClients):
        """\
        Stub. Override in your implementation to be notified when the number of
        connected clients changes.
        """
        pass


class CssProxyEngine(object):
    """\
    Proxying server engine. Takes a CIIServer and TsServer and acts as a
    proxy data source for them, setting the CII properties and providing the
    timelines.
    
    It acts as a proxy. It creates a CssProxy_ServerEndpoint to which another
    client can connect (e.g. HTML+JS in a browser acting as the TV). When a
    client connects to that, the requests from clients for CII messages and
    for timelines are forwarded on via the server endpoint. Responses coming
    back are relayed back to clients.
    
    This proxy must be running on the same machine as the TV in a browser
    so that they share the same system clock that can be used as the wall clock
    
    +---------------+                +------------+         +-----------------+
    |               | ---CSS-CII---> |            |         |                 |
    |               |                |            |         |                 |
    | Companion app | ---CSS-TS----> | This proxy | <-----> | TV in a browser |
    |               |                |            |         |                 |
    |               | ---CSS-WC----> |            |         |                 |
    +---------------+                +------------+         +-----------------+
    
    The DVB CSS server endpoints will only be enabled while the browser has an
    open connection. If it closes that connection then the server becomes
    disabled.
    
    CII messages are modified to have the URLs of the Wall Clock and TS servers.
    """
    Server = CssProxy_ServerEndpoint
    TimelineSource = ProxyTimelineSource
    
    def __init__(self, ciiServer, tsServer, ciiUrl, tsUrl, wcUrl):
        """\
        :param ciiServer: A running BlockableCIIServer. Does not have to be enabled.
        :param tsServer:  A running TSServer. Does not have to be enabled.
        :param ciiUrl:    The URL of the CII server to be supplied to applications.
        :param tsUrl:     The URL of the TSServer endpoint.
        :param wcUrl:     The URL of WCServer endpoint.
        """
        initialMessage = json.dumps({
            "ciiUrl": ciiUrl
        })
        
        # create wallclock server
        self.ciiServer = ciiServer
        self.tsServer = tsServer

        self.ciiServer.cii.tsUrl = tsUrl
        self.ciiServer.cii.wcUrl = wcUrl
        
        self.ciiServer.onNumClientsChange = self._onNumCiiClientsChanged
        
        self.tsSource = self.TimelineSource()
        self.serverEndpoint = self.Server(initialMessage)
        
        self.tsServer.attachTimelineSource(self.tsSource)
        
        self._onServerConnectionStateChange()
        
        self.tsSource.onRequestedTimelinesChanged = self._onRequestedChangeFromClients
        
        self.serverEndpoint.onUpdate = self._onUpdateFromServer
        self.serverEndpoint.onServerConnected = self._onServerConnectionStateChange
        self.serverEndpoint.onServerDisconnected = self._onServerConnectionStateChange
        
    def _onNumCiiClientsChanged(self, newNumClients):
        self.serverEndpoint.updateNumberOfSlaves(newNumClients)
                
    def _onRequestedChangeFromClients(self, selectors, added, removed):
        self.serverEndpoint.sendTimelinesRequest(selectors, added,removed)
        
    def _onUpdateFromServer(self, cii, controlTimestamps, options):
        # don't allow these to be overridden - keep the values we first supplied
        cii.tsUrl = OMIT
        cii.wcUrl = OMIT
        
        if ("blockCii" in options) and options["blockCii"]:
            self.ciiServer.setBlocking(True)

        self.ciiServer.cii.update(cii)

        if ("blockCii" in options) and not options["blockCii"]:
            self.ciiServer.setBlocking(False)

        self.ciiServer.updateClients(sendOnlyDiff=True)
        
        # Update the TS server
        self.tsServer.contentId = self.ciiServer.cii.contentId
        self.tsSource.timelinesUpdate(controlTimestamps)
        self.tsServer.updateAllClients()
        
    def _onServerConnectionStateChange(self):
        connected = self.serverEndpoint.serverConnected
        self.ciiServer.enabled=connected
        self.tsServer.enabled=connected
        print "CII & TS Servers enabled?", connected
                    
