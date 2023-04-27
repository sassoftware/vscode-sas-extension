// import * as edge from "electron-edge-js";

// export const runCode = edge.func({
//   source: function () {
//     /*
// using System.IO;
// using System.Text.RegularExpressions;
// using System.Threading.Tasks;

// using SAS;

// public class Startup
// {
//     public async Task<object> Invoke(object input)
//     {
//         var sasCode = (string)input;
//         return SASRunner.ExecuteCode(sasCode);
//     }
// }

// static class SASRunner
// {
//     public static RunResult ExecuteCode(string code)
//     {
//         var ws = new Workspace();
//         var ls = ws.LanguageService;
//         var rs = new RunResult();

//         var runResult = new RunResult();
//         var chunkedLog = "";

//         ls.Submit(code);

//         string log = "";
//         string logChunk;
//         int chunk = 1024;
//         do
//         {
//             logChunk = ls.FlushLog(chunk);
//             log += logChunk;
//         } while (logChunk.Length > 0);

//         rs.Log = log;

//         var workPattern = @"^---vscode-sas: work_path: (.*)";
//         var workPatternMatch = Regex.Match(log, workPattern, RegexOptions.Multiline);
//         var workDir = "";
//         if(workPatternMatch.Success)
//         {
//             workDir = workPatternMatch.Groups[1].Value;
//         }

//         var odsPattern = @"^NOTE: .+ HTML5.* Body .+: (.+)";
//         var odsPatternMatch = Regex.Match(log, odsPattern, RegexOptions.Multiline);
//         var odsFile = "";
//         if(odsPatternMatch.Success)
//         {
//             odsFile = odsPatternMatch.Groups[1].Value;
//         }

//         string odsAbsoluteFile = workDir + "/" + odsFile;
//         rs.HTML = File.ReadAllText(odsAbsoluteFile);

//         return rs;

//     }

//     public class RunResult
//     {
//         public string HTML { get; set; }
//         public string Log { get; set; }
//     }
//     public class RunContext
//     {
//         public string[] SASOptions { get; set; }
//         public string Code { get; set; }
//     }
// }
// */
//   },
//   references: ["C:\\SASHome\\x86\\Integration Technologies\\SASInterop.dll"],
// });
