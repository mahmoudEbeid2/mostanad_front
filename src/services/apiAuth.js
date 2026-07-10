import apiClient from "./apiClient";

export const login = async ({ identifier, password }) => {
  const response = await apiClient.post("/auth/login", {
    username: identifier,
    password,
  });
  return response.data;
};

export const getMe = async () => {
  const response = await apiClient.get("/auth/me");
  return response.data;
};
