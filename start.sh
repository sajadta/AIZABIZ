#!/bin/bash
export NODE_ENV=production
export NODE_OPTIONS='--dns-result-order=ipv4first'
node dist/server.cjs
