import { DocumentServer, CollabServer, CollabServerConfigurator } from 'substance'
import express from 'express'
import path from 'path'
import http from 'http'
import { Server as WebSocketServer } from 'ws'
import SimpleWriterServerPackage from './lib/server/SimpleWriterServerPackage'
import seed from './seed'

let cfg = new CollabServerConfigurator()

// Import server configuration
cfg.import(SimpleWriterServerPackage)

/*
  Seeding. This is only necessary with our in-memory stores.
*/
let documentStore = cfg.getDocumentStore()
let changeStore = cfg.getChangeStore()
let snapshotStore = cfg.getSnapshotStore()

documentStore.seed(seed.documentStore)
changeStore.seed(seed.changeStore)
snapshotStore.seed(seed.snapshotStore)

/*
  Setup Express, HTTP and Websocket Server
*/
let app = express()
let httpServer = http.createServer();
let wss = new WebSocketServer({ server: httpServer })

/*
  DocumentServer provides an HTTP API to access snapshots
*/
var documentServer = new DocumentServer({
  configurator: cfg
})
documentServer.bind(app)

/*
  CollabServer implements the server part of the collab protocol
*/
var collabServer = new CollabServer({
  configurator: cfg
})

collabServer.bind(wss)

/*
  Serve static files (e.g. the SimpleWriter client)
*/
app.use('/', express.static(path.join(__dirname, '/dist')))

/*
  Error handling

  We send JSON to the client so they can display messages in the UI.
*/
app.use(function(err, req, res, next) {
  if (res.headersSent) {
    return next(err)
  }

  if (err.inspect) {
    // This is a SubstanceError where we have detailed info
    console.error(err.inspect())
  } else {
    // For all other errors, let's just print the stack trace
    console.error(err.stack)
  }

  res.status(500).json({
    errorName: err.name,
    errorMessage: err.message || err.name
  })
})

// Delegate http requests to express app
httpServer.on('request', app)

httpServer.listen(cfg.getPort(), cfg.getHost(), function() {
  console.info('Listening on http://' + cfg.getHost() + ':' + httpServer.address().port)
})
