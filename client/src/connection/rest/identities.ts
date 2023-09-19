// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import axios from "axios";

export interface User {
  id: string;
  name: string;
}

// It's used by AuthProvider before a new authentication session returned
// So has to pass access token mannually
export async function getCurrentUser(options: {
  endpoint: string;
  accessToken: string;
}) {
  return (
    await axios
      .create({
        baseURL: options.endpoint,
        headers: {
          Authorization: "Bearer " + options.accessToken,
        },
      })
      .get<User>("/identities/users/@currentUser")
  ).data;
}
