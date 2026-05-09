import React, { useContext, lazy, Suspense } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Outlet,
  Navigate,
} from "react-router-dom";

import UserProvider, { UserContext } from "./context/userContext";
import { Toaster } from "react-hot-toast";
import PrivateRoute from "./routes/PrivateRoute";

// Auth Pages - lazy loaded
const Login = lazy(() => import("./pages/Auth/Login"));
const SignUp = lazy(() => import("./pages/Auth/SignUp"));
const ForgotPassword = lazy(() => import("./pages/Auth/forgot-password"));
const ResetPassword = lazy(() => import("./pages/Auth/reset-password"));
const VerifyOTP = lazy(() => import("./pages/Auth/verify"));
const ResendVerification = lazy(() => import("./pages/Auth/ResendVerification"));

// Admin Pages - lazy loaded
const AdminDashboard = lazy(() => import("./pages/Admin/AdminDashboard"));
const ManageTasks = lazy(() => import("./pages/Admin/ManageTasks"));
const CreateTask = lazy(() => import("./pages/Admin/CreateTask"));
const ManageUsers = lazy(() => import("./pages/Admin/ManageUsers"));

// User Pages - lazy loaded
const UserDashboard = lazy(() => import("./pages/User/UserDashboard"));
const MyTasks = lazy(() => import("./pages/User/MyTasks"));
const ViewTaskDetails = lazy(() => import("./pages/User/ViewTaskDetails"));

// Simple loading fallback
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" />
  </div>
);

const App = () => {
  return (
    <UserProvider>
      <div>
        <Router>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Public Routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<SignUp />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password/:token" element={<ResetPassword />} />
              <Route path="/verify" element={<VerifyOTP />} />
              <Route path="/auth/resend-verification" element={<ResendVerification />} />

              {/* Admin Routes */}
              <Route element={<PrivateRoute allowedRoles={["admin"]} />}>
                <Route path="/admin/dashboard" element={<AdminDashboard />} />
                <Route path="/admin/tasks" element={<ManageTasks />} />
                <Route path="/admin/create-task" element={<CreateTask />} />
                <Route path="/admin/users" element={<ManageUsers />} />
                <Route path="/tasks/:taskId" element={<CreateTask />} />
              </Route>

              {/* User Routes */}
              <Route element={<PrivateRoute allowedRoles={["user"]} />}>
                <Route path="/user/dashboard" element={<UserDashboard />} />
                <Route path="/user/tasks" element={<MyTasks />} />
                <Route path="/user/task-details/:id" element={<ViewTaskDetails />} />
              </Route>

              {/* Default Route */}
              <Route path="/" element={<Root />} />
            </Routes>
          </Suspense>
        </Router>
      </div>

      <Toaster
        toastOptions={{
          className: "",
          style: { fontSize: "13px" },
        }}
      />
    </UserProvider>
  );
};

export default App;

const Root = () => {
  const { user, loading } = useContext(UserContext);
  if (loading) return <Outlet />;
  if (!user) return <Navigate to="/login" />;
  return user.role === "admin"
    ? <Navigate to="/admin/dashboard" />
    : <Navigate to="/user/dashboard" />;
};