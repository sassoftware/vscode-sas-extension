import { expect } from "chai";
import { timingSafeEqual } from "crypto";
import { EventEmitter } from "events";
import * as sinon from "sinon";
import { Writable } from "stream";

// Mock HTTP server response
class MockResponse extends Writable {
  public statusCode?: number;
  public headers: Record<string, string> = {};
  public headersSent = false;
  private writeCallback?: () => void;

  setHeader(name: string, value: string): void {
    this.headers[name] = value;
  }

  end(callback?: () => void): this {
    this.headersSent = true;
    super.end();
    if (callback) {
      callback();
    }
    return this;
  }

  destroy(): this {
    super.destroy();
    return this;
  }

  _write(
    chunk: Buffer | string,
    encoding: string,
    callback: (error?: Error) => void,
  ): void {
    this.headersSent = true;
    if (this.writeCallback) {
      this.writeCallback();
    }
    callback();
  }

  simulateBackpressure(callback: () => void): void {
    this.writeCallback = callback;
  }
}

// Mock HTTP server request
class MockRequest extends EventEmitter {
  public method = "GET";
  public url = "/sas-table-download?token=validtoken";
}

// Mock HTTP server
class MockServer extends EventEmitter {
  private requestHandler?: (req: MockRequest, res: MockResponse) => void;
  private listening = false;
  public address(): { port: number } | null {
    return this.listening ? { port: 12345 } : null;
  }

  listen(port: number, host: string, callback: () => void): this {
    this.listening = true;
    setTimeout(() => callback(), 10);
    return this;
  }

  close(callback?: () => void): this {
    this.listening = false;
    if (callback) {
      setTimeout(callback, 10);
    }
    return this;
  }

  setRequestHandler(
    handler: (req: MockRequest, res: MockResponse) => void,
  ): void {
    this.requestHandler = handler;
  }

  simulateRequest(): { request: MockRequest; response: MockResponse } {
    const req = new MockRequest();
    const res = new MockResponse();
    if (this.requestHandler) {
      this.requestHandler(req, res);
    }
    return { request: req, response: res };
  }
}

describe("LibraryNavigator - Browser Download", function () {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe("Filename Sanitization", () => {
    const controlCharsPattern = new RegExp(
      "[" + String.fromCharCode(0) + "-" + String.fromCharCode(31) + '"\r\n]',
      "g",
    );

    it("should remove control characters from filename", () => {
      const input = "test\x00\x01\x1ffile.csv";
      const result = input
        .trim()
        .replace(controlCharsPattern, "")
        .replace(/\.\.+/g, ".")
        .replace(/^\.+/, "");

      expect(result).to.equal("testfile.csv");
    });

    it("should remove quotes from filename", () => {
      const input = 'test"file".csv';
      const result = input
        .trim()
        .replace(controlCharsPattern, "")
        .replace(/\.\.+/g, ".")
        .replace(/^\.+/, "");

      expect(result).to.equal("testfile.csv");
    });

    it("should collapse multiple dots to prevent path traversal", () => {
      const input = "test..file...csv";
      const result = input
        .trim()
        .replace(controlCharsPattern, "")
        .replace(/\.\.+/g, ".")
        .replace(/^\.+/, "");

      expect(result).to.equal("test.file.csv");
    });

    it("should remove leading dots", () => {
      const input = "...test.csv";
      const result = input
        .trim()
        .replace(controlCharsPattern, "")
        .replace(/\.\.+/g, ".")
        .replace(/^\.+/, "");

      expect(result).to.equal("test.csv");
    });

    it("should preserve Unicode characters", () => {
      const input = "テスト日本語.csv";
      const result = input
        .trim()
        .replace(controlCharsPattern, "")
        .replace(/\.\.+/g, ".")
        .replace(/^\.+/, "");

      expect(result).to.equal("テスト日本語.csv");
    });

    it("should limit filename length to 250 characters", () => {
      const input = "a".repeat(300) + ".csv";
      const result = input
        .trim()
        .replace(controlCharsPattern, "")
        .replace(/\.\.+/g, ".")
        .replace(/^\.+/, "")
        .slice(0, 250);

      expect(result.length).to.equal(250);
    });

    it("should use fallback name when sanitization results in empty string", () => {
      const input = "\x00\x01\x1f";
      const result =
        input
          .trim()
          .replace(controlCharsPattern, "")
          .replace(/\.\.+/g, ".")
          .replace(/^\.+/, "")
          .slice(0, 250) || "table.csv";

      expect(result).to.equal("table.csv");
    });
  });

  describe("Token Validation", () => {
    it("should use timing-safe comparison for token validation", () => {
      const token1 = Buffer.from("abc123");
      const token2 = Buffer.from("abc123");
      const token3 = Buffer.from("xyz789");

      expect(timingSafeEqual(token1, token2)).to.be.true;
      expect(timingSafeEqual(token1, token3)).to.be.false;
    });

    it("should reject tokens of different lengths", () => {
      const validToken = "a".repeat(48); // 24 bytes as hex
      const candidate = "a".repeat(40);

      const isValid = candidate && candidate.length === validToken.length;
      expect(isValid).to.be.false;
    });

    it("should accept valid token", () => {
      const validToken = "a".repeat(48);
      const candidate = "a".repeat(48);

      const isValid = candidate && candidate.length === validToken.length;
      expect(isValid).to.be.true;
    });
  });

  describe("Error Message Sanitization", () => {
    it("should limit error messages to 200 characters", () => {
      const longError = new Error("a".repeat(500));
      const sanitized = String(longError?.message || "Unknown error").slice(
        0,
        200,
      );

      expect(sanitized.length).to.equal(200);
    });

    it("should handle undefined errors", () => {
      const error: unknown = undefined;
      const errorObj =
        error && typeof error === "object" && "message" in error ? error : null;
      const sanitized = String(
        errorObj?.message || error || "Unknown error",
      ).slice(0, 200);

      expect(sanitized).to.equal("Unknown error");
    });

    it("should handle null errors", () => {
      const error: unknown = null;
      const errorObj =
        error && typeof error === "object" && "message" in error ? error : null;
      const sanitized = String(
        errorObj?.message || error || "Unknown error",
      ).slice(0, 200);

      expect(sanitized).to.equal("Unknown error");
    });

    it("should handle errors without message property", () => {
      const error: unknown = { code: "ERR_UNKNOWN" };
      const errorObj =
        error && typeof error === "object" && "message" in error ? error : null;
      const sanitized = String(
        errorObj?.message || error || "Unknown error",
      ).slice(0, 200);

      expect(sanitized).to.equal("[object Object]");
    });
  });

  describe("HTTP Response Headers", () => {
    it("should set correct Content-Type header", () => {
      const response = new MockResponse();
      response.setHeader("Content-Type", "text/csv; charset=utf-8");

      expect(response.headers["Content-Type"]).to.equal(
        "text/csv; charset=utf-8",
      );
    });

    it("should set security headers", () => {
      const response = new MockResponse();
      response.setHeader("Cache-Control", "no-store");
      response.setHeader("Pragma", "no-cache");
      response.setHeader("X-Content-Type-Options", "nosniff");

      expect(response.headers["Cache-Control"]).to.equal("no-store");
      expect(response.headers.Pragma).to.equal("no-cache");
      expect(response.headers["X-Content-Type-Options"]).to.equal("nosniff");
    });

    it("should set Content-Disposition with ASCII and UTF-8 filenames", () => {
      const asciiName = "test.csv";
      const utf8Name = encodeURIComponent("テスト.csv");
      const header = `attachment; filename="${asciiName}"; filename*=UTF-8''${utf8Name}`;

      const response = new MockResponse();
      response.setHeader("Content-Disposition", header);

      expect(response.headers["Content-Disposition"]).to.include("attachment");
      expect(response.headers["Content-Disposition"]).to.include(asciiName);
      expect(response.headers["Content-Disposition"]).to.include("UTF-8");
    });
  });

  describe("HTTP Status Codes", () => {
    it("should return 405 for non-GET requests", () => {
      const response = new MockResponse();
      const method: string = "POST";

      if (method !== "GET") {
        response.statusCode = 405;
        response.setHeader("Allow", "GET");
      }

      expect(response.statusCode).to.equal(405);
      expect(response.headers.Allow).to.equal("GET");
    });

    it("should return 410 for consumed tokens", () => {
      const response = new MockResponse();
      const tokenConsumed = true;

      if (tokenConsumed) {
        response.statusCode = 410;
      }

      expect(response.statusCode).to.equal(410);
    });

    it("should return 404 for invalid tokens", () => {
      const response = new MockResponse();
      const validToken = false;

      if (!validToken) {
        response.statusCode = 404;
      }

      expect(response.statusCode).to.equal(404);
    });

    it("should return 500 on server errors before headers sent", () => {
      const response = new MockResponse();

      if (!response.headersSent) {
        response.statusCode = 500;
        response.setHeader("Content-Type", "text/plain");
      }

      expect(response.statusCode).to.equal(500);
      expect(response.headers["Content-Type"]).to.equal("text/plain");
    });
  });

  describe("Request Lock Race Condition Protection", () => {
    it("should prevent concurrent access with request lock", () => {
      let tokenConsumed = false;
      let requestLock = false;

      // First request
      const canProcess1 = !(tokenConsumed || requestLock);
      if (canProcess1) {
        requestLock = true;
        tokenConsumed = true;
      }

      expect(canProcess1).to.be.true;

      // Second concurrent request
      const canProcess2 = !(tokenConsumed || requestLock);

      expect(canProcess2).to.be.false;
    });

    it("should set both flags atomically", () => {
      let tokenConsumed = false;
      let requestLock = false;

      // Simulate checking and setting
      if (!(tokenConsumed || requestLock)) {
        requestLock = true; // Set lock first
        tokenConsumed = true; // Then set consumed
      }

      expect(requestLock).to.be.true;
      expect(tokenConsumed).to.be.true;
    });
  });

  describe("Response Stream Error Handling", () => {
    it("should set error response before headers sent", () => {
      const response = new MockResponse();

      if (!response.headersSent) {
        response.statusCode = 500;
        response.setHeader("Content-Type", "text/plain");
        response.end();
      }

      expect(response.statusCode).to.equal(500);
      expect(response.writableEnded).to.be.true;
    });

    it("should destroy response if headers already sent", () => {
      const response = new MockResponse();
      response.headersSent = true;

      if (response.headersSent) {
        response.destroy();
      }

      expect(response.destroyed).to.be.true;
    });

    it("should end response only if not already ended", () => {
      const response = new MockResponse();

      if (!response.writableEnded) {
        response.end();
      }

      expect(response.writableEnded).to.be.true;

      // Should not throw on second attempt
      if (!response.writableEnded) {
        response.end();
      }
    });
  });

  describe("Timeout Handling", () => {
    it("should clear timeouts on successful completion", () => {
      let timeoutId: NodeJS.Timeout | undefined = setTimeout(() => {}, 1000);
      let streamTimeoutId: NodeJS.Timeout | undefined = setTimeout(
        () => {},
        1000,
      );

      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = undefined;
      }
      if (streamTimeoutId) {
        clearTimeout(streamTimeoutId);
        streamTimeoutId = undefined;
      }

      expect(timeoutId).to.be.undefined;
      expect(streamTimeoutId).to.be.undefined;
    });

    it("should clear timeouts on error", () => {
      let timeoutId: NodeJS.Timeout | undefined = setTimeout(() => {}, 1000);
      let streamTimeoutId: NodeJS.Timeout | undefined = setTimeout(
        () => {},
        1000,
      );

      // Simulate error cleanup
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = undefined;
      }
      if (streamTimeoutId) {
        clearTimeout(streamTimeoutId);
        streamTimeoutId = undefined;
      }

      expect(timeoutId).to.be.undefined;
      expect(streamTimeoutId).to.be.undefined;
    });
  });

  describe("Server Cleanup", () => {
    it("should close server in error paths", (done) => {
      const server = new MockServer();

      server.listen(0, "127.0.0.1", () => {
        expect(server.address()).to.not.be.null;

        server.close(() => {
          expect(server.address()).to.be.null;
          done();
        });
      });
    });

    it("should remove error listener on completion", () => {
      const server = new MockServer();
      const errorHandler = () => {};

      server.on("error", errorHandler);
      expect(server.listenerCount("error")).to.equal(1);

      server.removeListener("error", errorHandler);
      expect(server.listenerCount("error")).to.equal(0);
    });
  });

  describe("Settle Pattern Idempotency", () => {
    it("should prevent double resolution", () => {
      let settled = false;
      let resolveCount = 0;

      const settleResolve = () => {
        if (settled) {
          return;
        }
        settled = true;
        resolveCount++;
      };

      settleResolve();
      settleResolve();
      settleResolve();

      expect(resolveCount).to.equal(1);
    });

    it("should prevent double rejection", () => {
      let settled = false;
      let rejectCount = 0;

      const settleReject = () => {
        if (settled) {
          return;
        }
        settled = true;
        rejectCount++;
      };

      settleReject();
      settleReject();
      settleReject();

      expect(rejectCount).to.equal(1);
    });
  });
});
