// Copyright © 2022, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { l10n } from "vscode";

import { randomBytes } from "crypto";
import { Readable } from "stream";

import {
  LibraryItem,
  TableExport,
} from "../../components/LibraryNavigator/types";
import { FilesApi, JobsApi, LogsApi } from "./api/compute";
import { getApiConfig } from "./common";
import { ComputeSession } from "./session";

export class ComputeFile {
  public constructor(private readonly sessionId: string) {}

  public async createTableExport(
    item: Pick<LibraryItem, "library" | "name">,
    signal: AbortSignal,
  ): Promise<TableExport> {
    signal.throwIfAborted();
    const suffix = randomBytes(16).toString("hex");
    const fileref = `dl${suffix.slice(0, 6)}`;
    const macro = fileref;
    const api = FilesApi(getApiConfig());
    const session = new ComputeSession(this.sessionId);
    const parameters = { sessionId: this.sessionId, fileref };
    let disposed = false;
    let fileDeleted = false;
    let jobDeleted = false;
    let stream: Readable;
    let jobId: string | undefined;
    let etag: string;
    let stateEtag: string | undefined;
    let state: string;
    const active = () =>
      !state || ["pending", "running", "queued"].includes(state);
    const jobs = JobsApi(getApiConfig());
    const dispose = async () => {
      if (disposed) {
        return;
      }
      stream?.destroy();
      if (!fileDeleted) {
        try {
          await api.deleteFile(parameters, { timeout: 30_000 });
        } catch (error) {
          if (error.response?.status !== 404) {
            throw error;
          }
        }
        fileDeleted = true;
      }
      try {
        await api.deleteFileref(parameters, { timeout: 30_000 });
      } catch (error) {
        if (error.response?.status !== 404) {
          throw error;
        }
      }
      if (jobId && !jobDeleted) {
        try {
          await jobs.deleteJob(
            { sessionId: this.sessionId, jobId },
            { timeout: 30_000 },
          );
        } catch (error) {
          if (error.response?.status !== 404) {
            throw error;
          }
        }
        jobDeleted = true;
      }
      disposed = true;
    };
    try {
      const job = await session.execute({
        code: [
          `filename ${fileref} "%sysfunc(pathname(work))/sas-table-download-${suffix}.csv" recfm=n encoding='utf-8';`,
          `%macro ${macro}(data=, out=);`,
          `%local source columns array_columns close_rc;`,
          `%let source=%sysfunc(open(%superq(data),I));`,
          `%if &source=0 %then %do;`,
          `%put ERROR: Cannot open table for export: %qsysfunc(sysmsg());`,
          `%return;`,
          `%end;`,
          `%let columns=%sysfunc(attrn(&source,NVARS));`,
          `%let array_columns=%sysfunc(max(1,&columns));`,
          `%let close_rc=%sysfunc(close(&source));`,
          `%if &close_rc ne 0 %then %do;`,
          `%put ERROR: Could not close table metadata descriptor.;`,
          `%return;`,
          `%end;`,
          `data _null_;`,
          `  length cell segment $32767 message $1024;`,
          `  array names[&array_columns] $32 _temporary_;`,
          `  array formats[&array_columns] $64 _temporary_;`,
          `  array types[&array_columns] $1 _temporary_;`,
          `  source=open(symget('data'), 'I');`,
          `  if source=0 then do;`,
          `    message=sysmsg();`,
          `    putlog 'ERROR: Cannot reopen table for export: ' message;`,
          `    stop;`,
          `  end;`,
          `  if attrn(source, 'NVARS') ne &columns then do;`,
          `    putlog 'ERROR: Table schema changed during export initialization.';`,
          `    close_rc=close(source);`,
          `    stop;`,
          `  end;`,
          `  do column=1 to &columns;`,
          `    names[column]=varname(source, column);`,
          `    formats[column]=varfmt(source, column);`,
          `    types[column]=vartype(source, column);`,
          `    if types[column]='N' and formats[column]='' then formats[column]='BEST12.';`,
          `  end;`,
          `  file &out recfm=n;`,
          `  field_index=0;`,
          `  cell='';`,
          `  link csv_field;`,
          `  do column=1 to &columns;`,
          `    cell=names[column];`,
          `    link csv_field;`,
          `  end;`,
          `  put '0A'x;`,
          `  row_index=0;`,
          `  fetch_rc=fetch(source);`,
          `  do while (fetch_rc=0);`,
          `    row_index+1;`,
          `    field_index=0;`,
          `    cell=strip(put(row_index, best32.));`,
          `    link csv_field;`,
          `    do column=1 to &columns;`,
          `      if types[column]='N' then cell=strip(putn(getvarn(source, column), formats[column]));`,
          `      else do;`,
          `        cell=getvarc(source, column);`,
          `        if formats[column] ne '' then cell=putc(cell, formats[column]);`,
          `      end;`,
          `      if _error_ then leave;`,
          `      link csv_field;`,
          `    end;`,
          `    if _error_ then leave;`,
          `    put '0A'x;`,
          `    fetch_rc=fetch(source);`,
          `  end;`,
          `  if fetch_rc ne -1 and not _error_ then do;`,
          `    message=sysmsg();`,
          `    putlog 'ERROR: Table export could not read all rows: ' message;`,
          `  end;`,
          `  close_rc=close(source);`,
          `  if close_rc ne 0 then putlog 'ERROR: Could not close table after export.';`,
          `  if _error_ then putlog 'ERROR: Table export failed while writing CSV.';`,
          `  stop;`,
          ``,
          `  csv_field:`,
          `    if field_index>0 then put ',';`,
          `    field_index+1;`,
          `    put '"';`,
          `    start_position=1;`,
          `    cell_length=lengthn(cell);`,
          `    do while (start_position<=cell_length);`,
          `      quote_position=find(cell, '"', '', start_position);`,
          `      if quote_position=0 then segment_length=cell_length-start_position+1;`,
          `      else segment_length=quote_position-start_position;`,
          `      if segment_length>0 then do;`,
          `        segment=substr(cell, start_position, segment_length);`,
          `        put segment $varying32767. segment_length;`,
          `      end;`,
          `      if quote_position>0 then put '""';`,
          `      start_position+segment_length+1;`,
          `    end;`,
          `    put '"';`,
          `    return;`,
          `run;`,
          `%mend;`,
          `%${macro}(data=%nrstr(${sasName(item.library || "WORK")}.${sasName(item.name)}),out=${fileref});`,
          `%sysmacdelete ${macro} / nowarn;`,
        ],
      });
      jobId = job.id;
      etag = job.etag;
      do {
        signal.throwIfAborted();
        const response = await jobs.getJobState(
          {
            sessionId: this.sessionId,
            jobId,
            wait: 1,
            ifNoneMatch: stateEtag,
          },
          {
            signal,
            timeout: 30_000,
            validateStatus: (status) =>
              (status >= 200 && status < 300) || status === 304,
          },
        );
        if (response.status !== 304) {
          state = response.data;
          stateEtag = response.headers.etag;
          etag = stateEtag ?? etag;
        }
      } while (active());
      if (!["completed", "done", "warning"].includes(state)) {
        throw new Error(
          l10n.t("SAS table export failed ({state}).", { state }),
        );
      }
      const logs = LogsApi(getApiConfig());
      let start = 0;
      let more: boolean;
      do {
        const { data } = await logs.getJobLog(
          { sessionId: this.sessionId, jobId, start, limit: 1000 },
          { signal, timeout: 30_000 },
        );
        if (data.items.some((line) => line.type === "error")) {
          throw new Error(
            l10n.t("SAS table export failed. Check the SAS log."),
          );
        }
        start += data.items.length;
        more =
          data.items.length > 0 &&
          (start < data.count ||
            data.links?.some((link) => link.rel === "next"));
      } while (more);
      const response = await api.getFile(parameters, {
        signal,
        timeout: 30_000,
        responseType: "stream",
      });
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      stream = response.data as unknown as Readable;
      signal.throwIfAborted();
      return { stream, dispose };
    } catch (error) {
      let stopFailure: unknown;
      if (jobId && active()) {
        const deadline = Date.now() + 30_000;
        let requested = false;
        while (active() && Date.now() < deadline) {
          if (!requested) {
            try {
              await jobs.updateJobState(
                {
                  sessionId: this.sessionId,
                  jobId,
                  ifMatch: etag || "*",
                  value: "canceled",
                },
                {
                  timeout: Math.min(5000, deadline - Date.now()),
                  headers: { "Content-Type": "text/plain" },
                },
              );
              requested = true;
            } catch (failure) {
              stopFailure = failure;
            }
          }
          try {
            const response = await jobs.getJobState(
              {
                sessionId: this.sessionId,
                jobId,
                wait: 1,
                ifNoneMatch: stateEtag,
              },
              {
                timeout: Math.min(5000, deadline - Date.now()),
                validateStatus: (status) =>
                  (status >= 200 && status < 300) || status === 304,
              },
            );
            if (response.status !== 304) {
              state = response.data;
              stateEtag = response.headers.etag;
              etag = stateEtag ?? etag;
            }
          } catch (failure) {
            stopFailure = failure;
          }
          if (active()) {
            await new Promise<void>((resolve) => setTimeout(resolve, 100));
          }
        }
        if (active() && !stopFailure) {
          stopFailure = new Error(
            l10n.t("Unable to stop the SAS table export."),
          );
        }
      }
      let cleanupFailure: unknown;
      for (let attempt = 0; attempt < 3 && !disposed; attempt++) {
        try {
          await dispose();
        } catch {
          cleanupFailure = new Error(
            l10n.t("Could not clean up the SAS table export resources."),
          );
        }
      }
      if (stopFailure || cleanupFailure) {
        throw new Error(
          [
            error instanceof Error ? error.message : String(error),
            stopFailure
              ? `Could not stop the SAS export job: ${String(stopFailure)}`
              : undefined,
            cleanupFailure instanceof Error
              ? cleanupFailure.message
              : undefined,
          ]
            .filter(Boolean)
            .join("; "),
        );
      }
      throw error;
    }
  }
}

function sasName(name: string): string {
  if (name.includes("\0")) {
    throw new Error("Invalid SAS table name.");
  }
  return `'${name.replace(/'/g, "''")}'n`;
}
