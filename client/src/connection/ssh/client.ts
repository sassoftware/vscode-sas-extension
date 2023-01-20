// import { RunResult } from "..";
// import { LogLine } from "../rest/api/compute";
// import { Client } from "ssh2";

// export class SAS9SSHClient {
//   private _resolve: ((value?: RunResult) => void) | undefined;
//   private _reject: ((reason?) => void) | undefined;
//   private _onLog: ((logs: LogLine[]) => void) | undefined;
//   private _logs: string[] = [];
//   private _html5FileName: string;
//   private _conn: Client;

//   getResultsFile(): void {
//     if (!this._html5FileName) {
//       this._resolve?.({});
//       return;
//     }
//     let result = "";
//     this._conn.exec(`cat ${this._html5FileName}.htm`, (err, s) => {
//       if (err) {
//         this._reject?.(err);
//         return;
//       }

//       s.on("data", (data) => {
//         result += data.toString().trimEnd();
//       }).on("close", (code) => {
//         const rc = code as number;
//         const runResult: RunResult = {};
//         if (rc === 0) {
//           runResult.html5 = result;
//           runResult.title = this._html5FileName;
//         }
//         this._resolve?.(runResult);
//       });
//     });
//   }

//   onReady(): void {}

//   onClose(): void {}
//   onData(): void {}
// }
