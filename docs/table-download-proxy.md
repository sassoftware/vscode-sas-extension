# Proxy-Agnostic Browser Table Downloads

The host attachment download target supports two route modes for web REST/Compute
table exports:

- `external-uri` is the default. The extension host chooses an ephemeral private
  listener and asks `vscode.env.asExternalUri()` to expose it. This is the mode
  used by code-server deployments that provide the required external URI route.
- `fixed-proxy` is for deployments where an administrator publishes a stable
  reverse-proxy route to the extension host. The extension listens on the
  configured fixed port and opens the configured public URL without calling
  `asExternalUri()`.

## Configuration

Set these extension settings in the deployment that uses a fixed proxy:

```json
{
  "SAS.tableDownload.hostAttachment.mode": "fixed-proxy",
  "SAS.tableDownload.hostAttachment.listenHost": "127.0.0.1",
  "SAS.tableDownload.hostAttachment.listenPort": 46005,
  "SAS.tableDownload.hostAttachment.externalBaseUrl": "https://ide.example.invalid/sas-download/",
  "SAS.tableDownload.hostAttachment.authentication": "deployment"
}
```

The external base URL must use HTTPS and must not contain credentials, a query,
fragment, or a transfer token. The extension appends an opaque, short-lived,
single-use transfer token to the path and query used by the attachment route.
The public URL must not be derived from the workbench origin.

Fixed-proxy mode requires `authentication: "deployment"`. This is an explicit
administrator declaration that the proxy preserves the same user/session
boundary as the workbench or provides an equivalent authorization boundary. The
extension cannot infer that guarantee from the URL or listener itself.

## Proxy Contract

The administrator-managed proxy must:

- route the configured public path to the configured private listener;
- preserve the transfer path and query, or explicitly strip only the documented
  public prefix;
- preserve `Content-Disposition`, `Content-Type`, `Cache-Control`, and
  `X-Content-Type-Options` response headers;
- stream response bytes without buffering the complete CSV;
- preserve the authenticated user/session boundary used by the workbench; and
- make client disconnects observable by the extension listener.

The producer independently authorizes the SAS table export. A transfer token is
not a replacement for SAS authorization. The route must not add SAS credentials,
connection tokens, bearer tokens, or long-lived secrets to the public URL.

## Listener Placement

When the proxy shares the extension host's network namespace, bind the listener
to `127.0.0.1` and route the proxy to that loopback address. When the proxy is in
a separate container or pod, bind to the private interface needed by the proxy
and restrict the network so only the proxy can reach the listener. Do not publish
the listener port directly to users.

Any proxy product may satisfy this contract. For Caddy, configure the route and
prefix rewrite explicitly and use its low-latency streaming configuration as
appropriate for the deployed version. Proxy flushing does not itself guarantee
producer cancellation; the extension listener must observe response closure and
abort the producer.

## Support Matrix

Validate each deployment before documenting it as supported:

| Deployment                                       | Mode           | Result                                                                         |
| ------------------------------------------------ | -------------- | ------------------------------------------------------------------------------ |
| code-server with working external URI forwarding | `external-uri` | Supported when the listener is browser-reachable                               |
| OpenVSCode with a same-namespace reverse proxy   | `fixed-proxy`  | Supported after route, authentication, streaming, and cancellation checks pass |
| OpenVSCode with a separate proxy container       | `fixed-proxy`  | Supported only with private network reachability and safe listener binding     |
| OpenVSCode without route publication             | default        | Unsupported; do not report a loopback 404 as success                           |
| Misconfigured proxy                              | `fixed-proxy`  | Unsupported; fail with an actionable configuration error                       |

These settings do not establish deployment authentication. Real SAS authorization
and the deployment's session boundary must be verified separately.
