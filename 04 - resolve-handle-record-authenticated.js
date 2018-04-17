const axios = require('axios')
const util = require('util');
const fs = require('fs')
const crypto = require('crypto');
const definition = require('./definitions.js')

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; // ignores self signed certs

/*
    Split the Handle ID using the "/" separator.
    The first portion is the prefix.
*/
let prefix =  definition.handleid.split('/'); // index 0 stores the prefix if a valid "/" is found
let ghrURL = util.format("https://%s:%d/api/handles/0.NA/%s",definition.ghrIP, definition.ghrPort, prefix[0])
let siteInfo = {}
let msgStr = ""
let sessionId = ""

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
                    //console.log(msgStr)
                    //console.log(siteInfoStr)

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
.then( prefixSiteInformation => {
    /*
        For this example code, we only take the first instance. 
        For production version, select based on admin and query needs.
    */
    siteInfo = prefixSiteInformation[0]

    // initiate the authentication process with the server

    // generate a random 16 byte buffer for authentication
    clientNonceBytes = crypto.randomBytes(16)
    siteInfo.clientNonceBytesStr = clientNonceBytes.toString('base64')

    // the endpoint to send the initialization request
    let initiateSessionURL = util.format("https://%s:%d/api/sessions", siteInfo.address, siteInfo.port)
    postHeader = {}
    postHeader.headers = {}
    // set the "Authorization" header with the random bytes in base64 encoding
    postHeader.headers.Authorization = util.format("Handle cnonce=\"%s\"", siteInfo.clientNonceBytesStr)
    
    // return the server response to the next step of the process
    return axios.post(initiateSessionURL, null, postHeader)

})
.then( initSession => {

    // use the server provided response

    /*
    msgStr = util.format("Got back the following data from the server %s on port %d", siteInfo.address, siteInfo.port)
    console.log(msgStr)
    let initSessionStr = JSON.stringify(initSession.data, null, 4)
    console.log(initSessionStr)
    */

    // extract the server nonce and convert it into bytes
    let serverNonceBytes = Buffer.from(initSession.data.nonce, 'base64')
    let clientNonceBytes = Buffer.from(siteInfo.clientNonceBytesStr, 'base64')

    // authentication uses RSA SHA256 signature
    let signer = crypto.createSign('RSA-SHA256');
    signer.update(serverNonceBytes) // server bytes always comes first
    signer.update(clientNonceBytes) // combine it with the client bytes

    // Sign the nonce using our private key.
    let pem = fs.readFileSync(fs.realpathSync (definition.authPrivateKey))

    /*
        sign the hash using our own private key. The server will verify the signature using our public key
        found at <index>:<handleid>
    */
    let signatureString = signer.sign({key: pem, passphrase: definition.authPrivateKeyPassword}, 'base64');
    //console.log(signatureString);

    let verifyUserURL = util.format("https://%s:%d/api/sessions/this", siteInfo.address, siteInfo.port)
    postHeader = {}
    postHeader.headers = {}
    // send the signed signature with our <index>:<handleid> to the server for verification
    postHeader.headers.Authorization = util.format("Handle \
    cnonce=\"%s\", \
    sessionId=\"%s\", \
    id=\"%d:%s\", \
    type=\"HS_PUBKEY\", \
    alg=\"SHA256\", \
    signature=\"%s\"", siteInfo.clientNonceBytesStr, initSession.data.sessionId, definition.authIndex, definition.authHandleID, signatureString)
    //console.log(postHeader.headers.Authorization)

    // return the server response to the next step of the process
    return axios.post(verifyUserURL, null, postHeader)  

})
.then( verifyUser => {

    /*
    msgStr = util.format("Authentication response from server %s on port %d", siteInfo.address, siteInfo.port)
    console.log(msgStr)
    let verifyUserStr = JSON.stringify(verifyUser.data, null, 4)
    console.log(verifyUserStr)
    */
    
    // if the "authenticated" variable is set and it is true, means the authentication process succeeded without issues
    if (verifyUser.data.authenticated) {
        console.log("Successfully authenticated user")
    } else {
        msgStr = util.format("Encountered the following error %s", verifyUser.data.error)
        throw msgStr
    }

    return verifyUser.data
})
.then ( authenticatedData => {
    sessionId = authenticatedData.sessionId

    // resolve a Handle Record from the given information
    msgStr = util.format("Resolving Handle ID %s", definition.handleid)
    console.log(msgStr)

    let lhsURL = util.format("https://%s:%d/api/handles/%s",siteInfo.address, siteInfo.port, definition.handleid)

    requestHeader = {}
    requestHeader.headers = {}
    // to use a session, send the authenticated session ID as part of the request
    requestHeader.headers.Authorization = util.format("Handle sessionId=\"%s\"", sessionId)

    return axios.get(lhsURL, requestHeader)
})
.then (result => {
    let hdlResult = result.data

    hdlResultstr = JSON.stringify(hdlResult, null, 4)
    console.log(hdlResultstr)

} )
.then( authenticatedData => { 
    //console.log("After successful authentication, we terminate the session.")

    // if the session ID length is more than 0, it is set. This is just one way to do it.
    if (sessionId.length != 0) {
        // terminate the session after we're done with it

        let deleteURL = util.format("https://%s:%d/api/sessions/this", siteInfo.address, siteInfo.port)

        deleteHeader = {}
        deleteHeader.headers = {}
        // to use or delete a session, send the authenticated session ID as part of the request
        deleteHeader.headers.Authorization = util.format("Handle sessionId=\"%s\"", sessionId)

        return axios.delete(deleteURL, deleteHeader) 
    }

})
.then ( deleteData => {

    // a successful termination of session returns HTTP status code 204 with no body
    msgStr = util.format("Session terminated for server %s on port %d. Received status code %d", siteInfo.address, siteInfo.port, deleteData.status)
    console.log(msgStr)
})
.catch(error => {
    console.log(error)
})
