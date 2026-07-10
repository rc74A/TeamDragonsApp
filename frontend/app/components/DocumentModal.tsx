import React, { useState } from "react";
import { useAuth } from "@clerk/react-router";
import "./DocumentModal.css";

export default function DocumentModal() {
  const { getToken } = useAuth();
  const [newTitle, setNewTitle] = useState("NewTitle");

  return (
    <div className="dm-backdrop">
      <h1>{newTitle}</h1>
    </div>
  );
}
