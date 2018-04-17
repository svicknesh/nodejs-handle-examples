const axios = require('axios')
const util = require('util');
const definition = require('./definitions.js')

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; // ignores self signed certs

/*
    split the Handle ID using the "/" separator.
    The first portion is the prefix.
*/
let prefix =  definition.handleid.split('/'); // index 0 stores the prefix if a valid "/" is found
let ghrURL = util.format("https://%s:%d/api/handles/0.NA/%s",definition.ghrIP, definition.ghrPort, prefix[0])
let siteInfo = {}
let msgStr = ""

axios.get(ghrURL)
.then(ghrResponse => {

    console.log('Handle Response Code for GHR request: ', ghrResponse.data.responseCode)
    prefixSiteInformation = []
    
    switch (ghrResponse.data.responseCode) {
        case definition.responseCodeSuccess:
            // extract the site information
            console.log("Extracting HS_SITE Information")

            ghrResponse.data.values.forEach(hdlValue => {

                // look for HS_SITE Handle type
                if ("HS_SITE" == hdlValue.type) {
                    msgStr = util.format("Site information for prefix %s found", prefix[0])
                    siteInfoStr = JSON.stringify(hdlValue, null, 4)
                    console.log(msgStr)
                    console.log(siteInfoStr)

                    // loop through the available servers and pick the IP and HTTP port
                    /*
                        Each hdlValue has a "data" field that stores format and value.
                        For HS_SITE, the format is always "site".
                        Go through the value field to extract the needed information.
                        servers - list of servers defined for THIS prefix.
                    */
                   hdlValue.data.value.servers.forEach( server => {
                       msgStr = util.format("LHS IP address for prefix %s is %s", prefix[0], server.address)
                       console.log(msgStr)

                       // set this address to our own JSON
                       siteInfo.address = server.address
                       siteInfo.port = 0 // we initialize this to 0 because we only want a non-zero for port number

                       // now we look for the HTTP port in this interface.protocol field
                       server.interfaces.forEach(interface => {
                           if ("HTTP" == interface.protocol) {
                               msgStr = util.format("LHS Port for address %s is %d", server.address, interface.port)
                               console.log(msgStr)
                               
                               siteInfo.port = interface.port
                               siteInfo.admin = interface.admin
                               siteInfo.query = interface.query

                               return // once we find what we're looking for, we stop looking
                           }
                       })

                       // add this server information to the array to be used in the next part of the application
                       prefixSiteInformation.push(siteInfo)

                    })
                }
            })

        break
    }

    // return the site information for the next phase of the application.
    return prefixSiteInformation
})
.then( siteInfo => {
    /*
        For this example code, we only take the first instance. 
        For production version, select based on admin and query needs.
    */
    siteInfo = prefixSiteInformation[0]
    console.log("Got the following site information")
    console.log(JSON.stringify(siteInfo, null, 4))
})
.catch(error => {
    console.log(error)
})