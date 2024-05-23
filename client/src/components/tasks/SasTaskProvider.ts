// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import {
  CustomExecution,
  EventEmitter,
  ProviderResult,
  Pseudoterminal,
  Task,
  TaskProvider,
  TaskScope,
  l10n,
} from "vscode";

import { hasRunningTask } from "../../commands/run";
import {
  Execute,
  SAS_TASK_TYPE,
  SasTaskDefinition,
  SasTaskNames,
  TaskInfo,
  runSasFileTask,
} from "./SasTasks";

export class SasTaskProvider implements TaskProvider {
  provideTasks(): ProviderResult<Task[]> {
    return [generateTask(SasTaskNames.RunSasFile, runSasFileTask)];
  }

  resolveTask(task: Task): ProviderResult<Task> {
    if (task.definition.task === SasTaskNames.RunSasFile) {
      return generateTask(task, runSasFileTask);
    }
  }
}

export class SasPseudoterminal implements Pseudoterminal {
  private messageEmitter = new EventEmitter<string>();
  private closeEmitter = new EventEmitter<number>();

  constructor(
    private execute: Execute,
    private taskInfo: TaskInfo,
  ) {}

  public onDidWrite = this.messageEmitter.event;
  public onDidClose? = this.closeEmitter.event;

  public open(): void {
    if (hasRunningTask()) {
      this.messageEmitter.fire(
        "There is running task, please try again after that is complete.\n",
      );
      this.closeEmitter.fire(1);
    } else {
      this.executeTask();
    }
  }

  public close(): void {
    this.closeEmitter.fire(0);
  }
  public handleInput?(data): void {
    // press ctrl + c to cancel executing task.
    if (data === "") {
      this.messageEmitter.fire("Task is cancelled.");
      this.closeEmitter.fire(1);
    }
  }

  private async executeTask(): Promise<void> {
    return new Promise<void>(() => {
      this.execute(this.messageEmitter, this.taskInfo, this.closeEmitter)
        .then(() => {
          this.messageEmitter.fire(l10n.t("Task is complete.") + "\r\n\r\n");
          this.closeEmitter.fire(0);
        })
        .catch((reason) => {
          this.messageEmitter.fire(reason.message + "\r\n\r\n");
          this.messageEmitter.fire(l10n.t("Task is cancelled.") + "\r\n\r\n");
          this.closeEmitter.fire(1);
        });
    });
  }
}

function generateTask(task: string | Task, execute: Execute) {
  const definition =
    typeof task === "object"
      ? task.definition
      : {
          type: SAS_TASK_TYPE,
          task: task,
        };

  return new Task(
    definition,
    TaskScope.Workspace,
    definition.task,
    SAS_TASK_TYPE,
    new CustomExecution(async (taskDefinition: SasTaskDefinition) => {
      return new SasPseudoterminal(execute, {
        definition: taskDefinition,
        label: typeof task === "object" ? task.name : task,
      });
    }),
  );
}
