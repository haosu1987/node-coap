/*
 * Copyright (c) 2013-2015 node-coap contributors.
 *
 * node-coap is licensed under an MIT +no-false-attribs license.
 * All rights not explicitly granted in the MIT license are reserved.
 * See the included LICENSE file for more details.
 */

var dgram           = require('dgram')
  , net             = require('net')
  , util            = require('util')
  , crypto          = require('crypto')
  , events          = require('events')
  , LRU             = require('lru-cache')
  , parse           = require('coap-packet').parse
  , generate        = require('coap-packet').generate
  , IncomingMessage = require('./incoming_message')
  , OutgoingMessage = require('./outgoing_message')
  , ObserveStream   = require('./observe_write_stream')
  , parameters      = require('./parameters')
  , RetrySend       = require('./retry_send')
  , parseBlock2     = require('./helpers').parseBlock2
  , createBlock2    = require('./helpers').createBlock2
  , getOption       = require('./helpers').getOption

function parseRequest(request, next) {
  try {
    request.packet = parse(request.raw)
    next(null)
  } catch (err) {
    next(err)
  }
}

function handleServerRequest(request, next) {
  if (request.proxy) {
    return next();
  }
  try {
    request.server._handle(request.packet, request.rsinfo)
    next(null)
  } catch (err) {
    next(err)
  }
}

function proxyRequest(request, next) {
  for (var i = 0; i < request.packet.options.length; i++) {
    if (request.packet.options[i].name.toLowerCase() === 'proxy-uri') {
      request.proxy = request.packet.options[i].value.toString()
    }
  }

  if (request.proxy) {
    if (request.packet.token.length === 0) {
      request.packet.token = crypto.randomBytes(8);
    }

    request.server._proxiedRequests[request.packet.token.toString('hex')] = request
    request.server._sendProxied(request.packet, request.proxy, next)
  } else {
    next(null)
  }
}

function handleProxyResponse(request, next) {
  if (request.proxy) {
    return next(null)
  }

  var originalProxiedRequest = request.server._proxiedRequests[request.packet.token.toString('hex')]
  if ( originalProxiedRequest ) {
    request.server._sendReverseProxied(request.packet, originalProxiedRequest.rsinfo)
    delete request.server._proxiedRequests[request.packet.token.toString('hex')]
    next(null)
  } else {
    next()
  }
}

exports.parseRequest = parseRequest
exports.handleServerRequest = handleServerRequest
exports.proxyRequest = proxyRequest
exports.handleProxyResponse = handleProxyResponse

