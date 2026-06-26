Status: Historical
Owner: runtime
Last verified: 2026-06-26
Layer: wiki
Module: provider
Doc Type: historical

# Provider Proxy API

## Overview

The backend exposes a provider-agnostic proxy layer for chat and embeddings.
The public proxy route metadata is centralized in `server/src/config/public-api.ts`
and mounted into Swagger through the Fastify route schemas.
