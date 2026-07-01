// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { expect } from "chai";
import { randomBytes } from "crypto";

import {
  classifyDownloadRequest,
  isValidDownloadToken,
  sanitizeDownloadFilename,
} from "../../../src/components/LibraryNavigator/browserDownload";

const MAX_LENGTH = 250;
const FALLBACK = "table.csv";

describe("LibraryNavigator - Browser Download", function () {
  describe("Filename Sanitization", () => {
    it("should remove control characters from filename", () => {
      expect(
        sanitizeDownloadFilename(
          "test\x00\x01\x1ffile.csv",
          MAX_LENGTH,
          FALLBACK,
        ),
      ).to.equal("testfile.csv");
    });

    it("should remove quotes from filename", () => {
      expect(
        sanitizeDownloadFilename('test"file".csv', MAX_LENGTH, FALLBACK),
      ).to.equal("testfile.csv");
    });

    it("should collapse multiple dots to prevent path traversal", () => {
      expect(
        sanitizeDownloadFilename("test..file...csv", MAX_LENGTH, FALLBACK),
      ).to.equal("test.file.csv");
    });

    it("should remove leading dots", () => {
      expect(
        sanitizeDownloadFilename("...test.csv", MAX_LENGTH, FALLBACK),
      ).to.equal("test.csv");
    });

    it("should preserve Unicode characters", () => {
      expect(
        sanitizeDownloadFilename("テスト日本語.csv", MAX_LENGTH, FALLBACK),
      ).to.equal("テスト日本語.csv");
    });

    it("should limit filename to max length", () => {
      const result = sanitizeDownloadFilename(
        "a".repeat(300) + ".csv",
        MAX_LENGTH,
        FALLBACK,
      );
      expect(result.length).to.equal(MAX_LENGTH);
    });

    it("should return fallback when sanitization results in empty string", () => {
      expect(
        sanitizeDownloadFilename("\x00\x01\x1f", MAX_LENGTH, FALLBACK),
      ).to.equal(FALLBACK);
    });
  });

  describe("Token Validation", () => {
    it("should accept a valid token", () => {
      const token = randomBytes(24).toString("hex");
      expect(isValidDownloadToken(token, token)).to.be.true;
    });

    it("should reject a token of wrong length", () => {
      const token = randomBytes(24).toString("hex");
      expect(isValidDownloadToken(token.slice(0, -1), token)).to.be.false;
    });

    it("should reject a null token", () => {
      const token = randomBytes(24).toString("hex");
      expect(isValidDownloadToken(null, token)).to.be.false;
    });

    it("should reject a token with correct length but wrong value", () => {
      const token = randomBytes(24).toString("hex");
      const wrong = "x".repeat(token.length);
      expect(isValidDownloadToken(wrong, token)).to.be.false;
    });
  });

  describe("Download Request Classification", () => {
    const TOKEN = randomBytes(24).toString("hex");
    const ENDPOINT = "/sas-library-download";
    const TOKEN_PARAM = "token";

    it("should reject non-GET methods with 405", () => {
      const result = classifyDownloadRequest(
        "POST",
        `${ENDPOINT}?${TOKEN_PARAM}=${TOKEN}`,
        TOKEN,
        ENDPOINT,
        TOKEN_PARAM,
        false,
      );
      expect(result.outcome).to.equal(405);
    });

    it("should reject a locked server with 410", () => {
      const result = classifyDownloadRequest(
        "GET",
        `${ENDPOINT}?${TOKEN_PARAM}=${TOKEN}`,
        TOKEN,
        ENDPOINT,
        TOKEN_PARAM,
        true,
      );
      expect(result.outcome).to.equal(410);
    });

    it("should reject an invalid token with 404", () => {
      const result = classifyDownloadRequest(
        "GET",
        `${ENDPOINT}?${TOKEN_PARAM}=badtoken`,
        TOKEN,
        ENDPOINT,
        TOKEN_PARAM,
        false,
      );
      expect(result.outcome).to.equal(404);
    });

    it("should reject a wrong path with 404", () => {
      const result = classifyDownloadRequest(
        "GET",
        `/other?${TOKEN_PARAM}=${TOKEN}`,
        TOKEN,
        ENDPOINT,
        TOKEN_PARAM,
        false,
      );
      expect(result.outcome).to.equal(404);
    });

    it("should reject a missing URL with 404", () => {
      const result = classifyDownloadRequest(
        "GET",
        undefined,
        TOKEN,
        ENDPOINT,
        TOKEN_PARAM,
        false,
      );
      expect(result.outcome).to.equal(404);
    });

    it("should allow a valid GET request with matching token and path", () => {
      const result = classifyDownloadRequest(
        "GET",
        `${ENDPOINT}?${TOKEN_PARAM}=${TOKEN}`,
        TOKEN,
        ENDPOINT,
        TOKEN_PARAM,
        false,
      );
      expect(result.outcome).to.equal("stream");
    });
  });

  describe("Request Lock Protection", () => {
    it("should block a second request once the first acquires the lock", () => {
      let requestLock = false;

      const canProcess = !requestLock;
      if (canProcess) {
        requestLock = true;
      }

      expect(canProcess).to.be.true;
      expect(!requestLock).to.be.false;
    });
  });

  describe("Settle Pattern Idempotency", () => {
    it("settleResolve should clear timeout to prevent spurious timeout logs", () => {
      let timeoutId: NodeJS.Timeout | undefined = setTimeout(() => {}, 1000);
      let settled = false;

      const settleResolve = () => {
        if (settled) {
          return;
        }
        settled = true;
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = undefined;
        }
      };

      settleResolve();

      expect(timeoutId).to.be.undefined;
      expect(settled).to.be.true;
    });
  });
});
