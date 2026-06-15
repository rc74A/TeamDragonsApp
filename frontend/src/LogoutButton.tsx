import { useNavigate } from "react-router-dom";

export default function LogoutButton() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      const url = import.meta.env.VITE_ATS_API_URL || "http://localhost:5000";

      await fetch(`${url}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch (error) {
      console.error("Backend Logout notification failed: ", error);
    }

    localStorage.removeItem("token");
    navigate("/login");
  };

  return (
    <button
      onClick={handleLogout}
      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-md transition-colors logout-btn"
    >
      Sign Out
    </button>
  );
}
