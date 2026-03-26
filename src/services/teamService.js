import { API_URL } from "./auth";

const getToken = () => localStorage.getItem("token");

export const getAllTeams = async ({ page = 1, limit = 100, search = "" }) => {
  const token = getToken();
  const query = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
    search,
  }).toString();

  const res = await fetch(`${API_URL}/teams?${query}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to fetch teams");
  return data;
};

export const seedDefaultTeams = async () => {
  const token = getToken();
  const res = await fetch(`${API_URL}/teams/seed-default`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to seed teams");
  return data;
};

export const getTeamById = async (teamId) => {
  const token = getToken();
  const res = await fetch(`${API_URL}/teams/${teamId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to fetch team");
  return data;
};

export const createTeam = async (payload) => {
  const token = getToken();
  const res = await fetch(`${API_URL}/teams`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to create team");
  return data;
};

export const updateTeam = async (teamId, payload) => {
  const token = getToken();
  const res = await fetch(`${API_URL}/teams/${teamId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to update team");
  return data;
};

export const deleteTeam = async (teamId) => {
  const token = getToken();
  const res = await fetch(`${API_URL}/teams/${teamId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to disable team");
  return data;
};

export const getTeamMembers = async ({
  teamId,
  page = 1,
  limit = 10,
  search = "",
  status = "active",
}) => {
  const token = getToken();
  const query = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
    search,
    status,
  }).toString();
  const res = await fetch(`${API_URL}/teams/${teamId}/members?${query}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to fetch team members");
  return data;
};

export const addUsersToTeam = async (teamId, userIds) => {
  const token = getToken();
  const res = await fetch(`${API_URL}/teams/${teamId}/members`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userIds }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to add members");
  return data;
};

export const setTeamMemberStatus = async (teamId, userId, status) => {
  const token = getToken();
  const res = await fetch(`${API_URL}/teams/${teamId}/members/${userId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to update member status");
  return data;
};

