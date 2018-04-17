const axios = require('axios')
const util = require('util');
const definition = require('./definitions.js')

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; // ignores self signed certs

let url = util.format("https://%s:%d/api/handles/%s",definition.lhsIP, definition.lhsPort, definition.handleid)

axios.get(url)
.then(response => {

    // print the status code for this request
    console.log('statusCode:', response.status);

    // print the status message for this request
    console.log('statusText:', response.statusText);

    // print the HTTP headers for this request
    headerJSONStr = JSON.stringify(response.headers, null, 4)
    console.log('headers:', headerJSONStr);

    // print the HTTP body for this request
    bodyJSONstr = JSON.stringify(response.data, null, 4) // we do this to pretty-print JSON
    console.log('body:', bodyJSONstr)

})
.catch(error => {
    console.log(error.response)
})
