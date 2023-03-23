import { Disposable } from "vscode";

export interface SubscriptionProvider {
  getSubscriptions(): Disposable[];
}
