## Overview

NodeJS Examples for manipulating Handle Records

## Pre-requisites

- NodeJS v8.11.1

## Downloading

Execute `git clone https://github.com/svicknesh/nodes-handle-examples handle-example`

## Setup

After cloning the repository, perform the following steps to set up the environment.

- `npm install`
- You need the private key for the prefix to perform authentication. This key can be obtained from the prefix administrator.

## Testing the examples

- To run the codes, execute `node <file>.js`
    - Simple resolution 
        - `node 01 - resolve-handle-record-simple.js`
    - Getting site information 
        - `node 02 - get_site_info.js` 
    - Performing authentication
        - `node 03 - authentication-pubkey.js`
    - Resolve Handle with authentication
        - `node 04 - resolve-handle-record-authenticated.js`
    - Create/Update Handle Records
        - `node 05 - create-handle-record-authenticated.js`
    - Delete Handle Record
        - `node 06 - delete-handle-record-authenticated.js`

