import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api/v1";

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

export const login = async ({ identifier, password }) => {
  // Backend expects "username" field, which can be either username or email
  const response = await apiClient.post("/auth/login", {
    username: identifier,
    password,
  });
  return response.data;
};
