import { Link } from "react-router";

export default function LoginView() {
  return (
    <div className="p-6 max-w-md mx-auto bg-white rounded-xl shadow-md border border-gray-100 mt-12 text-center">
      <nav className="mb-6 border-b border-gray-200 pb-4 text-sm text-gray-500 font-medium">
        <Link to="/" className="hover:text-indigo-600 transition-colors">Home</Link>
        {" | "}
        <Link to="/login" className="hover:text-indigo-600 transition-colors">Login</Link>
      </nav>
      
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Login Page Test</h1>

      <div className="mt-4">
        <p className="text-sm text-gray-600 mb-2">Don't have an account?</p>
        <Link 
          to="/register" 
          className="inline-block bg-indigo-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm cursor-pointer"
        >
          Go to Sign Up Page
        </Link>
      </div>
    </div>
  );
}