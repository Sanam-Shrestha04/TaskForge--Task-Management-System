// export const BASE_URL = "http://localhost:8000/";
export const BASE_URL = import.meta.env.VITE_BACKEND_URL;
export const fetchTasks = async () => {
  const res = await fetch(`${BASE_URL}/api/tasks`);
  return res.json();
};

export const API_PATHS = {
  AUTH: {
    REGISTER: "/api/auth/register",
    LOGIN: "/api/auth/login",
    GET_PROFILE: "/api/auth/profile",
    FORGOT_PASSWORD: "/api/auth/forgot-password",
    RESET_PASSWORD: "/api/auth/reset-password",
    RESEND_VERIFICATION_OLD_USERS: "/api/auth/resend-verification-old-users",
  },
  USERS: {
    GET_ALL_USERS: "/api/users/",
    GET_USER_BY_ID: (userId) => `/api/users/${userId}`, 
    CREATE_USER: "/api/users",
    GET_USER_DETAILS: (userId) => `/api/users/${userId}`,
    DELETE_USER: (userId) => `/api/users/${userId}`,
  },
  TASKS: {
    GET_DASHBOARD_DATA: "/api/tasks/dashboard-data",
    GET_USER_DASHBOARD_DATA: "/api/tasks/user-dashboard-data",
    GET_ALL_TASKS: "/api/tasks",
    GET_TASK_BY_ID: (taskId) => `/api/tasks/${taskId}`,
    CREATE_TASK: "/api/tasks",
    GET_TASK_DETAILS: (taskId) => `/api/tasks/${taskId}`,
    DELETE_TASK: (taskId) => `/api/tasks/${taskId}`,
    UPDATE_TASK: (taskId) => `/api/tasks/${taskId}`,
    UPDATE_TASK_STATUS: (taskId) => `/api/tasks/${taskId}/status`,
    UPDATE_TODO_CHECKLIST: (taskId) => `/api/tasks/${taskId}/todo`,
  },
  REPORTS: {
    EXPORT_TASKS: "/api/reports/export/tasks",
    EXPORT_USERS: "/api/reports/export/users",
  },
  IMAGE: {
    UPLOAD_IMAGE: "/api/auth/upload-image", 
  },
};
// export { BASE_URL };