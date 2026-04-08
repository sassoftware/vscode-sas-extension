# Python notebook autodisplay

The client requests `sas/pythonFinalExpression` from the existing Pyright
language server. Both Node and browser providers use the same detection logic.
No Tree-Sitter or native dependency is involved. Normal editor execution does
not request or inject autodisplay. In Python notebooks, clean output performs
final-expression detection and rewriting and decodes its output for
Jupyter-style display. Raw output skips detection and rewriting and preserves
the original SAS and Python execution output.

## Correctness

Pyright's `isExpressionNode` is an AST category, not an executable-statement
predicate: it includes annotations, assignments, await, and yield. Detection
explicitly excludes those statement types. A first module string literal is
left alone to preserve `__doc__`; strings later in the module can be displayed.
`None` is evaluated but produces no display.

AST offsets alone are insufficient. Pyright ranges omit the trailing comma in
`a,` and `*items,`. The detector recovers an adjacent trailing comma, then
reparses the parenthesized source and requires the same expression node type.
Malformed or unverifiable candidates execute unchanged. Keep offsets as the
source location contract, but never treat them as a complete syntax contract.

The final expression is assigned once at module scope, so walrus assignments
and comprehensions keep their scope. Evaluation occurs outside the display
guard and still raises normally. The display guard uses import statements and
bare exception handling so shadowed global builtin names and failing reprs
cannot fail execution. Random temporary names are removed afterward. Existing
source lines, docstrings, future imports, and trailing comments are retained;
the display block adds lines after user code.

Output uses an execution-specific UUID, begin/end framing, and JSON-escaped
repr text. Only complete, valid frames belonging to that execution are decoded.
Legacy marker-like output, foreign frames, and incomplete frames stay intact.
Frames may be concatenated to ordinary output without requiring a newline.
Embedded newlines are escaped on the wire and restored for the log renderer.

Notebook execution batches are serialized within the controller. Detection
does not acquire the session's log callback; ownership starts immediately before
the run. Interrupt invalidates older queued batches, cancels pending detection,
and cancels an active SAS run. Disposal also invalidates queued work. A new
batch cannot clear the interruption state of an older active batch.

## Performance and cancellation

Autodisplay is skipped above 100,000 UTF-16 code units, 256 bracket characters,
1,024 operator/separator characters, or 2,000 whitespace-delimited source
segments. These deliberately conservative checks include string/comment text;
false negatives affect display only. They run on both client and server.

Local raw-parser measurements on Windows, Node 26.5.0 (five parses per case):

| Approximate Size | Generated Assignments | Comment-Heavy Source |
| ---------------- | --------------------- | -------------------- |
| 100k             | 18-53 ms              | 0.3-3.6 ms           |
| 500k             | 87-115 ms             | 1.1-2.3 ms           |
| 1M               | 176-234 ms            | 2.4-5.0 ms           |

The 100k generated case grew the heap by about 93 MB across five parses before
GC. Heap deltas are GC-dependent, not retained-memory measurements. Large and
dense cases are now rejected before parsing; accepted source is reparsed once
for extraction validation. Parsing still shares the language-server event loop
and can briefly delay hover/completion/signature requests.

Cancellation is checked before and after parsing, but cannot preempt a running
synchronous Pyright parse. The client times out after one second, ignores late
responses, and allows at most one outstanding detection request per client.
If a server never settles a canceled request, further autodisplay is skipped
for that client rather than accumulating requests. Normal execution continues.

## Regression checks and limitations

Server tests cover both provider runtimes, standalone LSP dispatch, executable
statement classification, punctuation, CRLF, Unicode, malformed source,
thresholds, nesting, generated source, cancellation, and repeated requests.
Client tests cover original-versus-rewritten namespaces using Python, single
evaluation, walrus scope, tuple semantics, failing reprs, builtin shadowing,
owned framing, explicit output, interruption, overlapping/rapid batches,
disposal, server unavailability/restart, and raw output behavior. Runtime rewrite
tests require Python 3 (`py -3` on Windows, `python3` elsewhere).

The log transport is not a structured output channel. Transport truncation or
line splitting can leave an incomplete frame visible; it will not be decoded.
Already-lost stdout/stderr channel identity or trailing-newline information
cannot be reconstructed. Execution-scoped framing prevents accidental marker
collisions, not deliberate forgery by code that inspects its generated source.

Arbitrary repr implementations can run side effects, block, or terminate the
Python process. Exception guards cannot prevent those behaviors. Mutation of
the actual builtin/import modules can suppress display, but its exceptions are
contained. Serialization covers notebook batches in this controller, not other
consumers of the shared SAS session. Live SAS transport cancellation and browser
host responsiveness still require environment-specific smoke testing.
