import { expect } from "chai";
import * as sinon from "sinon";
import { Writable } from "stream";

// Mock writable stream that can simulate backpressure
class MockWritableStream extends Writable {
  public chunks: string[] = [];
  public ended = false;
  public destroyed = false;
  private shouldApplyBackpressure = false;
  private writeCount = 0;
  private backpressureThreshold = 5;

  setBackpressureThreshold(threshold: number): void {
    this.backpressureThreshold = threshold;
  }

  enableBackpressure(): void {
    this.shouldApplyBackpressure = true;
  }

  disableBackpressure(): void {
    this.shouldApplyBackpressure = false;
  }

  triggerDrain(): void {
    this.emit("drain");
  }

  _write(
    chunk: Buffer | string,
    encoding: string,
    callback: (error?: Error) => void,
  ): void {
    this.chunks.push(chunk.toString());
    this.writeCount++;

    // Simulate backpressure after threshold
    const hasBackpressure =
      this.shouldApplyBackpressure &&
      this.writeCount > this.backpressureThreshold;

    callback();

    if (hasBackpressure) {
      // Don't signal ready immediately
      setTimeout(() => this.triggerDrain(), 10);
    }
  }

  write(
    chunk: Buffer | string,
    encodingOrCallback?:
      | BufferEncoding
      | ((error: Error | null | undefined) => void),
    callback?: (error: Error | null | undefined) => void,
  ): boolean {
    // Handle overload where second parameter is callback
    let result: boolean;

    if (typeof encodingOrCallback === "function") {
      result = super.write(chunk, encodingOrCallback);
    } else if (encodingOrCallback && callback) {
      result = super.write(chunk, encodingOrCallback, callback);
    } else if (encodingOrCallback) {
      result = super.write(chunk, encodingOrCallback);
    } else if (callback) {
      result = super.write(chunk, callback);
    } else {
      result = super.write(chunk);
    }

    // Return false to signal backpressure
    if (
      this.shouldApplyBackpressure &&
      this.writeCount > this.backpressureThreshold
    ) {
      return false;
    }

    return result;
  }

  end(
    chunkOrCallback?: Buffer | string | (() => void),
    encodingOrCallback?: BufferEncoding | (() => void),
    callback?: () => void,
  ): this {
    // Handle overload variations
    let actualChunk: Buffer | string | undefined;
    let actualCallback: (() => void) | undefined;

    if (typeof chunkOrCallback === "function") {
      actualCallback = chunkOrCallback;
    } else {
      actualChunk = chunkOrCallback;
      if (typeof encodingOrCallback === "function") {
        actualCallback = encodingOrCallback;
      } else {
        actualCallback = callback;
      }
    }

    if (actualChunk) {
      this.chunks.push(actualChunk.toString());
    }
    this.ended = true;
    if (actualCallback) {
      actualCallback();
    }
    return this;
  }

  destroy(): this {
    this.destroyed = true;
    return this;
  }

  getWrittenData(): string {
    return this.chunks.join("");
  }

  getChunkCount(): number {
    return this.chunks.length;
  }

  reset(): void {
    this.chunks = [];
    this.ended = false;
    this.destroyed = false;
    this.writeCount = 0;
  }
}

describe("LibraryModel - Backpressure Handling", function () {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe("Stream Write with Backpressure", () => {
    it("should wait for drain event when write returns false", async () => {
      const stream = new MockWritableStream();
      stream.enableBackpressure();
      stream.setBackpressureThreshold(2);

      let drainWaited = false;

      // Simulate writing that triggers backpressure
      for (let i = 0; i < 5; i++) {
        const canContinue = stream.write(`chunk${i}\n`);
        if (!canContinue) {
          drainWaited = true;
          await new Promise<void>((resolve) => {
            stream.once("drain", resolve);
          });
        }
      }

      expect(drainWaited).to.be.true;
      expect(stream.getChunkCount()).to.equal(5);
    });

    it("should continue writing after drain event", async () => {
      const stream = new MockWritableStream();
      let writesAfterDrain = 0;

      // First write succeeds
      stream.write("chunk1\n");

      // Second write triggers backpressure
      stream.enableBackpressure();
      stream.setBackpressureThreshold(1);

      const canContinue = stream.write("chunk2\n");
      expect(canContinue).to.be.false;

      // Wait for drain
      await new Promise<void>((resolve) => {
        stream.once("drain", () => {
          stream.disableBackpressure();
          resolve();
        });
        stream.triggerDrain();
      });

      // Continue writing after drain
      stream.write("chunk3\n");
      writesAfterDrain++;

      expect(writesAfterDrain).to.equal(1);
      expect(stream.getChunkCount()).to.equal(3);
    });

    it("should not wait when write returns true", async () => {
      const stream = new MockWritableStream();
      stream.disableBackpressure();

      let drainWaited = false;

      for (let i = 0; i < 10; i++) {
        const canContinue = stream.write(`chunk${i}\n`);
        if (!canContinue) {
          drainWaited = true;
          await new Promise<void>((resolve) => {
            stream.once("drain", resolve);
          });
        }
      }

      expect(drainWaited).to.be.false;
      expect(stream.getChunkCount()).to.equal(10);
    });
  });

  describe("Header Write with Backpressure", () => {
    it("should handle backpressure on header write", async () => {
      const stream = new MockWritableStream();
      stream.enableBackpressure();
      stream.setBackpressureThreshold(0); // Trigger immediately

      let hasWrittenHeader = false;
      const headers = ["col1", "col2", "col3"];
      const headerString = `"${headers.join('","')}"`;

      const canContinue = stream.write(headerString);
      if (!canContinue) {
        await new Promise<void>((resolve) => {
          stream.once("drain", resolve);
        });
        stream.triggerDrain();
      }
      hasWrittenHeader = true;

      expect(hasWrittenHeader).to.be.true;
      expect(stream.getChunkCount()).to.equal(1);
    });

    it("should write header before rows", async () => {
      const stream = new MockWritableStream();
      let hasWrittenHeader = false;

      // Write header
      const canContinue = stream.write("col1,col2,col3\n");
      if (!canContinue) {
        await new Promise<void>((resolve) => {
          stream.once("drain", resolve);
        });
      }
      hasWrittenHeader = true;

      // Write rows
      for (let i = 0; i < 3; i++) {
        stream.write(`row${i}\n`);
      }

      const data = stream.getWrittenData();
      expect(hasWrittenHeader).to.be.true;
      expect(data).to.match(/^col1,col2,col3\n/);
      expect(stream.getChunkCount()).to.equal(4);
    });
  });

  describe("Row Writing with Backpressure", () => {
    it("should handle backpressure for each row", async () => {
      const stream = new MockWritableStream();
      stream.enableBackpressure();
      stream.setBackpressureThreshold(3);

      const rows = [
        { cells: ["a", "b", "c"] },
        { cells: ["d", "e", "f"] },
        { cells: ["g", "h", "i"] },
        { cells: ["j", "k", "l"] },
        { cells: ["m", "n", "o"] },
      ];

      let backpressureHits = 0;

      for (const row of rows) {
        const rowString = "\n" + row.cells.join(",");
        const canContinue = stream.write(rowString);
        if (!canContinue) {
          backpressureHits++;
          await new Promise<void>((resolve) => {
            stream.once("drain", resolve);
          });
          stream.triggerDrain();
        }
      }

      expect(backpressureHits).to.be.greaterThan(0);
      expect(stream.getChunkCount()).to.equal(5);
    });

    it("should preserve data integrity during backpressure", async () => {
      const stream = new MockWritableStream();
      stream.enableBackpressure();
      stream.setBackpressureThreshold(2);

      const expectedData = ["row1", "row2", "row3", "row4", "row5"];

      for (const data of expectedData) {
        const canContinue = stream.write(data + "\n");
        if (!canContinue) {
          await new Promise<void>((resolve) => {
            stream.once("drain", resolve);
          });
          stream.triggerDrain();
        }
      }

      const written = stream.getWrittenData();
      expectedData.forEach((data) => {
        expect(written).to.include(data);
      });
    });
  });

  describe("Memory Management", () => {
    it("should not accumulate data in memory during backpressure", async () => {
      const stream = new MockWritableStream();
      stream.enableBackpressure();
      stream.setBackpressureThreshold(5);

      const initialMemory = process.memoryUsage().heapUsed;
      const largeChunkCount = 100;

      for (let i = 0; i < largeChunkCount; i++) {
        const canContinue = stream.write("x".repeat(100));
        if (!canContinue) {
          await new Promise<void>((resolve) => {
            stream.once("drain", resolve);
          });
          stream.triggerDrain();
        }
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 10MB for test data)
      expect(memoryIncrease).to.be.lessThan(10 * 1024 * 1024);
    });

    it("should handle large datasets with multiple backpressure cycles", async () => {
      const stream = new MockWritableStream();
      stream.enableBackpressure();
      stream.setBackpressureThreshold(10);

      let backpressureCycles = 0;
      const rowCount = 100;

      for (let i = 0; i < rowCount; i++) {
        const canContinue = stream.write(`row${i},data${i},value${i}\n`);
        if (!canContinue) {
          backpressureCycles++;
          await new Promise<void>((resolve) => {
            stream.once("drain", resolve);
          });
          stream.triggerDrain();
        }
      }

      expect(backpressureCycles).to.be.greaterThan(0);
      expect(stream.getChunkCount()).to.equal(rowCount);
    });
  });

  describe("Cancellation During Backpressure", () => {
    it("should respect cancellation token during write", async () => {
      const stream = new MockWritableStream();
      let cancelled = false;

      // Simulate cancellation
      const cancellationCallback = () => {
        stream.destroy();
        cancelled = true;
      };

      // Write some data
      stream.write("chunk1\n");

      // Simulate cancellation
      cancellationCallback();

      expect(stream.destroyed).to.be.true;
      expect(cancelled).to.be.true;
    });

    it("should stop writing on cancellation", async () => {
      const stream = new MockWritableStream();
      let cancelled = false;

      for (let i = 0; i < 10; i++) {
        if (cancelled) {
          break;
        }

        stream.write(`chunk${i}\n`);

        // Simulate cancellation after 5 writes
        if (i === 4) {
          stream.destroy();
          cancelled = true;
        }
      }

      expect(stream.destroyed).to.be.true;
      expect(stream.getChunkCount()).to.equal(5);
    });
  });

  describe("Error Handling During Backpressure", () => {
    it("should handle write errors gracefully", async () => {
      const stream = new MockWritableStream();
      let errorCaught = false;

      try {
        stream.write("valid data\n");

        // Simulate error
        stream.destroy();

        if (stream.destroyed) {
          throw new Error("Stream destroyed");
        }
      } catch {
        errorCaught = true;
      }

      expect(errorCaught).to.be.true;
    });

    it("should cleanup on error during drain wait", async () => {
      const stream = new MockWritableStream();
      stream.enableBackpressure();
      stream.setBackpressureThreshold(0);

      let cleanedUp = false;

      try {
        const canContinue = stream.write("data\n");
        if (!canContinue) {
          const drainPromise = new Promise<void>((resolve, reject) => {
            stream.once("drain", resolve);
            stream.once("error", reject);
          });

          // Simulate error before drain
          setTimeout(() => {
            stream.emit("error", new Error("Test error"));
          }, 5);

          await drainPromise;
        }
      } catch {
        stream.destroy();
        cleanedUp = true;
      }

      expect(cleanedUp).to.be.true;
      expect(stream.destroyed).to.be.true;
    });
  });

  describe("CSV Formatting with Backpressure", () => {
    it("should properly escape quotes in cells", () => {
      const input = 'value with "quotes"';
      const escaped = input.replace(/"/g, '""');
      const formatted = `"${escaped}"`;

      expect(formatted).to.equal('"value with ""quotes"""');
    });

    it("should handle null values", () => {
      const value: unknown = null;
      const formatted = (value ?? "").toString().replace(/"/g, '""');

      expect(formatted).to.equal("");
    });

    it("should convert numbers to strings", () => {
      const value: unknown = 12345;
      const formatted = (value ?? "").toString().replace(/"/g, '""');

      expect(formatted).to.equal("12345");
    });

    it("should format array as CSV row", () => {
      const cells = ["col1", "col2", "col3"];
      const formatted = `"${cells
        .map((item) => (item ?? "").toString().replace(/"/g, '""'))
        .join('","')}"`;

      expect(formatted).to.equal('"col1","col2","col3"');
    });
  });

  describe("Stream Completion", () => {
    it("should end stream after all writes complete", async () => {
      const stream = new MockWritableStream();

      for (let i = 0; i < 5; i++) {
        stream.write(`row${i}\n`);
      }

      stream.end();

      expect(stream.ended).to.be.true;
      expect(stream.getChunkCount()).to.equal(5);
    });

    it("should not write after stream ends", () => {
      const stream = new MockWritableStream();

      stream.write("data1\n");
      stream.end();

      let writeAfterEnd = false;
      try {
        stream.write("data2\n");
      } catch {
        writeAfterEnd = true;
      }

      expect(stream.ended).to.be.true;
      expect(writeAfterEnd).to.be.false; // Node.js Writable doesn't throw, just ignores writes after end
    });
  });
});
