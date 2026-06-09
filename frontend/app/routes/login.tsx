import { Link } from "react-router";
import React, { useState } from 'react';
import "./app.css";
import { errorMonitor } from "events";

export default function Settings() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleUsernameChange = (event) => {
    setUsername(event.target.value);
  }

  const handlePasswordChange = (event) => {
    setPassword(event.target.value);
  }

  const submitLogin = async (e) => 
  {
    e.preventDefault();
    console.log("TEST\n");
    try {
      const response = await fetch('http://localhost:8000/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ uname : username, pwd: password })
      });

      const data = await response.json();
      console.log(data.message);
    } catch (error) {
      console.error("Error sending data:", error);
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
            <li><a href="/dashboard">Dashboard</a></li>
            <li><a href="/profile">Profile</a></li>
            <li><a href="/settings">Settings</a></li>
            <li><a href="/login">Login</a></li>
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
            Button
          </button>
        </form>
        <br/><br/><br/><br/><br/><br/><br/><br/>
      </div>
    </main>
  </div>
);
}
