### 0.1.1:

For this version, you will need to delete the "node_modules" folder and re-install

    $ rm -rf node_modules
    * npm install
    
This is because the `oipfObjectFactory` implementation has beeen refactored into
a separate project.

 * Improved `oipfObjectFactory` implementation that supports declaring <object> elements.
 * Updated 'grunt' and 'jasmine' dependencies to more recent versions.
 * Added oipf CSManager.getInterDevSyncURL() support

### 0.1.0:
 * Initial version, separated out of `dvbcss-browser-proxy` project
