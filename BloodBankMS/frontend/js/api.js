const API = {
  token() {
    return localStorage.getItem("bb_token");
  },

  async call(method, url, body) {
    const options = { method, headers: { "Content-Type": "application/json" } };
    if (API.token()) options.headers.Authorization = "Bearer " + API.token();
    if (body !== undefined) options.body = JSON.stringify(body);

    const response = await fetch("/api" + url, options);
    let data = null;
    try {
      data = await response.json();
    } catch (e) {}

    if (!response.ok) {
      if (response.status === 401 && API.token()) Auth.logout(true);
      let message = "Something went wrong";
      if (data && typeof data.detail === "string") message = data.detail;
      else if (data && Array.isArray(data.detail)) message = data.detail.map((d) => d.msg).join(", ");
      throw new Error(message);
    }
    return data;
  },

  get: (url) => API.call("GET", url),
  post: (url, body) => API.call("POST", url, body || {}),
  put: (url, body) => API.call("PUT", url, body || {}),
  del: (url) => API.call("DELETE", url),
};
