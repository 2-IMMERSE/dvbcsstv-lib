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

import unittest
import random
import json

import sys
sys.path.append("../../src/python")
from CssProxyEngine import CssProxyEngine

from dvbcss.protocol.cii import CII
from dvbcss.protocol import OMIT


from mock_ciiServer import MockCiiServer
from mock_tsServer import MockTsServer
from mock_wsServerBase import MockWSServerBase

ciiUrl = "flurble"
tsUrl = "blah"
wcUrl = "plig"

def makeRandomAToZString(length=10):
    codes = []
    for i in range(0,length):
        codes.append(random.randrange(64,64+25))
    return "".join([chr(c) for c in codes])
    
    

class Test_CssProxy(unittest.TestCase):
    """Tests of CssProxyEngine"""
    
    def setUp(self):
        self.mockServerBase = None
        self.ciiServer = MockCiiServer()
        self.tsServer = MockTsServer()
        self._orig_ServerBase = CssProxyEngine.Server.ServerBase
        CssProxyEngine.Server.ServerBase = self._mockWSServerBaseFactory
        
    def tearDown(self):
        CssProxyEngine.Server.ServerBase = self._orig_ServerBase
        self.tsServer.cleanup()
        self.ciiServer.cleanup()


    def _mockWSServerBaseFactory(self, *args, **kwargs):
        newServerBase = MockWSServerBase(*args, **kwargs)
        self.mockServerBase = newServerBase
        return newServerBase

        
    def test_defaultsServersToDisabled(self):
        """When the proxyengine takes control of CIIServer and TSServer, they default to being disabled"""
        self.ciiServer.enabled = True
        self.tsServer.enabled = True
        p = CssProxyEngine(self.ciiServer, self.tsServer, ciiUrl, tsUrl, wcUrl)
        self.assertFalse(self.ciiServer.enabled)
        self.assertFalse(self.tsServer.enabled)

    
    def test_serverAllowsSingleProxyConnection(self):
        """Check that the proxy has setup a server and enabled for a SINGLE connection from the browser"""
        self.assertIsNone(self.mockServerBase)
        p = CssProxyEngine(self.ciiServer, self.tsServer, ciiUrl, tsUrl, wcUrl)
        self.assertIsNotNone(self.mockServerBase)
        self.assertTrue(self.mockServerBase.enabled)
        self.assertEquals(self.mockServerBase._maxConnectionsAllowed,1)

    
    def test_ServerSideEnabledWhenProxyConnectionMade(self):
        """The CII and TS servers are enabled when a proxy connection is made and disabled again when it disconnects"""
        p = CssProxyEngine(self.ciiServer, self.tsServer, ciiUrl, tsUrl, wcUrl)
        self.mockServerBase.mock_clientConnects()
        self.assertTrue(self.ciiServer.enabled)
        self.assertTrue(self.tsServer.enabled)
        
        self.mockServerBase.mock_clientDisconnects()
        self.assertFalse(self.ciiServer.enabled)
        self.assertFalse(self.tsServer.enabled)
        

    def test_initialCiiMostlyEmpty(self):
        """Default CII message is correct before CII is updated by the browser"""
        p = CssProxyEngine(self.ciiServer, self.tsServer, ciiUrl, tsUrl, wcUrl)
        
        cii = self.ciiServer.cii
        self.assertEqual(len(cii.definedProperties()), 3)
        self.assertEqual(cii.protocolVersion, "1.1")
        self.assertEqual(cii.tsUrl, tsUrl)
        self.assertEqual(cii.wcUrl, wcUrl)


    def test_browserCiiPropogatedToCsa(self):
        """Check that CII update is propagated to CSAs"""
        p = CssProxyEngine(self.ciiServer, self.tsServer, ciiUrl, tsUrl, wcUrl)
        
        # browser connects
        self.mockServerBase.mock_clientConnects()
        
        # CSA connects
        self.ciiServer.mock_clientConnects()
        self.assertFalse(self.ciiServer.mock_wasUpdateClientsCalled())

        # update to CII
        msg = """\
        {
            "cii" : { "contentId": "boingboing", "presentationStatus":"okay", "contentIdStatus":"final" }
        }    
        """
        self.mockServerBase.mock_clientSendsMessage(msg)
        self.assertTrue(self.ciiServer.mock_wasUpdateClientsCalled())
        
        cii = self.ciiServer.cii
        self.assertEqual(cii.contentId, "boingboing")
        self.assertEqual(cii.contentIdStatus, "final")
        self.assertEqual(cii.presentationStatus, ["okay"])


    def test_browserCiiDoesNotOverwriteTsUrlAndWcUrl(self):
        """Check that CII update from the browser does not overwrite the tsUrl or wcUrl"""
        p = CssProxyEngine(self.ciiServer, self.tsServer, ciiUrl, tsUrl, wcUrl)
        
        # browser connects
        self.mockServerBase.mock_clientConnects()
        
        # CSA connects
        self.ciiServer.mock_clientConnects()
        self.assertFalse(self.ciiServer.mock_wasUpdateClientsCalled())

        # update to CII
        msg = """\
        {
            "cii" : { "tsUrl":"xxxyyy", "wcUrl":"3o87t3q8ot", "presentationStatus":"fault" }
        }    
        """
        self.mockServerBase.mock_clientSendsMessage(msg)
        self.assertTrue(self.ciiServer.mock_wasUpdateClientsCalled())
        
        cii = self.ciiServer.cii
        self.assertEqual(cii.tsUrl, tsUrl)
        self.assertEqual(cii.wcUrl, wcUrl)


    def test_browserCiiUpdatesPushed(self):
        """Check that whenever the browser updates CII it is pushed to clients"""
        p = CssProxyEngine(self.ciiServer, self.tsServer, ciiUrl, tsUrl, wcUrl)
        
        # browser connects
        self.mockServerBase.mock_clientConnects()
        
        # CSA connects
        self.ciiServer.mock_clientConnects()
        self.assertFalse(self.ciiServer.mock_wasUpdateClientsCalled())

        for i in range(0,10):
            c = makeRandomAToZString()
            msg =  """\
            {
                "cii" : { "contentId" : "%s" }
            }    
            """ % c
            self.mockServerBase.mock_clientSendsMessage(msg)
            self.assertTrue(self.ciiServer.mock_wasUpdateClientsCalled())
            self.assertEquals(self.ciiServer.cii.contentId, c)


    def test_checkAllCiiPropertiesForwarded(self):
        """"Check that all CII properties are pushed through from browser to CSAs (except tsUrl and wcUrl)"""
        p = CssProxyEngine(self.ciiServer, self.tsServer, ciiUrl, tsUrl, wcUrl)
        
        # browser connects
        self.mockServerBase.mock_clientConnects()
        
        # CSA connects
        self.ciiServer.mock_clientConnects()
        
        # CII updated by browser
        msg =  """\
            {
                "cii" : {
                    "protocolVersion" : "1.1",
                    "contentId" : "dvb://1234.5678.0123",
                    "contentIdStatus" : "partial",
                    "presentationStatus" : "okay muted",
                    "mrsUrl" : "http://mrs.example.com/mrs-service",
                    "tsUrl" : "ws://a.b.c.d/ts",
                    "wcUrl" : "udp://1.2.3.4:123",
                    "teUrl" : "ws://a.b.c.d/te",
                    "timelines" : [ 
                        {
                            "timelineSelector" : "urn:blah:plug:floooo",
                            "timelineProperties" : {
                                "unitsPerTick" : 1001,
                                "unitsPerSecond" : 60000,
                                "accuracy" : 0.3
                            }
                        },
                        {
                            "timelineSelector" : "urn:blah:plug:seilrgb",
                            "timelineProperties" : {
                                "unitsPerTick" : 1,
                                "unitsPerSecond" : 25
                            }
                        }
                    ],
                    "private" : [ { "type" : "blah", "flurgle" : [ 1, 2, { "f":true}, null, "hello" ] } ]
                }
            }    
        """
        self.mockServerBase.mock_clientSendsMessage(msg)
         
        cii = self.ciiServer.cii
        self.assertEquals(cii.protocolVersion, "1.1")
        self.assertEquals(cii.contentId, "dvb://1234.5678.0123")
        self.assertEquals(cii.contentIdStatus, "partial")
        self.assertEquals(cii.presentationStatus, ["okay", "muted"])
        self.assertEquals(cii.mrsUrl,  "http://mrs.example.com/mrs-service")
        self.assertEquals(cii.tsUrl, tsUrl)
        self.assertEquals(cii.wcUrl, wcUrl)
        self.assertEquals(cii.teUrl, "ws://a.b.c.d/te")
        self.assertEquals(cii.private,[ { "type" : "blah", "flurgle" : [ 1, 2, { "f":True}, None, "hello" ] } ])
        
        
    def test_contentIdUpdatedForTsServer(self):
        """When the browser updates the content ID, this is passed to the TS Server and CSAs are updated"""
        p = CssProxyEngine(self.ciiServer, self.tsServer, ciiUrl, tsUrl, wcUrl)
        
        # browser connects
        self.mockServerBase.mock_clientConnects()
        
        msg = """
        {
            "cii" : { "contentId" : "abcdef" }
        }
        """
        self.mockServerBase.mock_clientSendsMessage(msg)
        self.assertEquals(self.tsServer.contentId, "abcdef")
        self.assertTrue(self.tsServer.mock_wasUpdateAllClientsCalled())
        
        
    def test_timelineNeededForwardedToBrowser(self):
        """When the TS Server notifys that a timeline is needed then the browser is requested to add that timeline"""
        p = CssProxyEngine(self.ciiServer, self.tsServer, ciiUrl, tsUrl, wcUrl)
        
        # browser connects
        self.mockServerBase.mock_clientConnects()
        self.mockServerBase.mock_popAllMessagesSentToClient()
        
        # first timeline needed
        self.tsServer.mock_addTimelineSelector("urn:dvb:css:timeline:temi:2:160")
        msgsToBrowser = self.mockServerBase.mock_popAllMessagesSentToClient()
        self.assertEquals(len(msgsToBrowser), 1)
        msg = json.loads(msgsToBrowser[0])
        self.assertEquals(msg["add_timelineSelectors"], [ "urn:dvb:css:timeline:temi:2:160" ])
 
        
    def test_timelineNeededForwardedToBrowser2(self):
        """When the TS Server notifys that an additional timeline is needed then the browser is requested to add that timeline"""
        p = CssProxyEngine(self.ciiServer, self.tsServer, ciiUrl, tsUrl, wcUrl)
        
        # browser connects
        self.mockServerBase.mock_clientConnects()
        self.mockServerBase.mock_popAllMessagesSentToClient()
        
        # first timeline needed
        self.tsServer.mock_addTimelineSelector("urn:dvb:css:timeline:temi:2:160")
        msgsToBrowser = self.mockServerBase.mock_popAllMessagesSentToClient()
        
        # additional timeline needed
        self.tsServer.mock_addTimelineSelector("urn:foobar")
        msgsToBrowser = self.mockServerBase.mock_popAllMessagesSentToClient()
        self.assertEquals(len(msgsToBrowser), 1)
        msg = json.loads(msgsToBrowser[0])
        self.assertEquals(msg["add_timelineSelectors"], [ "urn:foobar" ])
        
        
    def test_timelineNotNeededForwardedToBrowser(self):
        """When the TS server notifys that a timeline is no longer needed then the browser is requested to remove that timeline"""
        p = CssProxyEngine(self.ciiServer, self.tsServer, ciiUrl, tsUrl, wcUrl)
        
        # browser connects
        self.mockServerBase.mock_clientConnects()
        self.mockServerBase.mock_popAllMessagesSentToClient()
        
        # first timeline needed
        self.tsServer.mock_addTimelineSelector("urn:dvb:css:timeline:temi:2:160")
        msgsToBrowser = self.mockServerBase.mock_popAllMessagesSentToClient()

        # additional timeline needed
        self.tsServer.mock_addTimelineSelector("urn:seiugh")
        msgsToBrowser = self.mockServerBase.mock_popAllMessagesSentToClient()

        # first timeline removed
        self.tsServer.mock_removeTimelineSelector("urn:dvb:css:timeline:temi:2:160")     
        msgsToBrowser = self.mockServerBase.mock_popAllMessagesSentToClient()
        self.assertEquals(len(msgsToBrowser), 1)
        msg = json.loads(msgsToBrowser[0])
        self.assertEquals(msg["remove_timelineSelectors"], [ "urn:dvb:css:timeline:temi:2:160" ])

        # second timeline removed
        self.tsServer.mock_removeTimelineSelector("urn:seiugh")     
        msgsToBrowser = self.mockServerBase.mock_popAllMessagesSentToClient()
        self.assertEquals(len(msgsToBrowser), 1)
        msg = json.loads(msgsToBrowser[0])
        self.assertEquals(msg["remove_timelineSelectors"], [ "urn:seiugh" ])

    def test_controlTimestampNotProvidedUntilBrowserProvides(self):
        """When a timeline is newly needed, control timestamps are not provided to CSAs until provided by the browser"""
        p = CssProxyEngine(self.ciiServer, self.tsServer, ciiUrl, tsUrl, wcUrl)
        
        # browser connects
        self.mockServerBase.mock_clientConnects()
        self.mockServerBase.mock_popAllMessagesSentToClient()
        
        # first timeline needed
        self.tsServer.mock_addTimelineSelector("urn:dvb:css:timeline:temi:2:160")
        msgsToBrowser = self.mockServerBase.mock_popAllMessagesSentToClient()

        # initially nothing because nothing provided by browser
        ct = self.tsServer.mock_getMostRecentCt("urn:dvb:css:timeline:temi:2:160")
        self.assertIsNone(ct)
        
        # then browser updates the proxy with an appropriate control timestmap
        msg = """
        {
            "controlTimestamps" : {
                "urn:dvb:css:timeline:temi:2:160" : {
                    "contentTime":"55",
                    "wallClockTime":"1234",
                    "timelineSpeedMultiplier":1.0
                }
            }
        }
        """    
        self.mockServerBase.mock_clientSendsMessage(msg)
        
        # now browser has a suitable control timestamp
        ct = self.tsServer.mock_getMostRecentCt("urn:dvb:css:timeline:temi:2:160")
        self.assertEquals(ct.timestamp.contentTime, 55)
        self.assertEquals(ct.timestamp.wallClockTime, 1234)
        self.assertEquals(ct.timelineSpeedMultiplier, 1.0)
        
        
    def test_controlTimestampOnlyForApplicableTimelineSelector(self):
        """When a browser proffers a control timestamp, it is only used for the timeline selector it is specified for"""
        p = CssProxyEngine(self.ciiServer, self.tsServer, ciiUrl, tsUrl, wcUrl)
        
        # browser connects
        self.mockServerBase.mock_clientConnects()
        self.mockServerBase.mock_popAllMessagesSentToClient()
        
        # two timelines needed
        self.tsServer.mock_addTimelineSelector("urn:dvb:css:timeline:temi:2:160")
        self.tsServer.mock_addTimelineSelector("urn:dvb:css:timeline:pts")
        msgsToBrowser = self.mockServerBase.mock_popAllMessagesSentToClient()

        # initially nothing because nothing provided by browser
        ct = self.tsServer.mock_getMostRecentCt("urn:dvb:css:timeline:temi:2:160")
        self.assertIsNone(ct)
        ct = self.tsServer.mock_getMostRecentCt("urn:dvb:css:timeline:pts")
        self.assertIsNone(ct)
        
        # then browser updates the proxy with an appropriate control timestmap
        msg = """
        {
            "controlTimestamps" : {
                "urn:dvb:css:timeline:pts" : {
                    "contentTime":"55",
                    "wallClockTime":"1234",
                    "timelineSpeedMultiplier":1.0
                }
            }
        }
        """    
        self.mockServerBase.mock_clientSendsMessage(msg)
        
        # now browser has a suitable control timestamp for one of them only
        ct = self.tsServer.mock_getMostRecentCt("urn:dvb:css:timeline:temi:2:160")
        self.assertEquals(ct, None)
        ct = self.tsServer.mock_getMostRecentCt("urn:dvb:css:timeline:pts")
        self.assertEquals(ct.timestamp.contentTime, 55)
        self.assertEquals(ct.timestamp.wallClockTime, 1234)
        self.assertEquals(ct.timelineSpeedMultiplier, 1.0)


    def test_tsAndCiiServersDisabledWhenBrowserDisconnects(self):
        """When the browser disconnects, the CII and TS servers and disabled"""
        p = CssProxyEngine(self.ciiServer, self.tsServer, ciiUrl, tsUrl, wcUrl)
        
        # browser connects
        self.mockServerBase.mock_clientConnects()
        
        self.assertTrue(self.ciiServer.enabled)
        self.assertTrue(self.tsServer.enabled)

        # browser disconnects
        self.mockServerBase.mock_clientDisconnects()
        self.assertFalse(self.ciiServer.enabled)
        self.assertFalse(self.tsServer.enabled)
        
        
    def test_controlTimestampsForgottenAfterTimelineNotNeeded(self):
        """When a timeline is no longer needed, but then needed again later, previous control timestamps are forgotten"""
        p = CssProxyEngine(self.ciiServer, self.tsServer, ciiUrl, tsUrl, wcUrl)
        
        # browser connects
        self.mockServerBase.mock_clientConnects()
        
        # timeline is needed and browser provides control timestamp
        self.tsServer.mock_addTimelineSelector("urn:dvb:css:timeline:pts")
        msg = """\
        {
            "controlTimestamps" : {
                "urn:dvb:css:timeline:pts" : {
                    "contentTime":"9573",
                    "wallClockTime":"12340001",
                    "timelineSpeedMultiplier":0.5
                }
            }
        }
        """
        self.mockServerBase.mock_clientSendsMessage(msg)

        self.tsServer.mock_removeTimelineSelector("urn:dvb:css:timeline:pts")
        self.tsServer.mock_addTimelineSelector("urn:dvb:css:timeline:pts")
        ct = self.tsServer.mock_getMostRecentCt("urn:dvb:css:timeline:pts")
        self.assertEquals(ct, None)


    def test_messageFromBrowserDoesNotCauseTimelinesToBeForgotten(self):
        """Messages from the browser only update the control timestamps they list and do not affect others"""
        p = CssProxyEngine(self.ciiServer, self.tsServer, ciiUrl, tsUrl, wcUrl)
        
        # browser connects
        self.mockServerBase.mock_clientConnects()
        
        # timeline is needed and browser provides control timestamp
        self.tsServer.mock_addTimelineSelector("urn:dvb:css:timeline:pts")
        self.tsServer.mock_addTimelineSelector("urn:dvb:css:timeline:temi:1:1")
        msg = """\
        {
            "controlTimestamps" : {
                "urn:dvb:css:timeline:pts" : {
                    "contentTime":"9573",
                    "wallClockTime":"12340001",
                    "timelineSpeedMultiplier":0.5
                },
                "urn:dvb:css:timeline:temi:1:1" : {
                    "contentTime":"1",
                    "wallClockTime":"12440001",
                    "timelineSpeedMultiplier":0.5
                }
            }
        }
        """
        self.mockServerBase.mock_clientSendsMessage(msg)
        
        msg = """\
        {
            "controlTimestamps" : {
                "urn:dvb:css:timeline:temi:1:1" : {
                    "contentTime":"15",
                    "wallClockTime":"13140001",
                    "timelineSpeedMultiplier":0.5
                }
            }
        }
        """
        self.mockServerBase.mock_clientSendsMessage(msg)

        ct = self.tsServer.mock_getMostRecentCt("urn:dvb:css:timeline:pts")
        self.assertEquals(ct.timestamp.contentTime, 9573)
        self.assertEquals(ct.timestamp.wallClockTime, 12340001)
        self.assertEquals(ct.timelineSpeedMultiplier, 0.5)
        ct = self.tsServer.mock_getMostRecentCt("urn:dvb:css:timeline:temi:1:1")
        self.assertEquals(ct.timestamp.contentTime, 15)
        self.assertEquals(ct.timestamp.wallClockTime, 13140001)
        self.assertEquals(ct.timelineSpeedMultiplier, 0.5)



if __name__ == "__main__":
    unittest.main(verbosity=1)
    