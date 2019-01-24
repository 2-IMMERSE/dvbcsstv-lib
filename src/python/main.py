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



# Provides WC, TS, and CII servers but does not come up with the data for
# CII messages and Control Timestamps itself. Instead it acts as a proxy
# and forwards these requests through to a connected server (e.g. a fake
# TV running in a browser) that is also connected to this proxy.
#
# This proxy must be running on the same machine as the TV in a browser
# so that they share the same system clock that can be used as the wall clock
#
#  +---------------+                +------------+         +-----------------+
#  |               | ---CSS-CII---> |            |         |                 |
#  |               |                |            |         |                 |
#  | Companion app | ---CSS-TS----> | This proxy | <-----> | TV in a browser |
#  |               |                |            |         |                 |
#  |               | ---CSS-WC----> |            |         |                 |
#  +---------------+                +------------+         +-----------------+
#
# The DVB CSS server endpoints will only be enabled while the browser has an
# open connection. If it closes that connection then the server becomes disabled.
#
# Also includes a naive mapping of the wall clock protocol server as a WebSocket
# server instead of UDP. Which is used can be specified by a command line option

try:
    import dvbcss
except ImportError:
    import sys
    sys.stderr.write("""
    Could not import pydvbcss library. Suggest installing using pip, e.g. on Linux/Mac:
    
    $ sudo pip install pydvbcss
    """)
    sys.exit(1)



import argparse
import textwrap as _textwrap

import random

        
def makeEntropyForUrlPath():
    """\
    :returns: a 16 character string containing 128 bits of entropy using only hex characters
    """
    entropy = hex(random.getrandbits(128))
    entropy = entropy.replace("0x","").replace("L","")
    shortfall = 16-len(entropy)
    return ("0" * shortfall ) + entropy


# just for pretty printing argparse description
# from http://stackoverflow.com/questions/3853722/python-argparse-how-to-insert-newline-in-the-help-text

class MultilineFormatter(argparse.HelpFormatter):
    def _fill_text(self, text, width, indent):
        text = self._whitespace_matcher.sub(' ', text).strip()
        paragraphs = text.split('|n ')
        multiline_text = ''
        for paragraph in paragraphs:
            formatted_paragraph = _textwrap.fill(paragraph, width, initial_indent=indent, subsequent_indent=indent) + '\n\n'
            multiline_text = multiline_text + formatted_paragraph
        return multiline_text

                    
if __name__ == "__main__":
    
    import sys
    import json
    import logging

    import time
    import dvbcss.clock
    import dvbcss.util
    dvbcss.clock.time = time  # override to use normal time.time instead of monotonic_time.time

    import cherrypy
    from ws4py.server.cherrypyserver import WebSocketPlugin
    
    from dvbcss.protocol.server.ts import TSServer
    from dvbcss.clock import SysClock, CorrelatedClock, measurePrecision
    from dvbcss.protocol.server.wc import WallClockServer
    from dvbcss.util import parse_logLevel

    from WebSocketWallClock_ServerEndpoint import WebSocketWallClock_ServerEndpoint
    from CssProxyEngine import CssProxyEngine, BlockableCIIServer

    parser=argparse.ArgumentParser(description="""\
        Proxy server for CSS protocols. Acts as a server for CSS-CII, CSS-TS and CSS-WC
        and also provides a separate websocket server through which this server can be
        controlled (the server/proxy interface).
        |n
        Also implements an optional WebSocket based version of the WallClock protocol.
        |n
        The server binds to '0.0.0.0'. By default, connections to the server interface
        will be refused unless they come in via the 127.0.0.1 interface. This can be overridden
        via a command line option. The servers for the other protocols are not restricted
        in this way.
        |n
        The CSS-CII protocol advertises the URL of the CSS-WC and CSS-TS endpoints. By default
        it advertises using the same IP address as that which the client connects to, unless
        overridden via a command line option.
        """,
        formatter_class=MultilineFormatter)
    
    parser.add_argument(
        "--advertise_addr",
        action="store", type=dvbcss.util.iphost_str, nargs=1,
        default=None,
        help="IP address to advertise server as. Must match IP address that clients will see (i.e. cannot be 0.0.0.0). If not set, the host will be set to the IP address of the interface to which the client connects to contact the CII server.")
        
    parser.add_argument(
        "--ws_port",
        action="store", type=dvbcss.util.port_int, nargs=1,
        default=[7681],
        help="Port number to host websocket server on")
        
    parser.add_argument(
        "--wc_port",
        action="store", type=dvbcss.util.port_int, nargs=1,
        default=[6677],
        help="Port number to host udp wallclock server on")
        
    parser.add_argument(
        "-w","--ws","--websocket-wallclock",
        action="store_true", dest="use_wswc",
        default=False,
        help="Run an alternative non-standard websocket based wallclock server to companions instead of a UDP based one (as defined in the DVB CSS / HbbTV specs)"
    )
    
    parser.add_argument(
        "--proxy-listen-on",
        action="store", dest="proxy_listen_addrs",
        default=["127.0.0.1"],
        nargs="*",
        help="Specify the interfaces on which connections to the proxy WS interface will be accepted."
    )
    
    parser.add_argument(
        "--loglevel",
        action="store", dest="loglevel",
        type=parse_logLevel,
        nargs=1,
        help="Set logging level  to one of: critical, error, warning, info, debug. Default=warning.",
        default=[logging.WARNING]
    )

    args = parser.parse_args()
    
    logging.basicConfig(level=args.loglevel[0])
    
    HOST="0.0.0.0"
    WC_PORT=args.wc_port[0]
    WS_PORT=args.ws_port[0]
    SERVER_LISTEN_ON=args.proxy_listen_addrs
    
    # if no override, then allow CII server to rewrite wcUrl and tsUrl to include the IP of the interface the client connects on
    # (pydvbcss>=0.5.0 functionality)
    # otherwise, set it to the specified value and prevent the CII server from rewriting it.
    if args.advertise_addr is None:
        ADVERTISE_HOST="{{host}}"
        CII_REWRITE_PROPS=['wcUrl','tsUrl']
    else:
        ADVERTISE_HOST=args.advertise_addr[0]
        CII_REWRITE_PROPS=[]

    WebSocketPlugin(cherrypy.engine).subscribe()

    cherrypy.config.update({"server.socket_host":HOST})
    cherrypy.config.update({"server.socket_port":WS_PORT})
    cherrypy.config.update({"engine.autoreload.on":False})

    wallClock= SysClock(tickRate=1000000000)
    precision = measurePrecision(wallClock,20)  # reduced iterations because on Windows the normal clock is low precision
    maxFreqError = 500
    wcServer = WallClockServer(wallClock, precision, maxFreqError, bindaddr=HOST, bindport=WC_PORT)
    wcWsServer = WebSocketWallClock_ServerEndpoint(wallClock, precision, maxFreqError)
    
    ciiServer = BlockableCIIServer(maxConnectionsAllowed=-1, enabled=False, rewriteHostPort=CII_REWRITE_PROPS)
    tsServer  = TSServer(None, wallClock, maxConnectionsAllowed=-1, enabled=False)

    proxyUrl = "ws://"+HOST+":"+str(WS_PORT)+"/server"
    ciiBoundUrl = "ws://"+HOST+":"+str(WS_PORT)+"/cii"
    ciiUrl = "ws://"+ADVERTISE_HOST+":"+str(WS_PORT)+"/cii"
    tsUrl = "ws://"+ADVERTISE_HOST+":"+str(WS_PORT)+"/ts"

    if args.use_wswc:
        wcUrl = "ws://"+ADVERTISE_HOST+":"+str(WS_PORT)+"/wcws"
    else:
        wcUrl = "udp://"+ADVERTISE_HOST+":"+str(WC_PORT)
    
    proxyEngine = CssProxyEngine(ciiServer, tsServer, ciiUrl, tsUrl, wcUrl)

    print
    print "--------------------------------------------------------------------------"
    print "Proxying server : "+proxyUrl

    print "CII Server at   : "+ciiBoundUrl
    print "  ... to be advertised as being at   : "+ciiUrl
    print "  ... that advertises a TS Server at : "+tsUrl
    print "                  and a WC Server at : "+wcUrl
    if args.advertise_addr is None:
        print "(where {{host}} is the host address/name from which the client makes contact)"
    print "--------------------------------------------------------------------------"
    print
    
    class Root(object):
        @cherrypy.expose
        def cii(self):
            pass
        
        @cherrypy.expose
        def ts(self):
            pass
            
        @cherrypy.expose
        def wcws(self):
            pass
    
        @cherrypy.expose
        def server(self):
            if cherrypy.request.remote.ip not in SERVER_LISTEN_ON:
                raise cherrypy.NotFound()
            else:
                pass
        
    
    cherrypy.tree.mount(Root(), "/", config={"/cii": {'tools.dvb_cii.on': True,
                                                      'tools.dvb_cii.handler_cls': ciiServer.handler},
                                             
                                             "/ts":  {'tools.dvb_ts.on': True,
                                                      'tools.dvb_ts.handler_cls': tsServer.handler},
                                                      
                                             "/wcws": {'tools.wcws.on' : True,
                                                       'tools.wcws.handler_cls': wcWsServer.server.handler},
                                                      
                                             "/server": {'tools.css_proxy.on' : True,
                                                         'tools.css_proxy.handler_cls': proxyEngine.serverEndpoint._server.handler} 
                                            })

    wcServer.start()
    
    cherrypy.engine.start()

    try:
        while True:
            time.sleep(0.1)
            sys.stdout.flush()
            sys.stderr.flush()

    except KeyboardInterrupt:
        pass
    finally:
        cherrypy.engine.exit()
        wcServer.stop()
