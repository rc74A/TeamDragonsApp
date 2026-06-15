import { useState } from 'react';
import "./app.css";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const loginLink = "http://localhost:8000/api/auth/login"

  const handleUsernameChange = (event) => {
    setUsername(event.target.value);
  }

  const handlePasswordChange = (event) => {
    setPassword(event.target.value);
  }
    {/* TODO:
      Plaintext for now, ENCRYPT LATER
      Additionally validate input
    */}

  const submitLogin = async (e) => {

    e.preventDefault();
    setError("");
    try {
      const response = await fetch(loginLink, {
        method: 'POST',
        credentials: 'include',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ uname: username, pwd: password })
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.detail || "Login failed");
        return;
      }
      window.location.href = "/"
    } catch (err) {
      setError("Network error, please try again");
    } finally {
      setPassword("");
    }
  }

  return (
  <div className="page-container">
    <header className="banner">
      <h1>Dragon Application</h1>
    </header>

    <div className="content-layout">
      <aside className="sidebar">
        <nav>
          <ul className="menu-list">
            <li><a href="/register">Register</a></li>
          </ul>
        </nav>
      </aside>

    </div>

    {/* Ugly now, we can make it look better late */}
    <main className="flex justify-center items-center">
      <div className="bg-[#06B6D4] rounded-md h-xl w-xl shadow-md p-8">
        <form onSubmit={submitLogin} className="font-bold text-2xl">
          <label htmlFor="username">Username:</label><br/>
          <input value={username} onChange={handleUsernameChange} className="bg-white text-black" type="text" id="username" name="username"/><br/>
          <label htmlFor="password">Password:</label><br/>
          <input value={password} onChange={handlePasswordChange} className="bg-white text-black" type="password" id="password" name="password"/><br/>

          <button type="submit" className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded">
            Log In
          </button>
          {error && <p className="text-red-500">{error}</p>}

        </form>
        <br/><br/><br/><br/><br/><br/><br/><br/>
      </div>
    </main>
  </div>
);
}
