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
    await axios.get<User>(`${options.endpoint}/identities/users/@currentUser`, {
      headers: {
        Authorization: "Bearer " + options.accessToken,
      },
    })
  ).data;
}
