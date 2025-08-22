import React, { useState } from "react";

export default function ViessmannGameTest() {
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  return (
    <div style={{ padding: 20, background: "#f0f0f0", minHeight: "100vh" }}>
      <h1>Viessmann Game Test</h1>
      <p>This is a minimal test version.</p>
      
      <header style={{ 
        padding: 16, 
        background: "white", 
        borderRadius: 8, 
        marginBottom: 20,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center"
      }}>
        <div>Resources would go here</div>
        
        <div style={{ position: "relative" }}>
          <button 
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            style={{ padding: "8px 16px", background: "#0ea5e9", color: "white", border: "none", borderRadius: 8 }}
          >
            👤 My profile
          </button>
          
          {showProfileMenu && (
            <div style={{
              position: "absolute",
              top: "100%",
              right: 0,
              background: "white",
              border: "1px solid #ccc",
              borderRadius: 8,
              padding: 16,
              marginTop: 8,
              minWidth: 200
            }}>
              <div>🏆 Achievements (2/8)</div>
            </div>
          )}
        </div>
      </header>
      
      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr 300px", gap: 16 }}>
        <div style={{ background: "white", padding: 16, borderRadius: 8 }}>
          <h3>Shop</h3>
          <p>Shop items would go here</p>
        </div>
        
        <div style={{ background: "white", padding: 16, borderRadius: 8 }}>
          <h3>Game Map</h3>
          <p>Isometric grid would go here</p>
        </div>
        
        <div style={{ background: "white", padding: 16, borderRadius: 8 }}>
          <h3>Missions</h3>
          <p>Mission list would go here</p>
        </div>
      </div>
    </div>
  );
}
