// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { expect } from "chai";
import * as sinon from "sinon";
import { Writable } from "stream";

import {
  stringArrayToCsvString,
  writeWithBackpressure,
} from "../../../src/components/LibraryNavigator/LibraryModel";

describe("LibraryModel", function () {
  describe("CSV Formatting", () => {
    it("should escape double quotes in cell values", () => {
      expect(stringArrayToCsvString(['value with "quotes"'])).to.equal(
        '"value with ""quotes"""',
      );
    });

    it("should coerce null cells to empty string", () => {
      expect(stringArrayToCsvString([null])).to.equal('""');
    });

    it("should coerce numeric cells to string", () => {
      expect(stringArrayToCsvString([12345])).to.equal('"12345"');
    });

    it("should format multiple cells as a quoted CSV row", () => {
      expect(stringArrayToCsvString(["col1", "col2", "col3"])).to.equal(
        '"col1","col2","col3"',
      );
    });
  });

  describe("writeWithBackpressure", () => {
    it("should write data and resolve immediately when write returns true", async () => {
      const written: string[] = [];
      const stream = new Writable({
        write(chunk, _enc, cb) {
          written.push(chunk.toString());
          cb();
        },
      });

      await writeWithBackpressure(stream, "hello");
      expect(written).to.deep.equal(["hello"]);
    });

    it("should wait for drain before resolving when write returns false", async () => {
      const stream = new Writable({
        write(_chunk, _enc, cb) {
          cb();
        },
      });
      const stub = sinon.stub(stream, "write").callsFake(() => {
        setTimeout(() => stream.emit("drain"), 0);
        return false;
      });

      let resolved = false;
      const p = writeWithBackpressure(stream, "data").then(() => {
        resolved = true;
      });

      expect(resolved).to.be.false;
      await p;
      expect(resolved).to.be.true;
      stub.restore();
    });
  });
});
