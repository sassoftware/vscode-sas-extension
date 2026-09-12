// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { useEffect } from "react";

import { CellDetail } from "./CellDetail";
import { StatusBar } from "./StatusBar";
import { Toolbar } from "./Toolbar";
import { Grid } from "./grid/Grid";
import { onHostMessage, send } from "./messaging";
import { bindPump, resetPump } from "./pump";
import { useStore } from "./store";

export function App() {
  const init = useStore((s) => s.init);
  const refresh = useStore((s) => s.refresh);
  const setError = useStore((s) => s.setError);

  useEffect(() => {
    const offPump = bindPump();
    const offMsg = onHostMessage((msg) => {
      switch (msg.kind) {
        case "init":
          resetPump();
          init({
            title: msg.title,
            columns: msg.columns,
            rowCount: msg.rowCount,
            pageSize: msg.pageSize,
            sort: msg.viewState?.sort,
            filters: msg.viewState?.filters,
          });
          break;
        case "refresh":
          resetPump();
          refresh();
          break;
        case "error":
          setError(msg.message);
          break;
        default:
          // rows-resp / theme handled inside their own modules.
          break;
      }
    });
    send({ kind: "ready" });
    return () => {
      offPump();
      offMsg();
    };
  }, [init, refresh, setError]);

  return (
    <div className="btv-root">
      <Toolbar />
      <Grid />
      <StatusBar />
      <CellDetail />
    </div>
  );
}
